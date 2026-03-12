import { Events, GuildMember, AuditLogEvent } from 'discord.js';
import logger from '../utils/logger';
import { prisma, statsPrisma } from '../utils/database';
import { logAuditEvent } from '../utils/auditLog';
import { StatsService } from '../services/StatsService';
import { syncGuildRealtimeCounts } from '../utils/guildSync';

export default {
    name: Events.GuildMemberRemove,
    once: false,
    async execute(member: GuildMember) {
        const guildId = member.guild.id;
        const leftAt = new Date();

        await syncGuildRealtimeCounts(member.guild);

        // Track member leave in stats
        await StatsService.trackMemberLeave(guildId, member.id, leftAt);

        // Check for Kick
        try {
            const auditLogs = await member.guild.fetchAuditLogs({
                limit: 1,
                type: AuditLogEvent.MemberKick,
            });
            const entry = auditLogs.entries.first();

            if (entry && entry.targetId === member.id) {
                if (Date.now() - entry.createdTimestamp < 5000) {
                    await logAuditEvent(member.client, {
                        guildId,
                        tag: 'moderation',
                        actorId: entry.executorId,
                        targetId: member.id,
                        payload: {
                            event: 'member_kick',
                            userId: member.id,
                            reason: entry.reason ?? null,
                        },
                        severity: 'WARN',
                    });
                }
            }
        } catch (error) {
            // Missing permissions or other errors
        }

        const existing = await statsPrisma.inviteUseEvent.findFirst({
            where: {
                guildId,
                memberId: member.id,
                leftAt: null,
            },
            orderBy: { joinedAt: 'desc' },
        });

        let inviterId = existing?.inviterId ?? null;
        let code = existing?.code ?? null;
        let stayDurationSec = null;
        let voiceDurationSec = existing?.voiceDurationSec ?? null;

        if (existing) {
            stayDurationSec = Math.max(0, Math.floor((leftAt.getTime() - existing.joinedAt.getTime()) / 1000));
            try {
                await statsPrisma.inviteUseEvent.update({
                    where: { id: existing.id },
                    data: {
                        leftAt,
                        stayDurationSec,
                    },
                });
            } catch (error) {
                logger.warn(`[Invites] Failed to update leave summary for ${guildId}/${member.id}: ${error}`);
            }
        }

        await logAuditEvent(member.client, {
            guildId,
            tag: 'invites',
            actorId: inviterId,
            targetId: member.id,
            payload: {
                event: 'invite_leave',
                memberId: member.id,
                inviterId,
                code,
                stayDurationSec,
                voiceDurationSec,
            },
            severity: 'INFO',
        });
    },
};
