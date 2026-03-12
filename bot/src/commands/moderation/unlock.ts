import { ChannelType, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { unlockChannel } from '../../services/ModerationService';
import { logAuditEvent } from '../../utils/auditLog';
import { Command } from '../../utils/types';

function isGuildChannel(channel: unknown): channel is Parameters<typeof unlockChannel>[0]['channel'] {
    return Boolean(channel && typeof channel === 'object' && 'guild' in channel);
}

const command: Command = {
    data: new SlashCommandBuilder()
        .setName('unlock')
        .setDescription('Unlock a text channel for @everyone')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
        .setDMPermission(false)
        .addChannelOption((option) =>
            option
                .setName('channel')
                .setDescription('Channel to unlock, defaults to current')
                .setRequired(false)
                .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        )
        .addStringOption((option) => option.setName('reason').setDescription('Reason').setRequired(false).setMaxLength(500)),
    accessGroup: 'moderation',
    accessKey: 'unlock',
    requiredAccessLevel: 50,
    async execute(interaction) {
        if (!interaction.guild) {
            await interaction.reply({ content: 'Guild only.', ephemeral: true });
            return;
        }

        const selectedChannel = interaction.options.getChannel('channel', false) ?? interaction.channel;
        const reason = interaction.options.getString('reason');

        if (!isGuildChannel(selectedChannel)) {
            await interaction.reply({ content: 'Select a guild text channel.', ephemeral: true });
            return;
        }

        const moderationCase = await unlockChannel({
            channel: selectedChannel,
            actorUserId: interaction.user.id,
            reason,
        });

        await logAuditEvent(interaction.client, {
            guildId: interaction.guild.id,
            tag: 'moderation',
            actorId: interaction.user.id,
            channelId: selectedChannel.id,
            payload: {
                event: 'unlock',
                caseNumber: moderationCase.caseNumber,
                reason,
            },
            severity: 'INFO',
        });

        await interaction.reply({
            content: `Unlocked <#${selectedChannel.id}>. Case #${moderationCase.caseNumber}.`,
            ephemeral: true,
        });
    },
};

export default command;
