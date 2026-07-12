import { SlashCommandBuilder } from 'discord.js';
import { Command } from '../../utils/types';
import { localizeDescription } from '../../utils/commandLocalizations';
import { getInteractionLocale } from '../../utils/i18n';
import { EconomyService } from '../../services/EconomyService';
import { EconomyGameService } from '../../services/EconomyGameService';
import { ACCENT, cardReply, money } from '../../utils/economyCards';
import { ecoCopy, fmt } from '../../utils/economyI18n';
import { renderBlackjack, renderSlotsPrompt, renderRoulettePrompt } from '../../utils/economyGameCards';

const command: Command = {
    data: localizeDescription(
        new SlashCommandBuilder()
            .setName('casino')
            .addSubcommand((sub) =>
                localizeDescription(
                    sub
                        .setName('blackjack')
                        .addIntegerOption((o) =>
                            localizeDescription(o.setName('bet'), {
                                en: 'How much to bet',
                                ru: 'Сколько поставить',
                            })
                                .setMinValue(1)
                                .setRequired(true)
                        ),
                    { en: 'Play a hand of blackjack against the house', ru: 'Сыграть в блэкджек против казино' }
                )
            )
            .addSubcommand((sub) =>
                localizeDescription(
                    sub
                        .setName('slots')
                        .addIntegerOption((o) =>
                            localizeDescription(o.setName('bet'), {
                                en: 'How much to bet',
                                ru: 'Сколько поставить',
                            })
                                .setMinValue(1)
                                .setRequired(true)
                        ),
                    { en: 'Spin the slot machine', ru: 'Крутить игровой автомат' }
                )
            )
            .addSubcommand((sub) =>
                localizeDescription(
                    sub
                        .setName('roulette')
                        .addIntegerOption((o) =>
                            localizeDescription(o.setName('bet'), {
                                en: 'How much to bet',
                                ru: 'Сколько поставить',
                            })
                                .setMinValue(1)
                                .setRequired(true)
                        ),
                    { en: 'Bet on red, black or zero', ru: 'Ставка на красное, чёрное или зеро' }
                )
            ),
        { en: 'Play house casino games', ru: 'Играть в казино против заведения' }
    ),
    execute: async (interaction) => {
        const guildId = interaction.guildId;
        if (!guildId) return;
        const locale = await getInteractionLocale(interaction);
        const c = ecoCopy(locale);
        const cfg = await EconomyService.getConfig(guildId);
        const currency = { name: cfg.currencyName, emoji: cfg.currencyEmoji };

        if (!cfg.enabled) {
            await interaction.reply(
                cardReply({ accent: ACCENT.neutral, title: c.common.error, body: [c.common.disabled] }, { ephemeral: true })
            );
            return;
        }
        if (!cfg.gamblingEnabled) {
            await interaction.reply(
                cardReply({ accent: ACCENT.neutral, title: c.blackjack.title, body: [c.game.gamblingDisabled] }, { ephemeral: true })
            );
            return;
        }

        const bet = BigInt(interaction.options.getInteger('bet', true));
        const sub = interaction.options.getSubcommand();

        if (sub === 'blackjack') {
            const r = await EconomyGameService.startBlackjack(guildId, interaction.user.id, bet);
            if (!r.ok) {
                await interaction.reply(
                    cardReply(
                        { accent: ACCENT.danger, title: c.blackjack.title, body: [mapGuardReason(r.reason, c, cfg, currency)] },
                        { ephemeral: true }
                    )
                );
                return;
            }
            await interaction.reply(
                cardReply(
                    renderBlackjack(
                        {
                            sessionId: r.sessionId,
                            playerHand: r.playerHand,
                            playerTotal: r.playerTotal,
                            dealerUpCard: r.dealerUpCard,
                            bet,
                        },
                        locale,
                        currency
                    )
                )
            );
            return;
        }

        if (sub === 'slots') {
            await interaction.reply(cardReply(renderSlotsPrompt(bet, interaction.user.id, locale, currency)));
            return;
        }

        if (sub === 'roulette') {
            await interaction.reply(cardReply(renderRoulettePrompt(bet, interaction.user.id, locale, currency)));
            return;
        }
    },
};

function mapGuardReason(
    reason: 'GAMBLING_DISABLED' | 'BLACKLISTED' | 'BET_TOO_LOW' | 'BET_TOO_HIGH' | 'DAILY_LOSS_CAP' | 'INSUFFICIENT_FUNDS',
    c: ReturnType<typeof ecoCopy>,
    cfg: { minBet: bigint; maxBet: bigint | null },
    currency: { name: string; emoji: string | null }
): string {
    switch (reason) {
        case 'GAMBLING_DISABLED':
            return c.game.gamblingDisabled;
        case 'BET_TOO_LOW':
            return fmt(c.game.betTooLow, { min: money(cfg.minBet, currency) });
        case 'BET_TOO_HIGH':
            return fmt(c.game.betTooHigh, { max: cfg.maxBet != null ? money(cfg.maxBet, currency) : '—' });
        case 'INSUFFICIENT_FUNDS':
            return c.common.insufficient;
        case 'BLACKLISTED':
            return c.common.blacklisted;
        case 'DAILY_LOSS_CAP':
            return c.game.dailyLossCap;
    }
}

export default command;
