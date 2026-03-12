import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { kickMember } from '../../services/ModerationService';
import { logAuditEvent } from '../../utils/auditLog';
import { Command } from '../../utils/types';

const command: Command = {
    data: new SlashCommandBuilder()
        .setName('kick')
        .setDescription('Kick a member from the guild')
        .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
        .setDMPermission(false)
        .addUserOption((option) => option.setName('user').setDescription('Member to kick').setRequired(true))
        .addStringOption((option) => option.setName('reason').setDescription('Reason').setRequired(false).setMaxLength(500)),
    accessGroup: 'moderation',
    accessKey: 'kick',
    requiredAccessLevel: 70,
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

        const moderationCase = await kickMember({ member, actorUserId: interaction.user.id, reason });
        await logAuditEvent(interaction.client, {
            guildId: interaction.guild.id,
            tag: 'moderation',
            actorId: interaction.user.id,
            targetId: target.id,
            payload: { event: 'kick', caseNumber: moderationCase.caseNumber, reason },
            severity: 'WARN',
        });

        await interaction.reply({ content: `Kicked <@${target.id}>. Case #${moderationCase.caseNumber}.`, ephemeral: true });
    },
};

export default command;
