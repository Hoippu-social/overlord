import { Collection, Events, Message } from 'discord.js';
import logger from '../utils/logger';
import { prisma, statsPrisma } from '../utils/database';
import { logAuditEvent } from '../utils/auditLog';

function serializeAttachments(message: Message) {
    return Array.from(message.attachments.values()).map((att) => ({
        id: att.id,
        name: att.name,
        contentType: att.contentType,
        size: att.size,
        url: att.url,
        proxyUrl: att.proxyURL,
    }));
}

export default {
    name: Events.MessageBulkDelete,
    once: false,
    async execute(messages: Collection<string, Message>) {
        const sample = messages.first();
        if (!sample?.guildId) return;

        const guildId = sample.guildId;
        const channelId = sample.channelId;

        const rows = Array.from(messages.values())
            .filter((message) => message.guildId)
            .map((message) => ({
                guildId,
                channelId: message.channelId,
                messageId: message.id,
                authorId: message.author?.id ?? null,
                eventType: 'DELETE',
                isBot: message.author?.bot ?? false,
                contentBefore: typeof message.content === 'string' ? message.content : null,
                attachmentsBefore: serializeAttachments(message).length
                    ? JSON.stringify(serializeAttachments(message))
                    : null,
            }));

        if (rows.length) {
            try {
                await statsPrisma.messageEvent.createMany({ data: rows });
            } catch (error) {
                logger.error('[AuditLog] Failed to persist bulk delete events:', error);
            }
        }

        await logAuditEvent(sample.client, {
            guildId,
            tag: 'moderation',
            channelId,
            payload: {
                event: 'message_delete_bulk',
                count: rows.length,
            },
            severity: 'WARN',
        });
    },
};
