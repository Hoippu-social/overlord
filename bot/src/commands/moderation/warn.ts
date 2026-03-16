import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { createModerationCase } from '../../services/ModerationService';
import { logAuditEvent } from '../../utils/auditLog';
import { formatDurationFromMinutes, parseDurationToMinutes } from '../../utils/moderationHelpers';
import { Command } from '../../utils/types';

const command: Command = {
    data: new SlashCommandBuilder()
        .setName('warn')
        .setDescription('Issue a warning to a member')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .setDMPermission(false)
        .addUserOption((option) =>
            option.setName('user').setDescription('Member to warn').setRequired(true)
        )
        .addStringOption((option) =>
            option.setName('duration').setDescription('Optional duration like 30m, 12h, 2d').setRequired(false)
        )
        .addStringOption((option) =>
            option.setName('reason').setDescription('Reason for the warning').setRequired(true).setMaxLength(500)
        ),
    accessGroup: 'moderation',
    accessKey: 'warn',
    requiredAccessLevel: 40,
    async execute(interaction) {
        if (!interaction.guildId) {
            await interaction.reply({ content: 'Guild only.', ephemeral: true });
            return;
        }

        const target = interaction.options.getUser('user', true);
        const duration = interaction.options.getString('duration');
        const reason = interaction.options.getString('reason', true);
        const durationMinutes = duration ? (parseDurationToMinutes(duration) ?? undefined) : undefined;

        if (duration && (!durationMinutes || durationMinutes <= 0)) {
            await interaction.reply({ content: 'Invalid duration.', ephemeral: true });
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

        await logAuditEvent(interaction.client, {
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
        });

        await interaction.reply({
            content: durationMinutes
                ? `Warned <@${target.id}> for ${formatDurationFromMinutes(durationMinutes)}. Case #${moderationCase.caseNumber}.`
                : `Warned <@${target.id}>. Case #${moderationCase.caseNumber}.`,
            ephemeral: true,
        });
    },
};

export default command;
