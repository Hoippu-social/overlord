import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { banUser, tempbanUser } from '../../services/ModerationService';
import { parseDurationToMinutes, parseDurationToSeconds } from '../../utils/moderationHelpers';
import { logAuditEvent } from '../../utils/auditLog';
import { Command } from '../../utils/types';

const command: Command = {
    data: new SlashCommandBuilder()
        .setName('ban')
        .setDescription('Ban a user from the guild')
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
        .setDMPermission(false)
        .addUserOption((option) => option.setName('user').setDescription('User to ban').setRequired(true))
        .addStringOption((option) => option.setName('duration').setDescription('Optional ban duration like 1h, 1d, 7d').setRequired(false))
        .addStringOption((option) => option.setName('reason').setDescription('Reason').setRequired(false).setMaxLength(500))
        .addStringOption((option) => option.setName('delete_message_period').setDescription('Optional period like 1h, 1d, 7d').setRequired(false)),
    accessGroup: 'moderation',
    accessKey: 'ban',
    requiredAccessLevel: 80,
    async execute(interaction) {
        if (!interaction.guild) {
            await interaction.reply({ content: 'Guild only.', ephemeral: true });
            return;
        }

        const target = interaction.options.getUser('user', true);
        const duration = interaction.options.getString('duration');
        const reason = interaction.options.getString('reason');
        const period = interaction.options.getString('delete_message_period');
        const durationMinutes = duration ? parseDurationToMinutes(duration) : undefined;
        const deleteMessageSeconds = period ? (parseDurationToSeconds(period) ?? undefined) : undefined;

        if (duration && (!durationMinutes || durationMinutes <= 0)) {
            await interaction.reply({ content: 'Invalid ban duration.', ephemeral: true });
            return;
        }

        if (period && (!deleteMessageSeconds || deleteMessageSeconds > 7 * 24 * 60 * 60)) {
            await interaction.reply({ content: 'Invalid delete message period. Use up to 7 days.', ephemeral: true });
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

        await logAuditEvent(interaction.client, {
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
        });

        await interaction.reply({
            content: durationMinutes
                ? `Banned <@${target.id}> for ${duration}. Case #${moderationCase.caseNumber}.`
                : `Banned <@${target.id}>. Case #${moderationCase.caseNumber}.`,
            ephemeral: true,
        });
    },
};

export default command;
