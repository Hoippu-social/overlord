import {
    ButtonInteraction,
    Interaction,
    MessageFlags,
    StringSelectMenuInteraction,
} from 'discord.js';
import logger from '../utils/logger';
import { getInteractionLocale } from '../utils/i18n';
import type { LocaleCode } from '../utils/i18n';
import { EconomyService } from './EconomyService';
import { EconomyGameService } from './EconomyGameService';
import { EconomyPvpService } from './EconomyPvpService';
import { EconomyShopService } from './EconomyShopService';
import { EconomyQuestService } from './EconomyQuestService';
import { ecoCopy, fmt } from '../utils/economyI18n';
import { buildCard, type CardSpec } from '../utils/economyCards';
import {
    ECO_PREFIX,
    type Currency,
    renderBlackjack,
    renderCoinflipResult,
    renderRoulettePrompt,
    renderRouletteResult,
    renderRps,
    renderSlotsResult,
    renderTicTacToe,
    renderPvpChallenge,
} from '../utils/economyGameCards';
import type { RpsPick } from '../services/EconomyPvpService';

export function isEconomyInteraction(interaction: Interaction): boolean {
    return (
        (interaction.isButton() || interaction.isStringSelectMenu()) &&
        interaction.customId.startsWith(ECO_PREFIX)
    );
}

async function currencyFor(guildId: string): Promise<Currency> {
    const cfg = await EconomyService.getConfig(guildId);
    return { name: cfg.currencyName, emoji: cfg.currencyEmoji };
}

async function ephemeral(interaction: ButtonInteraction | StringSelectMenuInteraction, text: string): Promise<void> {
    if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: text, flags: MessageFlags.Ephemeral }).catch(() => null);
    } else {
        await interaction.reply({ content: text, flags: MessageFlags.Ephemeral }).catch(() => null);
    }
}

async function updateCard(interaction: ButtonInteraction | StringSelectMenuInteraction, spec: CardSpec): Promise<void> {
    await interaction.update({ flags: MessageFlags.IsComponentsV2, components: [buildCard(spec)] }).catch(async () => {
        await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [buildCard(spec)] }).catch(() => null);
    });
}

// Common gambling-guard reason → localized text.
function guardText(reason: string, locale: LocaleCode, cfg: { minBet: bigint; maxBet: bigint | null; currencyName: string; currencyEmoji: string | null }): string {
    const c = ecoCopy(locale);
    const cur = { name: cfg.currencyName, emoji: cfg.currencyEmoji };
    const m = (v: bigint) => (v.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' ' + (cur.emoji || cur.name));
    switch (reason) {
        case 'GAMBLING_DISABLED': return c.game.gamblingDisabled;
        case 'BLACKLISTED': return c.common.blacklisted;
        case 'BET_TOO_LOW': return fmt(c.game.betTooLow, { min: m(cfg.minBet) });
        case 'BET_TOO_HIGH': return fmt(c.game.betTooHigh, { max: cfg.maxBet != null ? m(cfg.maxBet) : '—' });
        case 'DAILY_LOSS_CAP': return c.game.dailyLossCap;
        case 'INSUFFICIENT_FUNDS': return c.common.insufficient;
        default: return c.common.error;
    }
}

export async function handleEconomyInteraction(interaction: Interaction): Promise<void> {
    if (!interaction.isButton() && !interaction.isStringSelectMenu()) return;
    if (!interaction.inGuild()) return;
    const guildId = interaction.guildId!;
    const locale = await getInteractionLocale(interaction);
    const parts = interaction.customId.split(':'); // ['eco', domain, ...]
    const domain = parts[1];

    try {
        switch (domain) {
            case 'bj': return await handleBlackjack(interaction as ButtonInteraction, parts, guildId, locale);
            case 'cf': return await handleCoinflip(interaction as ButtonInteraction, parts, guildId, locale);
            case 'slots': return await handleSlots(interaction as ButtonInteraction, parts, guildId, locale);
            case 'rl': return await handleRoulette(interaction as StringSelectMenuInteraction, parts, guildId, locale);
            case 'rlnew': return await handleRouletteAgain(interaction as ButtonInteraction, parts, guildId, locale);
            case 'rps': return await handleRps(interaction as ButtonInteraction, parts, guildId, locale);
            case 'ttt': return await handleTtt(interaction as ButtonInteraction, parts, guildId, locale);
            case 'shop': return await handleShopBuy(interaction as StringSelectMenuInteraction, guildId, locale);
            case 'quest': return await handleQuestClaim(interaction as ButtonInteraction, parts, guildId, locale);
            default:
                await ephemeral(interaction, ecoCopy(locale).common.error);
        }
    } catch (error) {
        logger.error('[EconomyInteraction] handler failed:', error);
        await ephemeral(interaction, ecoCopy(locale).common.error);
    }
}

// ── Blackjack ─────────────────────────────────────────────────────────────────
async function handleBlackjack(interaction: ButtonInteraction, parts: string[], guildId: string, locale: LocaleCode): Promise<void> {
    const [, , action, sessionId, betStr, upStr] = parts;
    const bet = betStr ? BigInt(betStr) : 0n;
    const dealerUpCard = upStr ? Number(upStr) : undefined;
    const currency = await currencyFor(guildId);
    const c = ecoCopy(locale);

    if (action === 'hit') {
        const r = await EconomyGameService.hitBlackjack(sessionId, interaction.user.id);
        if (!r.ok) return ephemeral(interaction, r.reason === 'NOT_YOUR_TURN' ? c.common.notForYou : c.blackjack.expired);
        if (r.busted) {
            return updateCard(interaction, renderBlackjack(
                { sessionId, playerHand: r.playerHand, playerTotal: r.playerTotal, bet, outcome: 'BUST' },
                locale, currency,
            ));
        }
        return updateCard(interaction, renderBlackjack(
            { sessionId, playerHand: r.playerHand, playerTotal: r.playerTotal, dealerUpCard, bet },
            locale, currency,
        ));
    }

    if (action === 'stand') {
        const r = await EconomyGameService.standBlackjack(sessionId, interaction.user.id);
        if (!r.ok) return ephemeral(interaction, r.reason === 'NOT_YOUR_TURN' ? c.common.notForYou : c.blackjack.expired);
        return updateCard(interaction, renderBlackjack(
            {
                sessionId, playerHand: [], playerTotal: r.playerTotal,
                dealerHand: r.dealerHand, dealerTotal: r.dealerTotal,
                bet, outcome: r.outcome === 'WIN' ? 'WIN' : r.outcome === 'PUSH' ? 'PUSH' : 'LOSE', payout: r.payout,
            },
            locale, currency,
        ));
    }
}

// ── Coinflip ──────────────────────────────────────────────────────────────────
async function handleCoinflip(interaction: ButtonInteraction, parts: string[], guildId: string, locale: LocaleCode): Promise<void> {
    const [, , choice, betStr, ownerId] = parts;
    if (interaction.user.id !== ownerId) return ephemeral(interaction, ecoCopy(locale).common.notForYou);
    const bet = BigInt(betStr);
    const currency = await currencyFor(guildId);
    const r = await EconomyGameService.playCoinflip(guildId, interaction.user.id, bet, choice as 'HEADS' | 'TAILS');
    if (!r.ok) {
        const cfg = await EconomyService.getConfig(guildId);
        return ephemeral(interaction, guardText(r.reason, locale, cfg));
    }
    return updateCard(interaction, renderCoinflipResult(r, bet, ownerId, locale, currency));
}

// ── Slots ─────────────────────────────────────────────────────────────────────
async function handleSlots(interaction: ButtonInteraction, parts: string[], guildId: string, locale: LocaleCode): Promise<void> {
    const [, , , betStr, ownerId] = parts;
    if (interaction.user.id !== ownerId) return ephemeral(interaction, ecoCopy(locale).common.notForYou);
    const bet = BigInt(betStr);
    const currency = await currencyFor(guildId);
    const r = await EconomyGameService.playSlots(guildId, interaction.user.id, bet);
    if (!r.ok) {
        const cfg = await EconomyService.getConfig(guildId);
        return ephemeral(interaction, guardText(r.reason, locale, cfg));
    }
    return updateCard(interaction, renderSlotsResult(r, bet, ownerId, locale, currency));
}

// ── Roulette ──────────────────────────────────────────────────────────────────
async function handleRoulette(interaction: StringSelectMenuInteraction, parts: string[], guildId: string, locale: LocaleCode): Promise<void> {
    const [, , betStr, ownerId] = parts;
    if (interaction.user.id !== ownerId) return ephemeral(interaction, ecoCopy(locale).common.notForYou);
    const bet = BigInt(betStr);
    const betType = interaction.values[0] as 'RED' | 'BLACK' | 'GREEN';
    const currency = await currencyFor(guildId);
    const r = await EconomyGameService.playRoulette(guildId, interaction.user.id, bet, betType);
    if (!r.ok) {
        const cfg = await EconomyService.getConfig(guildId);
        return ephemeral(interaction, guardText(r.reason, locale, cfg));
    }
    return updateCard(interaction, renderRouletteResult(r, bet, ownerId, locale, currency));
}

async function handleRouletteAgain(interaction: ButtonInteraction, parts: string[], guildId: string, locale: LocaleCode): Promise<void> {
    const [, , betStr, ownerId] = parts;
    if (interaction.user.id !== ownerId) return ephemeral(interaction, ecoCopy(locale).common.notForYou);
    const currency = await currencyFor(guildId);
    return updateCard(interaction, renderRoulettePrompt(BigInt(betStr), ownerId, locale, currency));
}

// ── RPS ───────────────────────────────────────────────────────────────────────
async function handleRps(interaction: ButtonInteraction, parts: string[], guildId: string, locale: LocaleCode): Promise<void> {
    const [, , action, matchId, pick] = parts;
    const currency = await currencyFor(guildId);
    const c = ecoCopy(locale);

    if (action === 'accept') {
        const r = await EconomyPvpService.acceptMatch(matchId, interaction.user.id);
        if (!r.ok) return ephemeral(interaction, pvpFail(r.reason, locale));
        return updateCard(interaction, renderRps(r.match, locale, currency));
    }
    if (action === 'decline') {
        const r = await EconomyPvpService.declineMatch(matchId, interaction.user.id);
        if (!r.ok) return ephemeral(interaction, pvpFail(r.reason, locale));
        return updateCard(interaction, {
            title: `✂️ ${c.pvp.games.RPS}`,
            body: [fmt(c.pvp.declined, { opponent: `<@${interaction.user.id}>` })],
        });
    }
    if (action === 'pick') {
        const r = await EconomyPvpService.rpsPick(matchId, interaction.user.id, pick as RpsPick);
        if (!r.ok) {
            if (r.reason === 'ALREADY_PICKED') return ephemeral(interaction, c.pvp.alreadyPicked);
            if (r.reason === 'NOT_YOUR_MATCH') return ephemeral(interaction, c.common.notForYou);
            return ephemeral(interaction, pvpFail(r.reason, locale));
        }
        return updateCard(interaction, renderRps(r.match, locale, currency));
    }
}

// ── Tic-Tac-Toe ─────────────────────────────────────────────────────────────
async function handleTtt(interaction: ButtonInteraction, parts: string[], guildId: string, locale: LocaleCode): Promise<void> {
    const [, , action, matchId, cellStr] = parts;
    const currency = await currencyFor(guildId);
    const c = ecoCopy(locale);

    if (action === 'accept') {
        const r = await EconomyPvpService.acceptMatch(matchId, interaction.user.id);
        if (!r.ok) return ephemeral(interaction, pvpFail(r.reason, locale));
        return updateCard(interaction, renderTicTacToe(r.match, locale, currency));
    }
    if (action === 'decline') {
        const r = await EconomyPvpService.declineMatch(matchId, interaction.user.id);
        if (!r.ok) return ephemeral(interaction, pvpFail(r.reason, locale));
        return updateCard(interaction, {
            title: `⭕ ${c.pvp.games.TICTACTOE}`,
            body: [fmt(c.pvp.declined, { opponent: `<@${interaction.user.id}>` })],
        });
    }
    if (action === 'cell') {
        const r = await EconomyPvpService.tttMove(matchId, interaction.user.id, Number(cellStr));
        if (!r.ok) {
            if (r.reason === 'NOT_YOUR_TURN') return ephemeral(interaction, c.pvp.notYourTurn);
            if (r.reason === 'CELL_TAKEN') return ephemeral(interaction, c.pvp.cellTaken);
            if (r.reason === 'NOT_YOUR_MATCH') return ephemeral(interaction, c.common.notForYou);
            return ephemeral(interaction, pvpFail(r.reason, locale));
        }
        return updateCard(interaction, renderTicTacToe(r.match, locale, currency));
    }
}

// ── Shop buy (select menu) ──────────────────────────────────────────────────
async function handleShopBuy(interaction: StringSelectMenuInteraction, guildId: string, locale: LocaleCode): Promise<void> {
    const c = ecoCopy(locale);
    const itemId = Number(interaction.values[0]);
    const member = interaction.inCachedGuild() ? interaction.member : undefined;
    const currency = await currencyFor(guildId);
    const result = await EconomyShopService.purchase({ guildId, userId: interaction.user.id, itemId, member: member ?? undefined });
    if (!result.ok) {
        const map: Record<string, string> = {
            OUT_OF_STOCK: c.shop.outOfStock, MAX_PER_USER: c.shop.maxPerUser,
            ROLE_REQUIRED: c.shop.roleRequired, ROLE_DENIED: c.shop.roleDenied,
            INSUFFICIENT_FUNDS: c.common.insufficient, BLACKLISTED: c.common.blacklisted,
            NOT_FOUND: c.common.error, DISABLED: c.common.error,
        };
        return ephemeral(interaction, map[result.reason] ?? c.common.error);
    }
    const item = await EconomyShopService.listShopItems(guildId).then((items) => items.find((i) => i.id === itemId));
    const priceStr = item ? (item.price.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' ' + (currency.emoji || currency.name)) : '';
    return ephemeral(interaction, fmt(c.shop.bought, { item: item?.name ?? String(itemId), price: priceStr }));
}

// ── Quest claim ─────────────────────────────────────────────────────────────
async function handleQuestClaim(interaction: ButtonInteraction, parts: string[], guildId: string, locale: LocaleCode): Promise<void> {
    const c = ecoCopy(locale);
    const templateId = Number(parts[3]);
    const currency = await currencyFor(guildId);
    const r = await EconomyQuestService.claimQuest(guildId, interaction.user.id, templateId);
    if (!r.ok) return ephemeral(interaction, c.common.error);
    const amount = r.reward.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' ' + (currency.emoji || currency.name);
    return ephemeral(interaction, fmt(c.quests.claimed, { amount }));
}

function pvpFail(reason: string, locale: LocaleCode): string {
    const c = ecoCopy(locale);
    switch (reason) {
        case 'GAMBLING_DISABLED': return c.game.gamblingDisabled;
        case 'BLACKLISTED': return c.common.blacklisted;
        case 'INSUFFICIENT_FUNDS': return c.common.insufficient;
        case 'EXPIRED': return c.pvp.expired;
        case 'NOT_YOUR_MATCH': return c.common.notForYou;
        case 'ALREADY_RESOLVED': return c.common.error;
        default: return c.common.error;
    }
}

// Re-exported so game command files can attach the correct initial challenge card.
export { renderPvpChallenge };
