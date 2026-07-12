import { ButtonStyle, SlashCommandBuilder } from 'discord.js';
import { Command } from '../../utils/types';
import { localizeDescription } from '../../utils/commandLocalizations';
import { getInteractionLocale } from '../../utils/i18n';
import { EconomyService } from '../../services/EconomyService';
import { EconomyQuestService } from '../../services/EconomyQuestService';
import { ACCENT, cardReply, money, type CardButton } from '../../utils/economyCards';
import { ecoCopy, fmt } from '../../utils/economyI18n';

const command: Command = {
    data: localizeDescription(new SlashCommandBuilder().setName('quests'), {
        en: 'View your active quests and claim rewards',
        ru: 'Посмотреть активные квесты и забрать награды',
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

        const quests = await EconomyQuestService.listActiveQuests(guildId, interaction.user.id);

        if (quests.length === 0) {
            await interaction.reply(cardReply({ accent: ACCENT.neutral, title: c.quests.title, body: [c.quests.empty] }, { ephemeral: true }));
            return;
        }

        const body = quests.map((q) => {
            const done = q.completedAt != null;
            const marker = done ? `✅ ${c.quests.done}` : fmt(c.quests.progress, { cur: q.progress, target: q.target });
            return `**${q.name}** — ${money(q.reward, currency)}\n-# ${marker}`;
        });

        const claimButtons: CardButton[] = quests
            .filter((q) => q.completedAt != null && q.claimedAt == null)
            .map((q) => ({ id: `eco:quest:claim:${q.id}`, label: `${c.quests.claim} · ${q.name}`.slice(0, 78), style: ButtonStyle.Success, emoji: '🎁' }));

        const buttonRows: CardButton[][] = [];
        for (let i = 0; i < claimButtons.length; i += 5) {
            buttonRows.push(claimButtons.slice(i, i + 5));
        }

        await interaction.reply(
            cardReply({ accent: ACCENT.violet, title: c.quests.title, body, buttonRows: buttonRows.length ? buttonRows : undefined }, { ephemeral: true })
        );
    },
};

export default command;
