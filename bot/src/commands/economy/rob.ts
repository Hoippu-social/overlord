import { SlashCommandBuilder } from 'discord.js';
import { Command } from '../../utils/types';
import { localizeDescription } from '../../utils/commandLocalizations';
import { getInteractionLocale } from '../../utils/i18n';
import { EconomyService } from '../../services/EconomyService';
import { EconomyActionsService } from '../../services/EconomyActionsService';
import { ACCENT, cardReply, money } from '../../utils/economyCards';
import { ecoCopy, fmt } from '../../utils/economyI18n';

const command: Command = {
    data: localizeDescription(
        new SlashCommandBuilder()
            .setName('rob')
            .addUserOption((opt) =>
                localizeDescription(opt.setName('user').setRequired(true), {
                    en: 'Who to rob',
                    ru: 'Кого ограбить',
                })
            ),
        {
            en: 'Attempt to rob another member',
            ru: 'Попытаться ограбить другого участника',
        }
    ),
    execute: async (interaction) => {
        if (!interaction.guildId || !interaction.guild) return;
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

        const targetUser = interaction.options.getUser('user', true);

        let joinedTimestamp: number | null = null;
        try {
            const guildMember = await interaction.guild.members.fetch(targetUser.id);
            joinedTimestamp = guildMember.joinedTimestamp ?? null;
        } catch {
            joinedTimestamp = null;
        }

        const result = await EconomyActionsService.attemptRob(guildId, interaction.user.id, {
            id: targetUser.id,
            joinedTimestamp,
        });

        if (result.ok) {
            if (result.success) {
                await interaction.reply(
                    cardReply({
                        accent: ACCENT.primary,
                        title: c.rob.title,
                        body: [fmt(c.rob.success, { user: `<@${targetUser.id}>`, amount: money(result.amount, currency) })],
                    })
                );
                return;
            }

            await interaction.reply(
                cardReply({ accent: ACCENT.danger, title: c.rob.title, body: [fmt(c.rob.failed, { amount: money(result.fineAmount, currency) })] })
            );
            return;
        }

        if (result.reason === 'COOLDOWN') {
            const when = `<t:${Math.floor(result.nextAvailableAt.getTime() / 1000)}:R>`;
            await interaction.reply(
                cardReply({ accent: ACCENT.neutral, title: c.rob.title, body: [fmt(c.rob.cooldown, { when })] }, { ephemeral: true })
            );
            return;
        }

        let body: string;
        switch (result.reason) {
            case 'SELF_TARGET':
                body = c.rob.selfTarget;
                break;
            case 'TARGET_PROTECTED':
                body = c.rob.targetProtected;
                break;
            case 'TARGET_TOO_POOR':
                body = c.rob.targetPoor;
                break;
            case 'TARGET_SHIELDED':
                body = c.rob.targetShielded;
                break;
            case 'BLACKLISTED':
                body = c.common.blacklisted;
                break;
            default:
                body = c.common.sourceDisabled;
                break;
        }

        await interaction.reply(
            cardReply({ accent: ACCENT.neutral, title: c.rob.title, body: [body] }, { ephemeral: true })
        );
    },
};

export default command;
