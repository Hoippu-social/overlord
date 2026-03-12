import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { unbanUser } from '../../services/ModerationService';
import { logAuditEvent } from '../../utils/auditLog';
import { Command } from '../../utils/types';

const command: Command = {
    data: new SlashCommandBuilder()
        .setName('unban')
        .setDescription('Unban a user by id')
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
        .setDMPermission(false)
        .addStringOption((option) => option.setName('user_id').setDescription('User id to unban').setRequired(true))
        .addStringOption((option) => option.setName('reason').setDescription('Reason').setRequired(false).setMaxLength(500)),
    accessGroup: 'moderation',
    accessKey: 'unban',
    requiredAccessLevel: 80,
    async execute(interaction) {
        if (!interaction.guild) {
            await interaction.reply({ content: 'Guild only.', ephemeral: true });
            return;
        }

        const targetUserId = interaction.options.getString('user_id', true).trim();
        const reason = interaction.options.getString('reason');
        const moderationCase = await unbanUser({
            guild: interaction.guild,
            targetUserId,
            actorUserId: interaction.user.id,
            reason,
        });

        await logAuditEvent(interaction.client, {
            guildId: interaction.guild.id,
            tag: 'moderation',
            actorId: interaction.user.id,
            targetId: targetUserId,
            payload: { event: 'unban', caseNumber: moderationCase.caseNumber, reason },
            severity: 'INFO',
        });

        await interaction.reply({ content: `Unbanned \`${targetUserId}\`. Case #${moderationCase.caseNumber}.`, ephemeral: true });
    },
};

export default command;
