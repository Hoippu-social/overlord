import { Events, GuildMember, AuditLogEvent } from 'discord.js';
import { logAuditEvent } from '../utils/auditLog';

export default {
    name: Events.GuildMemberUpdate,
    once: false,
    async execute(oldMember: GuildMember, newMember: GuildMember) {
        if (oldMember.nickname !== newMember.nickname) {
            await logAuditEvent(newMember.client, {
                guildId: newMember.guild.id,
                tag: 'member',
                actorId: newMember.id,
                targetId: newMember.id,
                payload: {
                    event: 'nickname_change',
                    oldNickname: oldMember.nickname,
                    newNickname: newMember.nickname,
                },
                severity: 'INFO',
            });
        }

        const oldBoost = !!oldMember.premiumSince;
        const newBoost = !!newMember.premiumSince;
        if (!oldBoost && newBoost) {
            await logAuditEvent(newMember.client, {
                guildId: newMember.guild.id,
                tag: 'member',
                actorId: newMember.id,
                targetId: newMember.id,
                payload: {
                    event: 'boost_start',
                    userId: newMember.id,
                },
                severity: 'INFO',
            });
        }

        if (oldBoost && !newBoost) {
            await logAuditEvent(newMember.client, {
                guildId: newMember.guild.id,
                tag: 'member',
                actorId: newMember.id,
                targetId: newMember.id,
                payload: {
                    event: 'boost_stop',
                    userId: newMember.id,
                },
                severity: 'INFO',
            });
        }

        const oldTimeout = oldMember.communicationDisabledUntil;
        const newTimeout = newMember.communicationDisabledUntil;

        if (oldTimeout !== newTimeout) {
            let actorId = null;
            let reason = null;

            try {
                const auditLogs = await newMember.guild.fetchAuditLogs({
                    limit: 1,
                    type: AuditLogEvent.MemberUpdate,
                });
                const entry = auditLogs.entries.first();

                if (entry && entry.targetId === newMember.id) {
                    if (Date.now() - entry.createdTimestamp < 5000) {
                        const hasCommChange = entry.changes.some(c => c.key === 'communication_disabled_until');
                        if (hasCommChange) {
                            actorId = entry.executorId;
                            reason = entry.reason;
                        }
                    }
                }
            } catch (error) {
                // Ignore missing permissions
            }

            if (!oldTimeout && newTimeout) {
                await logAuditEvent(newMember.client, {
                    guildId: newMember.guild.id,
                    tag: 'moderation',
                    actorId,
                    targetId: newMember.id,
                    payload: {
                        event: 'member_timeout',
                        userId: newMember.id,
                        reason,
                        until: newTimeout.toISOString(),
                    },
                    severity: 'WARN',
                });
            } else if (oldTimeout && !newTimeout) {
                await logAuditEvent(newMember.client, {
                    guildId: newMember.guild.id,
                    tag: 'moderation',
                    actorId,
                    targetId: newMember.id,
                    payload: {
                        event: 'member_timeout_remove',
                        userId: newMember.id,
                    },
                    severity: 'INFO',
                });
            }
        }
    },
};
