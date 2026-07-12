import { SlashCommandBuilder } from 'discord.js';
import { Command } from '../../utils/types';
import { localizeDescription } from '../../utils/commandLocalizations';
import { getInteractionLocale } from '../../utils/i18n';
import { EconomyService } from '../../services/EconomyService';
import { ACCENT, cardReply, money } from '../../utils/economyCards';
import { ecoCopy, fmt } from '../../utils/economyI18n';

const command: Command = {
    data: localizeDescription(
        new SlashCommandBuilder()
            .setName('balance')
            .addUserOption((opt) =>
                localizeDescription(opt.setName('user'), {
                    en: 'Whose balance to view',
                    ru: 'Чей баланс показать',
                })
            ),
        {
            en: 'Show a wallet and bank balance',
            ru: 'Показать баланс кошелька и банка',
        }
    ),
    execute: async (interaction) => {
        if (!interaction.guildId) return;
        const guildId = interaction.guildId;
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

        const targetUser = interaction.options.getUser('user');
        const userId = targetUser?.id ?? interaction.user.id;
        const member = await EconomyService.getOrCreateMember(guildId, userId);

        const total = member.wallet + member.bank;
        const title = targetUser ? fmt(c.balance.of, { user: `<@${targetUser.id}>` }) : c.balance.title;

        await interaction.reply(
            cardReply({
                accent: ACCENT.primary,
                title,
                fields: [
                    { label: c.common.wallet, value: money(member.wallet, currency) },
                    { label: c.common.bank, value: money(member.bank, currency) },
                    { label: c.common.total, value: money(total, currency) },
                ],
                footer: fmt(c.balance.streak, { n: member.dailyStreak }),
            })
        );
    },
};

export default command;
