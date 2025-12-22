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
    name: Events.MessageUpdate,
    once: false,
    async execute(oldMessage: Message, newMessage: Message) {
        const guildId = newMessage.guildId || oldMessage.guildId;
        if (!guildId) return;

        let before = typeof oldMessage.content === 'string' ? oldMessage.content : null;
        let after = typeof newMessage.content === 'string' ? newMessage.content : null;
        let attachmentsBefore = serializeAttachments(oldMessage);
        let attachmentsAfter = serializeAttachments(newMessage);

        if (newMessage.partial) {
            try {
                const fetched = await newMessage.fetch();
                after = typeof fetched.content === 'string' ? fetched.content : after;
                attachmentsAfter = serializeAttachments(fetched as Message);
            } catch (error) {
                logger.warn(`[AuditLog] Failed to fetch updated message ${newMessage.id}: ${error}`);
            }
        }

        if (before === after && attachmentsBefore.length === attachmentsAfter.length) return;

        const authorId = newMessage.author?.id || oldMessage.author?.id || null;

        try {
            await prisma.messageEvent.create({
                data: {
                    guildId,
                    channelId: newMessage.channelId || oldMessage.channelId,
                    messageId: newMessage.id,
                    authorId,
                    eventType: 'EDIT',
                    isBot: newMessage.author?.bot ?? oldMessage.author?.bot ?? false,
                    contentBefore: before,
                    contentAfter: after,
                    attachmentsBefore: attachmentsBefore.length ? JSON.stringify(attachmentsBefore) : null,
                    attachmentsAfter: attachmentsAfter.length ? JSON.stringify(attachmentsAfter) : null,
                },
            });
        } catch (error) {
            logger.error('[AuditLog] Failed to persist message edit event:', error);
        }

        await logAuditEvent(newMessage.client, {
            guildId,
            tag: 'message',
            actorId: authorId,
            targetId: authorId,
            channelId: newMessage.channelId || oldMessage.channelId,
            messageId: newMessage.id,
            payload: {
                event: 'message_edit',
                authorId,
                contentBefore: before,
                contentAfter: after,
                attachmentsBefore,
                attachmentsAfter,
            },
            severity: 'INFO',
        });
    },
};
