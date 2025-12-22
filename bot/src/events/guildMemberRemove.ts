import { Events, GuildMember } from 'discord.js';
import logger from '../utils/logger';
import { prisma } from '../utils/database';
import { logAuditEvent } from '../utils/auditLog';

export default {
    name: Events.GuildMemberRemove,
    once: false,
    async execute(member: GuildMember) {
        const guildId = member.guild.id;
        const leftAt = new Date();

        const existing = await prisma.inviteUseEvent.findFirst({
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
                await prisma.inviteUseEvent.update({
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
