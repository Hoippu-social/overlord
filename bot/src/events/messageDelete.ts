import { Events, Message } from 'discord.js';
import logger from '../utils/logger';
import { prisma } from '../utils/database';
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
    name: Events.MessageDelete,
    once: false,
    async execute(message: Message) {
        if (!message.guildId) return;

        const authorId = message.author?.id || null;
        const contentBefore = typeof message.content === 'string' ? message.content : null;
        const attachments = serializeAttachments(message);

        try {
            await prisma.messageEvent.create({
                data: {
                    guildId: message.guildId,
                    channelId: message.channelId,
                    messageId: message.id,
                    authorId,
                    eventType: 'DELETE',
                    isBot: message.author?.bot ?? false,
                    contentBefore,
                    attachmentsBefore: attachments.length ? JSON.stringify(attachments) : null,
                },
            });
        } catch (error) {
            logger.error('[AuditLog] Failed to persist message delete event:', error);
        }

        await logAuditEvent(message.client, {
            guildId: message.guildId,
            tag: 'message',
            actorId: authorId,
            targetId: authorId,
            channelId: message.channelId,
            messageId: message.id,
            payload: {
                event: 'message_delete',
                authorId,
                contentBefore,
                attachments,
            },
            severity: 'INFO',
        });
    },
};
