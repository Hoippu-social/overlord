import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelSelectMenuBuilder,
    ChannelType,
    EmbedBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
} from 'discord.js';
import { prisma } from './database';

export const AUDIT_TAGS = [
    { value: 'moderation', label: 'Moderation', description: 'ban/kick/timeout/automod' },
    { value: 'member', label: 'Member', description: 'join/leave/nick/boost' },
    { value: 'message', label: 'Message', description: 'delete/edit/pin' },
    { value: 'channel', label: 'Channel', description: 'create/update/delete' },
    { value: 'role', label: 'Role', description: 'create/update/assign' },
    { value: 'voice', label: 'Voice', description: 'join/leave/move' },
    { value: 'invites', label: 'Invites', description: 'create/delete/use/leave' },
    { value: 'security', label: 'Security', description: 'webhooks/integrations' },
    { value: 'bot', label: 'Bot', description: 'config/restart/errors' },
];

export async function getAuditRoute(guildId: string, tag: string) {
    return prisma.auditTagRoute.findUnique({
        where: { guildId_tag: { guildId, tag } },
    });
}

export async function upsertAuditRoute(guildId: string, tag: string, data: { channelId?: string; enabled?: boolean }) {
    const current = await getAuditRoute(guildId, tag);
    const channelId = data.channelId ?? current?.channelId;
    if (!channelId) return null;

    return prisma.auditTagRoute.upsert({
        where: { guildId_tag: { guildId, tag } },
        update: {
            channelId,
            enabled: typeof data.enabled === 'boolean' ? data.enabled : current?.enabled ?? true,
        },
        create: {
            guildId,
            tag,
            channelId,
            enabled: typeof data.enabled === 'boolean' ? data.enabled : true,
        },
    });
}

export async function deleteAuditRoute(guildId: string, tag: string) {
    return prisma.auditTagRoute.delete({
        where: { guildId_tag: { guildId, tag } },
    });
}

export async function buildAuditConfigUi(guildId: string, userId: string, tag: string) {
    const route = await getAuditRoute(guildId, tag);
    const channelValue = route?.channelId ? `<#${route.channelId}>` : 'not set';
    const statusValue = route?.enabled ? 'enabled' : 'disabled';

    const embed = new EmbedBuilder()
        .setTitle('Audit routing')
        .setDescription('Select a tag and map it to a channel. Use buttons to enable/disable or clear.')
        .addFields(
            { name: 'Tag', value: `\`${tag}\``, inline: true },
            { name: 'Status', value: statusValue, inline: true },
            { name: 'Channel', value: channelValue, inline: false },
        );

    const tagSelect = new StringSelectMenuBuilder()
        .setCustomId(`audit_tag_select:${userId}`)
        .setPlaceholder('Select audit tag')
        .addOptions(
            AUDIT_TAGS.map((entry) =>
                new StringSelectMenuOptionBuilder()
                    .setLabel(entry.label)
                    .setValue(entry.value)
                    .setDescription(entry.description)
                    .setDefault(entry.value === tag),
            ),
        );

    const channelSelect = new ChannelSelectMenuBuilder()
        .setCustomId(`audit_channel_select:${tag}:${userId}`)
        .setPlaceholder('Select target channel')
        .setMaxValues(1)
        .setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement);

    const enableButton = new ButtonBuilder()
        .setCustomId(`audit_route_enable:${tag}:${userId}`)
        .setLabel('Enable')
        .setStyle(ButtonStyle.Success)
        .setDisabled(route?.enabled ?? false);

    const disableButton = new ButtonBuilder()
        .setCustomId(`audit_route_disable:${tag}:${userId}`)
        .setLabel('Disable')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(!route?.enabled);

    const clearButton = new ButtonBuilder()
        .setCustomId(`audit_route_clear:${tag}:${userId}`)
        .setLabel('Clear')
        .setStyle(ButtonStyle.Danger)
        .setDisabled(!route);

    const closeButton = new ButtonBuilder()
        .setCustomId(`audit_route_close:${userId}`)
        .setLabel('Close')
        .setStyle(ButtonStyle.Secondary);

    return {
        embeds: [embed],
        components: [
            new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(tagSelect),
            new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(channelSelect),
            new ActionRowBuilder<ButtonBuilder>().addComponents(enableButton, disableButton, clearButton, closeButton),
        ],
    };
}
