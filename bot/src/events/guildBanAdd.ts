import { Events, GuildBan, AuditLogEvent } from 'discord.js';
import { logAuditEvent } from '../utils/auditLog';

export default {
    name: Events.GuildBanAdd,
    once: false,
    async execute(ban: GuildBan) {
        let actorId = null;

        try {
            const auditLogs = await ban.guild.fetchAuditLogs({
                limit: 1,
                type: AuditLogEvent.MemberBanAdd,
            });
            const entry = auditLogs.entries.first();

            if (entry && entry.targetId === ban.user.id) {
                if (Date.now() - entry.createdTimestamp < 5000) {
                    if (entry.executorId === ban.client.user?.id) {
                        return;
                    }
                    actorId = entry.executorId;
                }
            }
        } catch (error) {
            // Missing permissions or other errors
        }

        await logAuditEvent(ban.client, {
            guildId: ban.guild.id,
            tag: 'moderation',
            actorId,
            targetId: ban.user.id,
            payload: {
                event: 'ban_add',
                userId: ban.user.id,
                reason: ban.reason ?? null,
            },
            severity: 'WARN',
        });
    },
};
