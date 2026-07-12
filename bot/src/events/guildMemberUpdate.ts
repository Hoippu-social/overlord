import { Events, GuildMember, AuditLogEvent } from 'discord.js';
import { logAuditEvent } from '../utils/auditLog';
import { EconomyService } from '../services/EconomyService';
import { prisma } from '../utils/database';
import logger from '../utils/logger';

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

            applyBoosterOneTimeBonus(newMember).catch((err) =>
                logger.error('[Economy] Failed to apply booster one-time bonus', err)
            );
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
            let skipModerationLog = false;

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
                            if (entry.executorId === newMember.client.user?.id) {
                                skipModerationLog = true;
                            }
                            actorId = entry.executorId;
                            reason = entry.reason;
                        }
                    }
                }
            } catch (error) {
                // Ignore missing permissions
            }

            if (!skipModerationLog && !oldTimeout && newTimeout) {
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
            } else if (!skipModerationLog && oldTimeout && !newTimeout) {
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

async function applyBoosterOneTimeBonus(member: GuildMember): Promise<void> {
    const guildId = member.guild.id;
    if (!(await EconomyService.isSourceEnabled(guildId, 'BOOSTER'))) return;

    const row = await prisma.economyEarnSource.findUnique({
        where: { guildId_source: { guildId, source: 'BOOSTER' } },
    });
    let oneTimeBonus = 0;
    if (row?.settings) {
        try {
            const parsed = JSON.parse(row.settings);
            if (Number.isFinite(parsed.oneTimeBonus)) oneTimeBonus = parsed.oneTimeBonus;
        } catch {
            // fall through with default
        }
    }
    if (oneTimeBonus <= 0) return;

    const premiumSince = member.premiumSinceTimestamp ?? Date.now();
    await EconomyService.credit(
        {
            guildId,
            userId: member.id,
            account: 'WALLET',
            amount: BigInt(oneTimeBonus),
            type: 'BOOSTER_BONUS',
            idempotencyKey: `booster_bonus:${guildId}:${member.id}:${premiumSince}`,
        },
        member.client
    );
}
