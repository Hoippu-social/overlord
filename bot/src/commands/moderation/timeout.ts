import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { timeoutMember } from '../../services/ModerationService';
import { buildAuditPreview, logAuditEvent } from '../../utils/auditLog';
import { localizeDescription } from '../../utils/commandLocalizations';
import { getInteractionLocale, t } from '../../utils/i18n';
import { formatDurationFromMinutes, parseDurationToMinutes } from '../../utils/moderationHelpers';
import { buildStaffEmbed } from '../../utils/staffEmbeds';
import { Command } from '../../utils/types';

const command: Command = {
    data: localizeDescription(
        new SlashCommandBuilder()
            .setName('timeout')
            .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
            .setDMPermission(false)
            .addUserOption((option) =>
                localizeDescription(option.setName('user').setRequired(true), {
                    en: 'Member to timeout',
                    ru: 'Участник для тайм-аута',
                })
            )
            .addStringOption((option) =>
                localizeDescription(option.setName('duration').setRequired(true), {
                    en: 'Duration like 30m, 12h, 2d',
                    ru: 'Длительность, например 30m, 12h, 2d',
                })
            )
            .addStringOption((option) =>
                localizeDescription(option.setName('reason').setRequired(false).setMaxLength(500), {
                    en: 'Reason',
                    ru: 'Причина',
                })
            ),
        {
            en: 'Timeout a guild member',
            ru: 'Выдать тайм-аут участнику',
        }
    ),
    accessGroup: 'moderation',
    accessKey: 'timeout',
    requiredAccessLevel: 50,
    async execute(interaction) {
        const locale = await getInteractionLocale(interaction);
        if (!interaction.guild) {
            await interaction.reply({ content: t(locale, 'general.guildOnly'), ephemeral: true });
            return;
        }

        const target = interaction.options.getUser('user', true);
        const duration = interaction.options.getString('duration', true);
        const reason = interaction.options.getString('reason');
        const durationMinutes = parseDurationToMinutes(duration);

        if (!durationMinutes || durationMinutes > 28 * 24 * 60) {
            await interaction.reply({ content: t(locale, 'general.invalidTimeoutDuration'), ephemeral: true });
            return;
        }

        const member = await interaction.guild.members.fetch(target.id).catch(() => null);
        if (!member) {
            await interaction.reply({ content: t(locale, 'general.memberNotFound'), ephemeral: true });
            return;
        }

        const moderationCase = await timeoutMember({
            member,
            actorUserId: interaction.user.id,
            durationMinutes,
            reason,
        });

        const auditInput = {
            guildId: interaction.guild.id,
            tag: 'moderation',
            actorId: interaction.user.id,
            targetId: target.id,
            payload: {
                event: 'timeout',
                caseNumber: moderationCase.caseNumber,
                durationMinutes,
                reason,
            },
            severity: 'WARN',
        } as const;

        await logAuditEvent(interaction.client, auditInput);
        const preview = await buildAuditPreview(interaction.client, auditInput);

        if (preview?.embeds?.length) {
            await interaction.reply({ embeds: preview.embeds, ephemeral: true });
            return;
        }

        await interaction.reply({
            embeds: [
                buildStaffEmbed({
                    actor: interaction.user,
                    title: t(locale, 'audit.moderation.timeout.title'),
                    color: 0xfcd34d,
                    thumbnailUrl: target.displayAvatarURL({ size: 256 }),
                    description: [
                        '',
                        `**${t(locale, 'audit.moderation.target')}:** <@${target.id}>`,
                        `**${t(locale, 'audit.moderation.actor')}:** <@${interaction.user.id}>`,
                    ],
                    fields: [
                        { label: t(locale, 'audit.moderation.reason'), value: reason ?? t(locale, 'audit.moderation.notSpecified') },
                        { label: t(locale, 'audit.moderation.duration'), value: formatDurationFromMinutes(durationMinutes) },
                        { label: t(locale, 'moderation.action.case'), value: `#${moderationCase.caseNumber}` },
                    ],
                }),
            ],
            ephemeral: true,
        });
    },
};

export default command;
