import { Events, Message, AuditLogEvent } from 'discord.js';
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
    name: Events.MessageDelete,
    once: false,
    async execute(message: Message) {
        if (!message.guild || !message.guildId) return;

        const authorId = message.author?.id || null;
        let executorId = authorId;
        const contentBefore = typeof message.content === 'string' ? message.content : null;
        const attachments = serializeAttachments(message);

        try {
            const auditLogs = await message.guild.fetchAuditLogs({
                limit: 1,
                type: AuditLogEvent.MessageDelete,
            });
            const entry = auditLogs.entries.first();

            if (entry && entry.targetId === authorId && entry.extra.channel.id === message.channelId) {
                if (Date.now() - entry.createdTimestamp < 5000) {
                    executorId = entry.executorId || authorId;
                }
            }
        } catch (error) {
            // Missing permissions or other errors
            logger.debug(`[AuditLog] Could not fetch audit logs for messageDelete in ${message.guildId}`);
        }

        try {
            await statsPrisma.messageEvent.create({
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
            actorId: executorId,
            targetId: authorId,
            channelId: message.channelId,
            messageId: message.id,
            payload: {
                event: 'message_delete',
                authorId,
                executorId,
                contentBefore,
                attachments,
            },
            severity: 'INFO',
        });
    },
};
