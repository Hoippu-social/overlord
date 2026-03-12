import { ChannelType, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { logAuditEvent } from '../../utils/auditLog';
import { voiceMoveMember } from '../../services/ModerationService';
import { Command } from '../../utils/types';

const command: Command = {
    data: new SlashCommandBuilder()
        .setName('voicemove')
        .setDescription('Move a member to another voice channel')
        .setDefaultMemberPermissions(PermissionFlagsBits.MoveMembers)
        .setDMPermission(false)
        .addUserOption((option) => option.setName('user').setDescription('Member to move').setRequired(true))
        .addChannelOption((option) =>
            option
                .setName('channel')
                .setDescription('Target voice channel')
                .setRequired(true)
                .addChannelTypes(ChannelType.GuildVoice, ChannelType.GuildStageVoice)
        )
        .addStringOption((option) => option.setName('reason').setDescription('Reason').setRequired(false).setMaxLength(500)),
    accessGroup: 'moderation',
    accessKey: 'voicemove',
    requiredAccessLevel: 45,
    async execute(interaction) {
        if (!interaction.guild) {
            await interaction.reply({ content: 'Guild only.', ephemeral: true });
            return;
        }

        const target = interaction.options.getUser('user', true);
        const targetChannel = interaction.options.getChannel('channel', true);
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
        const moderationCase = await voiceMoveMember({
            member,
            targetChannelId: targetChannel.id,
            actorUserId: interaction.user.id,
            reason,
        });

        await logAuditEvent(interaction.client, {
            guildId: interaction.guild.id,
            tag: 'moderation',
            actorId: interaction.user.id,
            targetId: target.id,
            channelId: targetChannel.id,
            payload: {
                event: 'voicemove',
                caseNumber: moderationCase.caseNumber,
                reason,
                fromChannelId,
                toChannelId: targetChannel.id,
            },
            severity: 'INFO',
        });

        await interaction.reply({
            content: `Moved <@${target.id}> to <#${targetChannel.id}>. Case #${moderationCase.caseNumber}.`,
            ephemeral: true,
        });
    },
};

export default command;
