import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { banUser, tempbanUser } from '../../services/ModerationService';
import { buildAuditPreview, logAuditEvent } from '../../utils/auditLog';
import { localizeDescription } from '../../utils/commandLocalizations';
import { getInteractionLocale, t } from '../../utils/i18n';
import { parseDurationToMinutes, parseDurationToSeconds } from '../../utils/moderationHelpers';
import { buildStaffEmbed } from '../../utils/staffEmbeds';
import { Command } from '../../utils/types';

const command: Command = {
    data: localizeDescription(
        new SlashCommandBuilder()
            .setName('ban')
            .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
            .setDMPermission(false)
            .addUserOption((option) =>
                localizeDescription(option.setName('user').setRequired(true), {
                    en: 'User to ban',
                    ru: 'Пользователь для бана',
                })
            )
            .addStringOption((option) =>
                localizeDescription(option.setName('duration').setRequired(false), {
                    en: 'Optional ban duration like 1h, 1d, 7d',
                    ru: 'Необязательная длительность бана, например 1h, 1d, 7d',
                })
            )
            .addStringOption((option) =>
                localizeDescription(option.setName('reason').setRequired(false).setMaxLength(500), {
                    en: 'Reason',
                    ru: 'Причина',
                })
            )
            .addStringOption((option) =>
                localizeDescription(option.setName('delete_message_period').setRequired(false), {
                    en: 'Optional period like 1h, 1d, 7d',
                    ru: 'Необязательный период удаления сообщений, например 1h, 1d, 7d',
                })
            ),
        {
            en: 'Ban a user from the guild',
            ru: 'Забанить пользователя на сервере',
        }
    ),
    accessGroup: 'moderation',
    accessKey: 'ban',
    requiredAccessLevel: 80,
    async execute(interaction) {
        const locale = await getInteractionLocale(interaction);
        if (!interaction.guild) {
            await interaction.reply({ content: t(locale, 'general.guildOnly'), ephemeral: true });
            return;
        }

        const target = interaction.options.getUser('user', true);
        const duration = interaction.options.getString('duration');
        const reason = interaction.options.getString('reason');
        const period = interaction.options.getString('delete_message_period');
        const durationMinutes = duration ? parseDurationToMinutes(duration) : undefined;
        const deleteMessageSeconds = period ? (parseDurationToSeconds(period) ?? undefined) : undefined;

        if (duration && (!durationMinutes || durationMinutes <= 0)) {
            await interaction.reply({ content: t(locale, 'general.invalidBanDuration'), ephemeral: true });
            return;
        }

        if (period && (!deleteMessageSeconds || deleteMessageSeconds > 7 * 24 * 60 * 60)) {
            await interaction.reply({ content: t(locale, 'general.invalidDeleteMessagePeriod'), ephemeral: true });
            return;
        }

        const moderationCase = durationMinutes
            ? await tempbanUser({
                guild: interaction.guild,
                targetUser: target,
                actorUserId: interaction.user.id,
                durationMinutes,
                reason,
                deleteMessageSeconds,
            })
            : await banUser({
                guild: interaction.guild,
                targetUser: target,
                actorUserId: interaction.user.id,
                reason,
                deleteMessageSeconds,
            });

        const auditInput = {
            guildId: interaction.guild.id,
            tag: 'moderation',
            actorId: interaction.user.id,
            targetId: target.id,
            payload: {
                event: durationMinutes ? 'tempban' : 'ban',
                caseNumber: moderationCase.caseNumber,
                reason,
                durationMinutes: durationMinutes ?? null,
                until: moderationCase.expiresAt?.toISOString?.() ?? null,
                deleteMessageSeconds: deleteMessageSeconds ?? null,
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
                    title: t(locale, durationMinutes ? 'audit.moderation.tempban.title' : 'audit.moderation.ban.title'),
                    color: 0xfb7185,
                    thumbnailUrl: target.displayAvatarURL({ size: 256 }),
                    description: [
                        '',
                        `**${t(locale, 'audit.moderation.target')}:** <@${target.id}>`,
                        `**${t(locale, 'audit.moderation.actor')}:** <@${interaction.user.id}>`,
                    ],
                    fields: [
                        { label: t(locale, 'audit.moderation.reason'), value: reason ?? t(locale, 'audit.moderation.notSpecified') },
                        { label: t(locale, 'audit.moderation.duration'), value: duration ?? t(locale, 'audit.moderation.forever') },
                        { label: t(locale, 'moderation.action.case'), value: `#${moderationCase.caseNumber}` },
                    ],
                }),
            ],
            ephemeral: true,
        });
    },
};

export default command;
