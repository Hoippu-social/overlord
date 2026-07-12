import { SlashCommandBuilder } from 'discord.js';
import { Command } from '../../utils/types';
import { localizeDescription } from '../../utils/commandLocalizations';
import { getInteractionLocale } from '../../utils/i18n';
import { EconomyService } from '../../services/EconomyService';
import { prisma } from '../../utils/database';
import { ACCENT, cardReply, money } from '../../utils/economyCards';
import { ecoCopy } from '../../utils/economyI18n';

const MEDALS = ['🥇', '🥈', '🥉'];

const command: Command = {
    data: localizeDescription(new SlashCommandBuilder().setName('leaderboard'), {
        en: 'Top richest members',
        ru: 'Топ самых богатых участников',
    }),
    execute: async (interaction) => {
        if (!interaction.guildId) return;
        const guildId = interaction.guildId;
        const locale = await getInteractionLocale(interaction);
        const c = ecoCopy(locale);
        const cfg = await EconomyService.getConfig(guildId);
        const currency = { name: cfg.currencyName, emoji: cfg.currencyEmoji };

        if (!cfg.enabled) {
            await interaction.reply(cardReply({ accent: ACCENT.neutral, title: c.common.error, body: [c.common.disabled] }, { ephemeral: true }));
            return;
        }

        const top = await prisma.economyMember.findMany({
            where: { guildId },
            orderBy: { wallet: 'desc' },
            take: 10,
        });

        if (top.length === 0) {
            await interaction.reply(cardReply({ accent: ACCENT.neutral, title: c.leaderboard.title, body: [c.leaderboard.empty] }));
            return;
        }

        const lines = top.map((m, i) => {
            const rank = MEDALS[i] ?? `**${i + 1}.**`;
            return `${rank} <@${m.userId}> — ${money(m.wallet, currency)}`;
        });

        await interaction.reply(
            cardReply({ accent: ACCENT.gold, title: c.leaderboard.title, subtitle: c.leaderboard.byWallet, body: [lines.join('\n')] })
        );
    },
};

export default command;
