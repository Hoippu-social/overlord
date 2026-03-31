import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { muteMember } from '../../services/ModerationService';
import { buildAuditPreview, logAuditEvent } from '../../utils/auditLog';
import { localizeDescription } from '../../utils/commandLocalizations';
import { getInteractionLocale, t } from '../../utils/i18n';
import { formatDurationFromMinutes, parseDurationToMinutes } from '../../utils/moderationHelpers';
import { buildStaffEmbed } from '../../utils/staffEmbeds';
import { Command } from '../../utils/types';

const command: Command = {
    data: localizeDescription(
        new SlashCommandBuilder()
            .setName('mute')
            .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
            .setDMPermission(false)
            .addUserOption((option) =>
                localizeDescription(option.setName('user').setRequired(true), {
                    en: 'Member to mute',
                    ru: 'Участник для мута',
                })
            )
            .addStringOption((option) =>
                localizeDescription(option.setName('duration').setRequired(false), {
                    en: 'Optional duration like 30m, 12h, 2d',
                    ru: 'Необязательная длительность, например 30m, 12h, 2d',
                })
            )
            .addStringOption((option) =>
                localizeDescription(option.setName('reason').setRequired(false).setMaxLength(500), {
                    en: 'Reason',
                    ru: 'Причина',
                })
            ),
        {
            en: 'Add the configured mute role to a member',
            ru: 'Выдать участнику мут',
        }
    ),
    accessGroup: 'moderation',
    accessKey: 'mute',
    requiredAccessLevel: 50,
    async execute(interaction) {
        const locale = await getInteractionLocale(interaction);
        if (!interaction.guild) {
            await interaction.reply({ content: t(locale, 'general.guildOnly'), ephemeral: true });
            return;
        }

        const target = interaction.options.getUser('user', true);
        const duration = interaction.options.getString('duration');
        const reason = interaction.options.getString('reason');
        const durationMinutes = duration ? (parseDurationToMinutes(duration) ?? undefined) : undefined;

        if (duration && (!durationMinutes || durationMinutes <= 0)) {
            await interaction.reply({ content: t(locale, 'general.invalidDuration'), ephemeral: true });
            return;
        }

        const member = await interaction.guild.members.fetch(target.id).catch(() => null);
        if (!member) {
            await interaction.reply({ content: t(locale, 'general.memberNotFound'), ephemeral: true });
            return;
        }

        try {
            const moderationCase = await muteMember({
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
                    event: 'mute',
                    caseNumber: moderationCase.caseNumber,
                    durationMinutes: durationMinutes ?? null,
                    until: moderationCase.expiresAt?.toISOString?.() ?? null,
                    reason,
                },
                severity: 'WARN',
            } as const;
            await logAuditEvent(interaction.client, auditInput);
            const preview = await buildAuditPreview(interaction.client, auditInput);
            await interaction.reply({
                embeds: preview?.embeds ?? [
                    buildStaffEmbed({
                        actor: interaction.user,
                        title: t(locale, 'audit.moderation.mute.title'),
                        color: 0xfcd34d,
                        thumbnailUrl: target.displayAvatarURL({ size: 256 }),
                        description: ['', `**${t(locale, 'audit.moderation.target')}:** <@${target.id}>`, `**${t(locale, 'audit.moderation.actor')}:** <@${interaction.user.id}>`],
                        fields: [
                            { label: t(locale, 'audit.moderation.reason'), value: reason ?? t(locale, 'audit.moderation.notSpecified') },
                            { label: t(locale, 'audit.moderation.duration'), value: durationMinutes ? formatDurationFromMinutes(durationMinutes) : t(locale, 'audit.moderation.forever') },
                            { label: t(locale, 'moderation.action.case'), value: `#${moderationCase.caseNumber}` },
                        ],
                    }),
                ],
                ephemeral: true,
            });
        } catch {
            await interaction.reply({ content: t(locale, 'general.error'), ephemeral: true });
        }
    },
};

export default command;
