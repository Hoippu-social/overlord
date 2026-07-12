import { SlashCommandBuilder } from 'discord.js';
import { Command } from '../../utils/types';
import { localizeDescription } from '../../utils/commandLocalizations';
import { getInteractionLocale } from '../../utils/i18n';
import { EconomyService } from '../../services/EconomyService';
import { EconomyPvpService, type PvpFailReason } from '../../services/EconomyPvpService';
import { ACCENT, cardReply, money } from '../../utils/economyCards';
import { renderPvpChallenge } from '../../utils/economyGameCards';
import { ecoCopy, fmt } from '../../utils/economyI18n';

const GAME = 'TICTACTOE' as const;

const command: Command = {
    data: localizeDescription(
        new SlashCommandBuilder()
            .setName('tictactoe')
            .addUserOption((o) => o.setName('user').setDescription('Opponent to challenge').setRequired(true))
            .addIntegerOption((o) => o.setName('bet').setDescription('Amount to stake').setMinValue(1).setRequired(true)),
        {
            en: 'Challenge someone to Tic-Tac-Toe',
            ru: 'Вызвать игрока в Крестики-нолики',
        }
    ),
    execute: async (interaction) => {
        const guildId = interaction.guildId;
        if (!guildId) return;
        const locale = await getInteractionLocale(interaction);
        const c = ecoCopy(locale);
        const cfg = await EconomyService.getConfig(guildId);
        const currency = { name: cfg.currencyName, emoji: cfg.currencyEmoji };

        if (!cfg.enabled) {
            await interaction.reply(cardReply({ accent: ACCENT.neutral, title: c.common.error, body: [c.common.disabled] }, { ephemeral: true }));
            return;
        }
        if (!cfg.gamblingEnabled) {
            await interaction.reply(cardReply({ accent: ACCENT.neutral, title: c.pvp.games[GAME], body: [c.game.gamblingDisabled] }, { ephemeral: true }));
            return;
        }

        const opponent = interaction.options.getUser('user', true);
        const bet = interaction.options.getInteger('bet', true);

        if (opponent.bot) {
            await interaction.reply(cardReply({ accent: ACCENT.neutral, title: c.pvp.games[GAME], body: [c.common.error] }, { ephemeral: true }));
            return;
        }

        const r = await EconomyPvpService.createMatch({
            guildId,
            game: GAME,
            challengerId: interaction.user.id,
            opponentId: opponent.id,
            stake: BigInt(bet),
            channelId: interaction.channelId,
        });

        if (!r.ok) {
            await interaction.reply(cardReply({ accent: ACCENT.neutral, title: c.pvp.games[GAME], body: [failMessage(r.reason, cfg, currency, locale)] }, { ephemeral: true }));
            return;
        }

        await interaction.reply(
            cardReply(
                renderPvpChallenge(
                    { id: r.matchId, game: GAME, challengerId: interaction.user.id, opponentId: opponent.id, stake: BigInt(bet) },
                    locale,
                    currency
                )
            )
        );
        const sent = await interaction.fetchReply();
        EconomyPvpService.setMessageId(r.matchId, sent.id);
    },
};

function failMessage(
    reason: PvpFailReason,
    cfg: { minBet: bigint; maxBet: bigint | null },
    currency: { name: string; emoji: string | null },
    locale: Parameters<typeof ecoCopy>[0]
): string {
    const c = ecoCopy(locale);
    switch (reason) {
        case 'GAMBLING_DISABLED': return c.game.gamblingDisabled;
        case 'BLACKLISTED': return c.common.blacklisted;
        case 'BET_TOO_LOW': return fmt(c.game.betTooLow, { min: money(cfg.minBet, currency) });
        case 'BET_TOO_HIGH': return fmt(c.game.betTooHigh, { max: cfg.maxBet != null ? money(cfg.maxBet, currency) : '—' });
        case 'INSUFFICIENT_FUNDS': return c.common.insufficient;
        case 'SELF_MATCH': return c.rob.selfTarget;
        default: return c.common.error;
    }
}

export default command;
