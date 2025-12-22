import { Client, EmbedBuilder } from 'discord.js';
import logger from './logger';
import { prisma } from './database';

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
    member: 0x5865f2,     // Blurple
    message: 0xfee75c,    // Yellow
    channel: 0xeb459f,    // Pink
    role: 0x5865f2,       // Blurple
    voice: 0x2ecc71,      // Emerald
    invites: 0xe67e22,    // Orange
    security: 0xed4245,   // Red
    bot: 0x9b59b6,        // Purple
};

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

    try {
        const channel = await client.channels.fetch(route.channelId);
        if (!channel || !channel.isTextBased() || !('send' in channel)) return;

        // Fetch users for premium data
        const actor = input.actorId ? await client.users.fetch(input.actorId).catch(() => null) : null;
        const target = input.targetId ? await client.users.fetch(input.targetId).catch(() => null) : null;

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

        if (actor) {
            description += `**Author:** ${actor} (\`${actor.id}\`)\n`;
        }
        if (target) {
            description += `**Target:** ${target} (\`${target.id}\`)\n`;
        }
        if (input.channelId) {
            description += `**Channel:** <#${input.channelId}>\n`;
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

        // Attachments
        const attachments = input.payload?.attachments as any[] | undefined;
        if (Array.isArray(attachments) && attachments.length > 0) {
            const links = attachments.map(a => `[${a.name || 'File'}](${a.url})`).join(' • ');
            embed.addFields({ name: 'Attachments', value: links });
        }

        embed.setDescription(description);
        embed.setFooter({ text: `Audit Log • ${input.tag.toUpperCase()}` });

        await (channel as any).send({ embeds: [embed] });
    } catch (error) {
        logger.warn(`[AuditLog] Failed to route tag ${input.tag} for guild ${input.guildId}: ${error}`);
    }
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

        await prisma.auditLogEvent.create({
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

    // Pass the enriched input to sendToRoute if needed, 
    // though sendToRoute currently does its own fetching.
    // To avoid double-fetching, let's update sendToRoute too? 
    // Actually, sendToRoute is fine for now as it's separate.
    await sendToRoute(client, input);
}
