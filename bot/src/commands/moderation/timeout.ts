import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { timeoutMember } from '../../services/ModerationService';
import { formatDurationFromMinutes, parseDurationToMinutes } from '../../utils/moderationHelpers';
import { logAuditEvent } from '../../utils/auditLog';
import { Command } from '../../utils/types';

const command: Command = {
    data: new SlashCommandBuilder()
        .setName('timeout')
        .setDescription('Timeout a guild member')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .setDMPermission(false)
        .addUserOption((option) => option.setName('user').setDescription('Member to timeout').setRequired(true))
        .addStringOption((option) => option.setName('duration').setDescription('Duration like 30m, 12h, 2d').setRequired(true))
        .addStringOption((option) => option.setName('reason').setDescription('Reason').setRequired(false).setMaxLength(500)),
    accessGroup: 'moderation',
    accessKey: 'timeout',
    requiredAccessLevel: 50,
    async execute(interaction) {
        if (!interaction.guild) {
            await interaction.reply({ content: 'Guild only.', ephemeral: true });
            return;
        }

        const target = interaction.options.getUser('user', true);
        const duration = interaction.options.getString('duration', true);
        const reason = interaction.options.getString('reason');
        const durationMinutes = parseDurationToMinutes(duration);

        if (!durationMinutes || durationMinutes > 28 * 24 * 60) {
            await interaction.reply({ content: 'Invalid duration. Timeout must be between 1 minute and 28 days.', ephemeral: true });
            return;
        }

        const member = await interaction.guild.members.fetch(target.id).catch(() => null);
        if (!member) {
            await interaction.reply({ content: 'Member not found in this guild.', ephemeral: true });
            return;
        }

        const moderationCase = await timeoutMember({
            member,
            actorUserId: interaction.user.id,
            durationMinutes,
            reason,
        });

        await logAuditEvent(interaction.client, {
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
        });

        await interaction.reply({ content: `Timed out <@${target.id}> for ${formatDurationFromMinutes(durationMinutes)}. Case #${moderationCase.caseNumber}.`, ephemeral: true });
    },
};

export default command;
