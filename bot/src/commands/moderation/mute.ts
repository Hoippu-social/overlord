import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { muteMember } from '../../services/ModerationService';
import { logAuditEvent } from '../../utils/auditLog';
import { Command } from '../../utils/types';

const command: Command = {
    data: new SlashCommandBuilder()
        .setName('mute')
        .setDescription('Add the configured mute role to a member')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .setDMPermission(false)
        .addUserOption((option) => option.setName('user').setDescription('Member to mute').setRequired(true))
        .addStringOption((option) => option.setName('reason').setDescription('Reason').setRequired(false).setMaxLength(500)),
    accessGroup: 'moderation',
    accessKey: 'mute',
    requiredAccessLevel: 60,
    async execute(interaction) {
        if (!interaction.guild) {
            await interaction.reply({ content: 'Guild only.', ephemeral: true });
            return;
        }

        const target = interaction.options.getUser('user', true);
        const reason = interaction.options.getString('reason');
        const member = await interaction.guild.members.fetch(target.id).catch(() => null);
        if (!member) {
            await interaction.reply({ content: 'Member not found in this guild.', ephemeral: true });
            return;
        }

        try {
            const moderationCase = await muteMember({ member, actorUserId: interaction.user.id, reason });
            await logAuditEvent(interaction.client, {
                guildId: interaction.guild.id,
                tag: 'moderation',
                actorId: interaction.user.id,
                targetId: target.id,
                payload: { event: 'mute', caseNumber: moderationCase.caseNumber, reason },
                severity: 'WARN',
            });
            await interaction.reply({ content: `Muted <@${target.id}>. Case #${moderationCase.caseNumber}.`, ephemeral: true });
        } catch (error) {
            await interaction.reply({ content: error instanceof Error ? error.message : 'Failed to mute the member.', ephemeral: true });
        }
    },
};

export default command;
