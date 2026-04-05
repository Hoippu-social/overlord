import { Client, EmbedBuilder } from 'discord.js';
import logger from './logger';
import { prisma, statsPrisma } from './database';
import { getGuildLocale, LocaleCode, t } from './i18n';
import { parseAuditRouteChannelIds } from './auditRouteChannels';

type AuditPayload = Record<string, unknown>;

type AuditInput = {
    guildId: string;
    tag: string;
    actorId?: string | null;
    targetId?: string | null;
    channelId?: string | null;
    messageId?: string | null;
    payload?: AuditPayload;
    severity?: string | null;
};

const MAX_PREVIEW = 1000;

const TAG_COLORS: Record<string, number> = {
    moderation: 0xed4245, // Red
    automod: 0xf1c40f,    // Amber
    ai_moderation: 0x1abc9c, // Teal
    appeals: 0x3498db, // Blue
    member: 0x5865f2,     // Blurple
    message: 0xfee75c,    // Yellow
    channel: 0xeb459f,    // Pink
    role: 0x5865f2,       // Blurple
    voice: 0x2ecc71,      // Emerald
    invites: 0xe67e22,    // Orange
    security: 0xed4245,   // Red
    bot: 0x9b59b6,        // Purple
};

const MODERATION_EVENT_ALIASES: Record<string, string> = {
    ban_add: 'ban',
    ban_remove: 'unban',
    member_kick: 'kick',
    member_timeout: 'timeout',
    member_timeout_remove: 'untimeout',
};

const MODERATION_EVENT_META: Record<string, { color: number; title: string }> = {
    warn: { color: 0x60a5fa, title: 'MODERATION | Пользователю выдан Варн' },
    unwarn: { color: 0x60a5fa, title: 'MODERATION | Варн снят' },
    mute: { color: 0xfcd34d, title: 'MODERATION | Пользователю выдан Мут' },
    unmute: { color: 0xfcd34d, title: 'MODERATION | Мут снят' },
    timeout: { color: 0xfcd34d, title: 'MODERATION | Пользователю выдан Тайм-аут' },
    untimeout: { color: 0xfcd34d, title: 'MODERATION | Тайм-аут снят' },
    kick: { color: 0xf59e0b, title: 'MODERATION | Пользователь кикнут' },
    ban: { color: 0xfb7185, title: 'MODERATION | Пользователь забанен' },
    tempban: { color: 0xfb7185, title: 'MODERATION | Пользователь временно забанен' },
    unban: { color: 0xfb7185, title: 'MODERATION | Бан снят' },
};

const MODERATION_EXPIRED_EVENT_TITLES: Record<string, string> = {
    unwarn: 'MODERATION | Варн истек и снят',
    unmute: 'MODERATION | Мут истек и снят',
    untimeout: 'MODERATION | Тайм-аут истек и снят',
    unban: 'MODERATION | Временный бан истек и снят',
};

const MODERATION_EVENT_TITLE_KEYS: Record<string, string> = {
    warn: 'audit.moderation.warn.title',
    unwarn: 'audit.moderation.unwarn.title',
    mute: 'audit.moderation.mute.title',
    unmute: 'audit.moderation.unmute.title',
    timeout: 'audit.moderation.timeout.title',
    untimeout: 'audit.moderation.untimeout.title',
    kick: 'audit.moderation.kick.title',
    ban: 'audit.moderation.ban.title',
    tempban: 'audit.moderation.tempban.title',
    unban: 'audit.moderation.unban.title',
};

const MODERATION_EXPIRED_EVENT_TITLE_KEYS: Record<string, string> = {
    unwarn: 'audit.moderation.unwarn.expired',
    unmute: 'audit.moderation.unmute.expired',
    untimeout: 'audit.moderation.untimeout.expired',
    unban: 'audit.moderation.unban.expired',
};

const DUPLICATE_DISPATCH_WINDOW_MS = 4000;
const DUPLICATE_PRONE_MODERATION_EVENTS = new Set(['ban', 'tempban', 'unban', 'kick', 'timeout', 'untimeout']);
const recentRouteDispatches = new Map<string, number>();

function truncate(value: string | null | undefined, max = MAX_PREVIEW) {
    if (!value) return '';
    if (value.length <= max) return value;
    return `${value.slice(0, max)}...`;
}

function tokenValue(input: AuditInput, key: string) {
    switch (key) {
        case 'tag':
            return input.tag;
        case 'actor':
            return input.actorId ? `<@${input.actorId}>` : 'unknown';
        case 'target':
            return input.targetId ? `<@${input.targetId}>` : 'unknown';
        case 'channel':
            return input.channelId ? `<#${input.channelId}>` : 'unknown';
        case 'messageId':
            return input.messageId || 'unknown';
        case 'event':
            return typeof input.payload?.event === 'string' ? String(input.payload.event) : 'event';
        case 'contentBefore':
            return truncate(typeof input.payload?.contentBefore === 'string' ? input.payload.contentBefore : '');
        case 'contentAfter':
            return truncate(typeof input.payload?.contentAfter === 'string' ? input.payload.contentAfter : '');
        default:
            return '';
    }
}

function renderTemplate(template: string, input: AuditInput) {
    return template.replace(/\{(\w+)\}/g, (_match, key) => tokenValue(input, key));
}

function getPayloadString(input: AuditInput, key: string) {
    const value = input.payload?.[key];
    return typeof value === 'string' ? value : null;
}

function getPayloadNumber(input: AuditInput, key: string) {
    const value = input.payload?.[key];
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function getPayloadBoolean(input: AuditInput, key: string) {
    return input.payload?.[key] === true;
}

function resolveModerationEvent(input: AuditInput) {
    if (input.tag !== 'moderation') return null;

    const rawEvent = getPayloadString(input, 'event');
    if (!rawEvent) return null;

    const canonicalEvent = MODERATION_EVENT_ALIASES[rawEvent] ?? rawEvent;
    const meta = MODERATION_EVENT_META[canonicalEvent];
    if (!meta) return null;

    return {
        canonicalEvent,
        ...meta,
    };
}

function pluralizeRu(value: number, one: string, few: string, many: string) {
    const normalized = Math.abs(value) % 100;
    const lastDigit = normalized % 10;

    if (normalized > 10 && normalized < 20) {
        return many;
    }
    if (lastDigit === 1) {
        return one;
    }
    if (lastDigit >= 2 && lastDigit <= 4) {
        return few;
    }
    return many;
}

function formatMinutesRu(totalMinutes: number) {
    const safeMinutes = Math.max(1, Math.round(totalMinutes));
    const days = Math.floor(safeMinutes / (24 * 60));
    const hours = Math.floor((safeMinutes % (24 * 60)) / 60);
    const minutes = safeMinutes % 60;
    const parts: string[] = [];

    if (days > 0) {
        parts.push(`${days} ${pluralizeRu(days, 'день', 'дня', 'дней')}`);
    }
    if (hours > 0) {
        parts.push(`${hours} ${pluralizeRu(hours, 'час', 'часа', 'часов')}`);
    }
    if (minutes > 0 || parts.length === 0) {
        parts.push(`${minutes} ${pluralizeRu(minutes, 'минута', 'минуты', 'минут')}`);
    }

    return parts.join(' ');
}

function getModerationDurationLabel(input: AuditInput, canonicalEvent: string) {
    if (getPayloadBoolean(input, 'expired')) {
        return 'Истекло';
    }

    const durationMinutes = getPayloadNumber(input, 'durationMinutes');
    if (durationMinutes && durationMinutes > 0) {
        return formatMinutesRu(durationMinutes);
    }

    const until = getPayloadString(input, 'until');
    if (until) {
        const untilTimestamp = new Date(until).getTime();
        if (!Number.isNaN(untilTimestamp)) {
            const diffMinutes = Math.max(1, Math.round((untilTimestamp - Date.now()) / 60000));
            return formatMinutesRu(diffMinutes);
        }
    }

    if (canonicalEvent.startsWith('un')) {
        return 'Снято';
    }

    if (canonicalEvent === 'kick') {
        return 'Моментально';
    }

    if (canonicalEvent === 'ban' || canonicalEvent === 'warn' || canonicalEvent === 'mute') {
        return 'Навсегда';
    }

    return 'Не указано';
}

function getModerationTitle(input: AuditInput, canonicalEvent: string, fallbackTitle: string) {
    if (getPayloadBoolean(input, 'expired')) {
        return MODERATION_EXPIRED_EVENT_TITLES[canonicalEvent] ?? fallbackTitle;
    }

    return fallbackTitle;
}

function formatMinutesEn(totalMinutes: number) {
    const safeMinutes = Math.max(1, Math.round(totalMinutes));
    const days = Math.floor(safeMinutes / (24 * 60));
    const hours = Math.floor((safeMinutes % (24 * 60)) / 60);
    const minutes = safeMinutes % 60;
    const parts: string[] = [];

    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0 || parts.length === 0) parts.push(`${minutes}m`);
    return parts.join(' ');
}

function formatMinutes(locale: LocaleCode, totalMinutes: number) {
    return locale === 'ru' ? formatMinutesRu(totalMinutes) : formatMinutesEn(totalMinutes);
}

function getLocalizedModerationDuration(locale: LocaleCode, input: AuditInput, canonicalEvent: string) {
    if (getPayloadBoolean(input, 'expired')) {
        return t(locale, 'audit.moderation.expired');
    }

    const durationMinutes = getPayloadNumber(input, 'durationMinutes');
    if (durationMinutes && durationMinutes > 0) {
        return formatMinutes(locale, durationMinutes);
    }

    const until = getPayloadString(input, 'until');
    if (until) {
        const untilTimestamp = new Date(until).getTime();
        if (!Number.isNaN(untilTimestamp)) {
            const diffMinutes = Math.max(1, Math.round((untilTimestamp - Date.now()) / 60000));
            return formatMinutes(locale, diffMinutes);
        }
    }

    if (canonicalEvent.startsWith('un')) {
        return t(locale, 'audit.moderation.cleared');
    }

    if (canonicalEvent === 'kick') {
        return t(locale, 'audit.moderation.instant');
    }

    if (canonicalEvent === 'ban' || canonicalEvent === 'warn' || canonicalEvent === 'mute') {
        return t(locale, 'audit.moderation.forever');
    }

    return t(locale, 'audit.moderation.notSpecified');
}

function getLocalizedModerationTitle(locale: LocaleCode, input: AuditInput, canonicalEvent: string, fallbackTitle: string) {
    if (getPayloadBoolean(input, 'expired')) {
        const expiredKey = MODERATION_EXPIRED_EVENT_TITLE_KEYS[canonicalEvent];
        return expiredKey ? t(locale, expiredKey) : fallbackTitle;
    }

    const titleKey = MODERATION_EVENT_TITLE_KEYS[canonicalEvent];
    return titleKey ? t(locale, titleKey) : fallbackTitle;
}

function buildModerationEmbedLocalized(
    locale: LocaleCode,
    input: AuditInput,
    actor: { tag: string; displayAvatarURL: (options?: { size?: number }) => string } | null,
    target: { id: string; displayAvatarURL: (options?: { size?: number }) => string } | null,
    routeTemplate?: string | null
) {
    const moderationEvent = resolveModerationEvent(input);
    if (!moderationEvent) return null;

    const reason = getPayloadString(input, 'reason') || t(locale, 'audit.moderation.notSpecified');
    const durationLabel = getLocalizedModerationDuration(locale, input, moderationEvent.canonicalEvent);
    const descriptionLines = [
        `**${getLocalizedModerationTitle(locale, input, moderationEvent.canonicalEvent, moderationEvent.title)}**`,
        '',
        `**${t(locale, 'audit.moderation.target')}:** ${input.targetId ? `<@${input.targetId}>` : t(locale, 'audit.moderation.notSpecified')}`,
        `**${t(locale, 'audit.moderation.actor')}:** ${input.actorId ? `<@${input.actorId}>` : t(locale, 'audit.moderation.system')}`,
    ];

    if (routeTemplate) {
        descriptionLines.push('', `> ${renderTemplate(routeTemplate, input)}`);
    }

    const embed = new EmbedBuilder()
        .setColor(moderationEvent.color)
        .setDescription(descriptionLines.join('\n'))
        .addFields(
            { name: '\u200b', value: `> **${t(locale, 'audit.moderation.reason')}**\n\`\`\`text\n${truncate(reason, 950) || t(locale, 'audit.moderation.notSpecified')}\n\`\`\``, inline: true },
            { name: '\u200b', value: `> **${t(locale, 'audit.moderation.duration')}**\n\`\`\`text\n${durationLabel}\n\`\`\``, inline: true }
        );

    if (actor) {
        embed.setAuthor({
            name: actor.tag,
            iconURL: actor.displayAvatarURL({ size: 128 }),
        });
    } else {
        embed.setAuthor({ name: t(locale, 'audit.moderation.system') });
    }

    if (target) {
        embed.setThumbnail(target.displayAvatarURL({ size: 256 }));
    }

    return embed;
}

function shouldSkipDuplicateDispatch(routeChannelId: string, input: AuditInput, canonicalEvent: string) {
    if (!DUPLICATE_PRONE_MODERATION_EVENTS.has(canonicalEvent)) {
        return false;
    }

    const actorId = input.actorId ?? 'system';
    const targetId = input.targetId ?? 'unknown';
    const key = `${routeChannelId}:${canonicalEvent}:${actorId}:${targetId}`;
    const now = Date.now();

    for (const [dispatchKey, timestamp] of recentRouteDispatches.entries()) {
        if (now - timestamp > DUPLICATE_DISPATCH_WINDOW_MS) {
            recentRouteDispatches.delete(dispatchKey);
        }
    }

    const previousTimestamp = recentRouteDispatches.get(key);
    if (previousTimestamp && now - previousTimestamp <= DUPLICATE_DISPATCH_WINDOW_MS) {
        return true;
    }

    recentRouteDispatches.set(key, now);
    return false;
}

function buildModerationEmbed(input: AuditInput, actor: { tag: string; displayAvatarURL: (options?: { size?: number }) => string } | null, target: { id: string; displayAvatarURL: (options?: { size?: number }) => string } | null, routeTemplate?: string | null) {
    const moderationEvent = resolveModerationEvent(input);
    if (!moderationEvent) return null;

    const reason = getPayloadString(input, 'reason') || 'Не указана';
    const durationLabel = getModerationDurationLabel(input, moderationEvent.canonicalEvent);
    const descriptionLines = [
        `**${getModerationTitle(input, moderationEvent.canonicalEvent, moderationEvent.title)}**`,
        '',
        `**Нарушитель:** ${input.targetId ? `<@${input.targetId}>` : 'Не указан'}`,
        `**Модератор:** ${input.actorId ? `<@${input.actorId}>` : 'Система'}`,
    ];

    if (routeTemplate) {
        descriptionLines.push('', `> ${renderTemplate(routeTemplate, input)}`);
    }

    const embed = new EmbedBuilder()
        .setColor(moderationEvent.color)
        .setDescription(descriptionLines.join('\n'))
        .addFields(
            { name: '\u200b', value: `> **ПРИЧИНА**\n\`\`\`text\n${truncate(reason, 950) || 'Не указана'}\n\`\`\``, inline: true },
            { name: '\u200b', value: `> **ВРЕМЯ**\n\`\`\`text\n${durationLabel}\n\`\`\``, inline: true }
        );

    if (actor) {
        embed.setAuthor({
            name: actor.tag,
            iconURL: actor.displayAvatarURL({ size: 128 }),
        });
    } else {
        embed.setAuthor({ name: 'Система' });
    }

    if (target) {
        embed.setThumbnail(target.displayAvatarURL({ size: 256 }));
    }

    return embed;
}

async function sendToRoute(client: Client, input: AuditInput) {
    const route = await prisma.auditTagRoute.findUnique({
        where: {
            guildId_tag: {
                guildId: input.guildId,
                tag: input.tag,
            },
        },
    });

    if (!route || !route.enabled) return;
    const routeChannelIds = parseAuditRouteChannelIds(route.channelId);
    if (!routeChannelIds.length) return;

    try {
        const locale = await getGuildLocale(input.guildId);
        const actor = input.actorId ? await client.users.fetch(input.actorId).catch(() => null) : null;
        const target = input.targetId ? await client.users.fetch(input.targetId).catch(() => null) : null;

        const moderationEvent = resolveModerationEvent(input);
        const moderationEmbed = buildModerationEmbedLocalized(locale, input, actor, target, route.template);
        if (moderationEmbed) {
            for (const routeChannelId of routeChannelIds) {
                try {
                    const channel = await client.channels.fetch(routeChannelId).catch(() => null);
                    if (!channel || !channel.isTextBased() || !('send' in channel)) continue;
                    if (moderationEvent && shouldSkipDuplicateDispatch(routeChannelId, input, moderationEvent.canonicalEvent)) {
                        continue;
                    }

                    await (channel as any).send({ embeds: [EmbedBuilder.from(moderationEmbed)] });
                } catch (channelError) {
                    logger.warn(`[AuditLog] Failed to route tag ${input.tag} to channel ${routeChannelId} for guild ${input.guildId}: ${channelError}`);
                }
            }
            return;
        }

        const eventLabel = typeof input.payload?.event === 'string' ? input.payload.event : 'System Event';
        const color = TAG_COLORS[input.tag] || 0x2b2d31;

        const embed = new EmbedBuilder()
            .setColor(color)
            .setTimestamp();

        // Right side Thumbnail (Actor avatar)
        if (actor) {
            embed.setThumbnail(actor.displayAvatarURL({ size: 128 }));
        }

        // Action Description
        let description = `### ${eventLabel}\n`;

        if (input.payload?.event === 'message_delete') {
            if (actor) {
                description += `**Deleted By:** ${actor} (\`${actor.id}\`)\n`;
            }
            if (target && target.id !== actor?.id) {
                description += `**Message Author:** ${target} (\`${target.id}\`)\n`;
            } else if (target) {
                description += `**Message Author:** ${target} (\`${target.id}\`)\n`;
            }
        } else if (input.payload?.event === 'voice_move') {
            if (actor) {
                description += `**User:** ${actor} (\`${actor.id}\`)\n`;
            }
            const fromId = String(input.payload.fromChannelId);
            const toId = String(input.payload.toChannelId);
            description += `**From:** <#${fromId}>\n`;
            description += `**To:** <#${toId}>\n`;
        } else {
            if (actor) {
                description += `**Author:** ${actor} (\`${actor.id}\`)\n`;
            }
            if (target) {
                description += `**Target:** ${target} (\`${target.id}\`)\n`;
            }
        }

        if (input.channelId && input.payload?.event !== 'voice_move') {
            description += `**Channel:** <#${input.channelId}>\n`;
        }

        if (input.payload?.reason) {
            description += `**Reason:** ${input.payload.reason}\n`;
        }

        // Custom template (pushed into a blockquote if exists)
        if (route.template) {
            description += `\n> ${renderTemplate(route.template, input)}`;
        }

        // Content Diffing
        const contentBefore = input.payload?.contentBefore;
        const contentAfter = input.payload?.contentAfter;

        if (contentBefore || contentAfter) {
            if (contentBefore && contentAfter) {
                embed.addFields(
                    { name: 'Deleted/Old Content', value: `\`\`\`${truncate(String(contentBefore), 1000)}\`\`\`` },
                    { name: 'New Content', value: `\`\`\`${truncate(String(contentAfter), 1000)}\`\`\`` }
                );
            } else if (contentAfter) {
                embed.addFields({ name: 'Content', value: `\`\`\`${truncate(String(contentAfter), 1000)}\`\`\`` });
            } else if (contentBefore) {
                embed.addFields({ name: 'Deleted Content', value: `\`\`\`${truncate(String(contentBefore), 1000)}\`\`\`` });
            }
        }

        if (input.payload?.until) {
            const untilTime = new Date(String(input.payload.until)).getTime();
            const now = Date.now();
            const durationMs = untilTime - now;

            if (durationMs > 0) {
                const minutes = Math.round(durationMs / 60000);
                const hours = Math.floor(minutes / 60);
                const days = Math.floor(hours / 24);

                let durationStr = '';
                if (days > 0) durationStr = `${days}d ${hours % 24}h`;
                else if (hours > 0) durationStr = `${hours}h ${minutes % 60}m`;
                else durationStr = `${minutes}m`;

                embed.addFields(
                    { name: 'Duration', value: durationStr, inline: true },
                    { name: 'Until', value: `<t:${Math.floor(untilTime / 1000)}:F>`, inline: true }
                );
            }
        }

        // Attachments
        const attachments = input.payload?.attachments as any[] | undefined;
        if (Array.isArray(attachments) && attachments.length > 0) {
            const links = attachments.map(a => `[${a.name || 'File'}](${a.url})`).join(' • ');
            embed.addFields({ name: 'Attachments', value: links });
        }

        embed.setDescription(description);
        embed.setFooter({ text: `Audit Log • ${input.tag.toUpperCase()}` });

        for (const routeChannelId of routeChannelIds) {
            try {
                const channel = await client.channels.fetch(routeChannelId).catch(() => null);
                if (!channel || !channel.isTextBased() || !('send' in channel)) continue;
                await (channel as any).send({ embeds: [EmbedBuilder.from(embed)] });
            } catch (channelError) {
                logger.warn(`[AuditLog] Failed to route tag ${input.tag} to channel ${routeChannelId} for guild ${input.guildId}: ${channelError}`);
            }
        }
    } catch (error) {
        logger.warn(`[AuditLog] Failed to route tag ${input.tag} for guild ${input.guildId}: ${error}`);
    }
}

export async function buildAuditPreview(client: Client, input: AuditInput) {
    const locale = await getGuildLocale(input.guildId);
    const actor = input.actorId ? await client.users.fetch(input.actorId).catch(() => null) : null;
    const target = input.targetId ? await client.users.fetch(input.targetId).catch(() => null) : null;
    const route = await prisma.auditTagRoute.findUnique({
        where: {
            guildId_tag: {
                guildId: input.guildId,
                tag: input.tag,
            },
        },
        select: {
            template: true,
        },
    }).catch(() => null);

    const moderationEmbed = buildModerationEmbedLocalized(locale, input, actor, target, route?.template ?? null);
    if (!moderationEmbed) {
        return null;
    }

    return {
        embeds: [moderationEmbed],
    };
}

export async function logAuditEvent(client: Client, input: AuditInput) {
    // Enrich payload with tags for the dashboard/UI
    const enrichedPayload = { ...(input.payload || {}) };

    try {
        if (input.actorId) {
            const actor = await client.users.fetch(input.actorId).catch(() => null);
            if (actor) enrichedPayload.actorTag = actor.tag;
        }
        if (input.targetId) {
            const target = await client.users.fetch(input.targetId).catch(() => null);
            if (target) enrichedPayload.targetTag = target.tag;
        }

        await statsPrisma.auditLogEvent.create({
            data: {
                guildId: input.guildId,
                tag: input.tag,
                actorId: input.actorId || null,
                targetId: input.targetId || null,
                channelId: input.channelId || null,
                messageId: input.messageId || null,
                severity: input.severity || null,
                payload: JSON.stringify(enrichedPayload),
            },
        });
    } catch (error) {
        logger.error('[AuditLog] Failed to write audit event:', error);
        return;
    }

    await sendToRoute(client, {
        ...input,
        payload: enrichedPayload,
    });
}
