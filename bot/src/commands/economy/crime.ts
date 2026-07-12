import { SlashCommandBuilder } from 'discord.js';
import { Command } from '../../utils/types';
import { localizeDescription } from '../../utils/commandLocalizations';
import { getInteractionLocale } from '../../utils/i18n';
import { EconomyService } from '../../services/EconomyService';
import { EconomyActionsService } from '../../services/EconomyActionsService';
import { ACCENT, cardReply, money } from '../../utils/economyCards';
import { ecoCopy, fmt } from '../../utils/economyI18n';

const command: Command = {
    data: localizeDescription(new SlashCommandBuilder().setName('crime'), {
        en: 'Attempt a crime for a risky reward',
        ru: 'Совершить преступление ради рискованной награды',
    }),
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

        const result = await EconomyActionsService.attemptCrime(guildId, interaction.user.id);

        if (result.ok) {
            if (result.success) {
                await interaction.reply(
                    cardReply({
                        accent: ACCENT.primary,
                        title: c.crime.title,
                        body: [fmt(c.crime.success, { amount: money(result.amount, currency) })],
                    })
                );
                return;
            }

            const body =
                result.fineAmount > 0
                    ? fmt(c.crime.failed, { amount: money(result.fineAmount, currency) })
                    : c.crime.failedNoFine;
            await interaction.reply(cardReply({ accent: ACCENT.danger, title: c.crime.title, body: [body] }));
            return;
        }

        if (result.reason === 'COOLDOWN') {
            const when = `<t:${Math.floor(result.nextAvailableAt.getTime() / 1000)}:R>`;
            await interaction.reply(
                cardReply({ accent: ACCENT.neutral, title: c.crime.title, body: [fmt(c.crime.cooldown, { when })] }, { ephemeral: true })
            );
            return;
        }

        const body = result.reason === 'BLACKLISTED' ? c.common.blacklisted : c.common.sourceDisabled;
        await interaction.reply(
            cardReply({ accent: ACCENT.neutral, title: c.common.error, body: [body] }, { ephemeral: true })
        );
    },
};

export default command;
