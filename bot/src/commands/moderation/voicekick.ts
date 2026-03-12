import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { logAuditEvent } from '../../utils/auditLog';
import { voiceKickMember } from '../../services/ModerationService';
import { Command } from '../../utils/types';

const command: Command = {
    data: new SlashCommandBuilder()
        .setName('voicekick')
        .setDescription('Disconnect a member from voice')
        .setDefaultMemberPermissions(PermissionFlagsBits.MoveMembers)
        .setDMPermission(false)
        .addUserOption((option) => option.setName('user').setDescription('Member to disconnect').setRequired(true))
        .addStringOption((option) => option.setName('reason').setDescription('Reason').setRequired(false).setMaxLength(500)),
    accessGroup: 'moderation',
    accessKey: 'voicekick',
    requiredAccessLevel: 45,
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

        if (!member.voice.channelId) {
            await interaction.reply({ content: 'That member is not connected to voice.', ephemeral: true });
            return;
        }

        const fromChannelId = member.voice.channelId;
        const moderationCase = await voiceKickMember({
            member,
            actorUserId: interaction.user.id,
            reason,
        });

        await logAuditEvent(interaction.client, {
            guildId: interaction.guild.id,
            tag: 'moderation',
            actorId: interaction.user.id,
            targetId: target.id,
            channelId: fromChannelId,
            payload: {
                event: 'voicekick',
                caseNumber: moderationCase.caseNumber,
                reason,
            },
            severity: 'WARN',
        });

        await interaction.reply({
            content: `Disconnected <@${target.id}> from voice. Case #${moderationCase.caseNumber}.`,
            ephemeral: true,
        });
    },
};

export default command;
