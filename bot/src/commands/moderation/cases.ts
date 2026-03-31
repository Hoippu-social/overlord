import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { listCasesForUser } from '../../services/ModerationService';
import { localizeDescription } from '../../utils/commandLocalizations';
import { getInteractionLocale, t } from '../../utils/i18n';
import { localizeModerationAction, localizeModerationStatus } from '../../utils/moderationHelpers';
import { buildStaffEmbed } from '../../utils/staffEmbeds';
import { Command } from '../../utils/types';

const command: Command = {
    data: localizeDescription(
        new SlashCommandBuilder()
            .setName('cases')
            .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
            .setDMPermission(false)
            .addUserOption((option) =>
                localizeDescription(option.setName('user').setRequired(true), {
                    en: 'Member to inspect',
                    ru: 'Участник для просмотра кейсов',
                })
            ),
        {
            en: 'List moderation cases for a member',
            ru: 'Показать кейсы участника',
        }
    ),
    accessGroup: 'moderation',
    accessKey: 'cases',
    requiredAccessLevel: 30,
    async execute(interaction) {
        const locale = await getInteractionLocale(interaction);
        if (!interaction.guildId) {
            await interaction.reply({ content: t(locale, 'general.guildOnly'), ephemeral: true });
            return;
        }

        const target = interaction.options.getUser('user', true);
        const cases = await listCasesForUser(interaction.guildId, target.id, 15);

        if (!cases.length) {
            await interaction.reply({ content: t(locale, 'staff.cases.empty'), ephemeral: true });
            return;
        }

        const embed = buildStaffEmbed({
            actor: interaction.user,
            title: t(locale, 'staff.cases.title'),
            color: 0x10131a,
            thumbnailUrl: target.displayAvatarURL({ size: 256 }),
            description: ['', `**${t(locale, 'staff.case.target')}:** <@${target.id}>`],
            fields: cases.map((row) => ({
                label: `#${row.caseNumber} | ${localizeModerationAction(locale, row.actionType)} | ${localizeModerationStatus(locale, row.status)}`,
                value: row.reason ?? t(locale, 'audit.moderation.notSpecified'),
                inline: false,
            })),
        });

        await interaction.reply({ embeds: [embed], ephemeral: true });
    },
};

export default command;
