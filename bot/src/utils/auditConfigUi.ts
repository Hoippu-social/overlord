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
import { getGuildLocale, t } from './i18n';

export const AUDIT_TAGS = [
    { value: 'moderation', labelKey: 'admin.audit.tag.moderation', descriptionKey: 'admin.audit.desc.moderation' },
    { value: 'member', labelKey: 'admin.audit.tag.member', descriptionKey: 'admin.audit.desc.member' },
    { value: 'message', labelKey: 'admin.audit.tag.message', descriptionKey: 'admin.audit.desc.message' },
    { value: 'channel', labelKey: 'admin.audit.tag.channel', descriptionKey: 'admin.audit.desc.channel' },
    { value: 'role', labelKey: 'admin.audit.tag.role', descriptionKey: 'admin.audit.desc.role' },
    { value: 'voice', labelKey: 'admin.audit.tag.voice', descriptionKey: 'admin.audit.desc.voice' },
    { value: 'invites', labelKey: 'admin.audit.tag.invites', descriptionKey: 'admin.audit.desc.invites' },
    { value: 'security', labelKey: 'admin.audit.tag.security', descriptionKey: 'admin.audit.desc.security' },
    { value: 'bot', labelKey: 'admin.audit.tag.bot', descriptionKey: 'admin.audit.desc.bot' },
    { value: 'ai_moderation', labelKey: 'admin.audit.tag.ai_moderation', descriptionKey: 'admin.audit.desc.ai_moderation' },
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
    const locale = await getGuildLocale(guildId);
    const route = await getAuditRoute(guildId, tag);
    const channelValue = route?.channelId ? `<#${route.channelId}>` : t(locale, 'admin.audit.notSet');
    const statusValue = route?.enabled ? t(locale, 'admin.audit.enabled') : t(locale, 'admin.audit.disabled');

    const embed = new EmbedBuilder()
        .setTitle(t(locale, 'admin.audit.title'))
        .setDescription(t(locale, 'admin.audit.description'))
        .addFields(
            { name: t(locale, 'admin.audit.tag'), value: `\`${tag}\``, inline: true },
            { name: t(locale, 'admin.audit.status'), value: statusValue, inline: true },
            { name: t(locale, 'admin.audit.channel'), value: channelValue, inline: false },
        );

    const tagSelect = new StringSelectMenuBuilder()
        .setCustomId(`audit_tag_select:${userId}`)
        .setPlaceholder(t(locale, 'admin.audit.selectTag'))
        .addOptions(
            AUDIT_TAGS.map((entry) =>
                new StringSelectMenuOptionBuilder()
                    .setLabel(t(locale, entry.labelKey))
                    .setValue(entry.value)
                    .setDescription(t(locale, entry.descriptionKey))
                    .setDefault(entry.value === tag),
            ),
        );

    const channelSelect = new ChannelSelectMenuBuilder()
        .setCustomId(`audit_channel_select:${tag}:${userId}`)
        .setPlaceholder(t(locale, 'admin.audit.selectChannel'))
        .setMaxValues(1)
        .setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement);

    const enableButton = new ButtonBuilder()
        .setCustomId(`audit_route_enable:${tag}:${userId}`)
        .setLabel(t(locale, 'admin.audit.button.enable'))
        .setStyle(ButtonStyle.Success)
        .setDisabled(route?.enabled ?? false);

    const disableButton = new ButtonBuilder()
        .setCustomId(`audit_route_disable:${tag}:${userId}`)
        .setLabel(t(locale, 'admin.audit.button.disable'))
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(!route?.enabled);

    const clearButton = new ButtonBuilder()
        .setCustomId(`audit_route_clear:${tag}:${userId}`)
        .setLabel(t(locale, 'admin.audit.button.clear'))
        .setStyle(ButtonStyle.Danger)
        .setDisabled(!route);

    const closeButton = new ButtonBuilder()
        .setCustomId(`audit_route_close:${userId}`)
        .setLabel(t(locale, 'admin.audit.button.close'))
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
