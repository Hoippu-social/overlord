import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { createModerationCase } from '../../services/ModerationService';
import { buildAuditPreview, logAuditEvent } from '../../utils/auditLog';
import { localizeDescription } from '../../utils/commandLocalizations';
import { getInteractionLocale, t } from '../../utils/i18n';
import { formatDurationFromMinutes, parseDurationToMinutes } from '../../utils/moderationHelpers';
import { buildStaffEmbed } from '../../utils/staffEmbeds';
import { Command } from '../../utils/types';

const command: Command = {
    data: localizeDescription(
        new SlashCommandBuilder()
            .setName('warn')
            .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
            .setDMPermission(false)
            .addUserOption((option) =>
                localizeDescription(option.setName('user').setRequired(true), {
                    en: 'Member to warn',
                    ru: 'Участник для предупреждения',
                })
            )
            .addStringOption((option) =>
                localizeDescription(option.setName('reason').setRequired(true).setMaxLength(500), {
                    en: 'Reason for the warning',
                    ru: 'Причина предупреждения',
                })
            )
            .addStringOption((option) =>
                localizeDescription(option.setName('duration').setRequired(false), {
                    en: 'Optional duration like 30m, 12h, 2d',
                    ru: 'Необязательная длительность, например 30m, 12h, 2d',
                })
            ),
        {
            en: 'Issue a warning to a member',
            ru: 'Выдать предупреждение участнику',
        }
    ),
    accessGroup: 'moderation',
    accessKey: 'warn',
    requiredAccessLevel: 50,
    async execute(interaction) {
        const locale = await getInteractionLocale(interaction);
        if (!interaction.guildId) {
            await interaction.reply({ content: t(locale, 'general.guildOnly'), ephemeral: true });
            return;
        }

        const target = interaction.options.getUser('user', true);
        const duration = interaction.options.getString('duration');
        const reason = interaction.options.getString('reason', true);
        const durationMinutes = duration ? (parseDurationToMinutes(duration) ?? undefined) : undefined;

        if (duration && (!durationMinutes || durationMinutes <= 0)) {
            await interaction.reply({ content: t(locale, 'general.invalidDuration'), ephemeral: true });
            return;
        }

        const moderationCase = await createModerationCase({
            guildId: interaction.guildId,
            actionType: 'WARN',
            source: 'manual',
            actorUserId: interaction.user.id,
            targetUserId: target.id,
            reason,
            expiresAt: durationMinutes ? new Date(Date.now() + durationMinutes * 60_000) : null,
            metadata: durationMinutes ? { durationMinutes } : null,
        });

        const auditInput = {
            guildId: interaction.guildId,
            tag: 'moderation',
            actorId: interaction.user.id,
            targetId: target.id,
            payload: {
                event: 'warn',
                caseNumber: moderationCase.caseNumber,
                durationMinutes: durationMinutes ?? null,
                until: moderationCase.expiresAt?.toISOString?.() ?? null,
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
                    title: t(locale, 'audit.moderation.warn.title'),
                    color: 0x60a5fa,
                    thumbnailUrl: target.displayAvatarURL({ size: 256 }),
                    description: [
                        '',
                        `**${t(locale, 'audit.moderation.target')}:** <@${target.id}>`,
                        `**${t(locale, 'audit.moderation.actor')}:** <@${interaction.user.id}>`,
                    ],
                    fields: [
                        { label: t(locale, 'audit.moderation.reason'), value: reason },
                        { label: t(locale, 'audit.moderation.duration'), value: durationMinutes ? formatDurationFromMinutes(durationMinutes) : t(locale, 'audit.moderation.forever') },
                        { label: t(locale, 'moderation.action.case'), value: `#${moderationCase.caseNumber}` },
                    ],
                }),
            ],
            ephemeral: true,
        });
    },
};

export default command;
