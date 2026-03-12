import { ChannelType, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { logAuditEvent } from '../../utils/auditLog';
import { setChannelSlowmode } from '../../services/ModerationService';
import { Command } from '../../utils/types';

function isGuildChannel(channel: unknown): channel is Parameters<typeof setChannelSlowmode>[0]['channel'] {
    return Boolean(channel && typeof channel === 'object' && 'guild' in channel);
}

const command: Command = {
    data: new SlashCommandBuilder()
        .setName('slowmode')
        .setDescription('Set slowmode for a text channel')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
        .setDMPermission(false)
        .addIntegerOption((option) =>
            option.setName('seconds').setDescription('Slowmode in seconds, use 0 to clear').setRequired(true).setMinValue(0).setMaxValue(21600)
        )
        .addChannelOption((option) =>
            option
                .setName('channel')
                .setDescription('Channel to update, defaults to current')
                .setRequired(false)
                .addChannelTypes(ChannelType.GuildText, ChannelType.PublicThread, ChannelType.PrivateThread)
        )
        .addStringOption((option) => option.setName('reason').setDescription('Reason').setRequired(false).setMaxLength(500)),
    accessGroup: 'moderation',
    accessKey: 'slowmode',
    requiredAccessLevel: 45,
    async execute(interaction) {
        if (!interaction.guild) {
            await interaction.reply({ content: 'Guild only.', ephemeral: true });
            return;
        }

        const seconds = interaction.options.getInteger('seconds', true);
        const selectedChannel = interaction.options.getChannel('channel', false) ?? interaction.channel;
        const reason = interaction.options.getString('reason');

        if (!isGuildChannel(selectedChannel)) {
            await interaction.reply({ content: 'Select a guild text channel.', ephemeral: true });
            return;
        }

        const moderationCase = await setChannelSlowmode({
            channel: selectedChannel,
            actorUserId: interaction.user.id,
            seconds,
            reason,
        });

        await logAuditEvent(interaction.client, {
            guildId: interaction.guild.id,
            tag: 'moderation',
            actorId: interaction.user.id,
            channelId: selectedChannel.id,
            payload: {
                event: seconds > 0 ? 'slowmode' : 'slowmode_clear',
                caseNumber: moderationCase.caseNumber,
                reason,
                seconds,
            },
            severity: 'INFO',
        });

        await interaction.reply({
            content: seconds > 0
                ? `Set slowmode for <#${selectedChannel.id}> to ${seconds}s. Case #${moderationCase.caseNumber}.`
                : `Cleared slowmode for <#${selectedChannel.id}>. Case #${moderationCase.caseNumber}.`,
            ephemeral: true,
        });
    },
};

export default command;
