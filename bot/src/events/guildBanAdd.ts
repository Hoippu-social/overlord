import { Events, GuildBan, AuditLogEvent } from 'discord.js';
import { logAuditEvent } from '../utils/auditLog';
import { EconomyService } from '../services/EconomyService';
import logger from '../utils/logger';

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

        try {
            const economyConfig = await EconomyService.getConfig(ban.guild.id);
            if (economyConfig.confiscateOnBan) {
                await EconomyService.confiscate(
                    { guildId: ban.guild.id, userId: ban.user.id, reason: 'ban', actorId },
                    ban.client
                );
            }
        } catch (err) {
            logger.error('[Economy] Failed to confiscate balance on ban', err);
        }
    },
};
