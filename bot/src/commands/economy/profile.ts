import { SlashCommandBuilder } from 'discord.js';
import { Command } from '../../utils/types';
import { localizeDescription } from '../../utils/commandLocalizations';
import { getInteractionLocale } from '../../utils/i18n';
import { EconomyService } from '../../services/EconomyService';
import { ACCENT, cardReply, money } from '../../utils/economyCards';
import { ecoCopy, fmt } from '../../utils/economyI18n';

const command: Command = {
    data: localizeDescription(
        (new SlashCommandBuilder().setName('profile') as SlashCommandBuilder).addUserOption((o) =>
            localizeDescription(o.setName('user').setRequired(false), {
                en: 'Whose profile to view',
                ru: 'Чей профиль показать',
            })
        ),
        { en: 'View an economy profile', ru: 'Посмотреть экономический профиль' }
    ),
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

        const target = interaction.options.getUser('user') ?? interaction.user;
        const member = await EconomyService.getOrCreateMember(guildId, target.id);
        const total = member.wallet + member.bank;

        await interaction.reply(
            cardReply({
                accent: ACCENT.primary,
                title: fmt(c.profile.title, { user: target.displayName ?? target.username }),
                fields: [
                    { label: c.common.wallet, value: money(member.wallet, currency) },
                    { label: c.common.bank, value: money(member.bank, currency) },
                    { label: c.common.total, value: money(total, currency) },
                    { label: c.balance.title, value: fmt(c.daily.streak, { n: member.dailyStreak }) },
                    { label: '🎮', value: `${member.gamesWon} / ${member.gamesPlayed}` },
                ],
            })
        );
    },
};

export default command;
