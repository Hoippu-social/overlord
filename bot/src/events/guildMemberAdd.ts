import { Events, GuildMember } from 'discord.js';
import logger from '../utils/logger';
import { prisma, statsPrisma } from '../utils/database';
import { getInviteAttribution } from '../utils/inviteTracker';
import { logAuditEvent } from '../utils/auditLog';
import { StatsService } from '../services/StatsService';
import { syncGuildRealtimeCounts } from '../utils/guildSync';

export default {
    name: Events.GuildMemberAdd,
    once: false,
    async execute(member: GuildMember) {
        const guildId = member.guild.id;
        const joinedAt = member.joinedAt ?? new Date();

        await syncGuildRealtimeCounts(member.guild);

        // Track member join in stats
        await StatsService.trackMemberJoin(guildId, member.id, joinedAt);

        const attribution = await getInviteAttribution(member.guild);
        const code = attribution.code;
        const inviterId = attribution.inviterId;

        try {
            await statsPrisma.inviteUseEvent.create({
                data: {
                    guildId,
                    memberId: member.id,
                    inviterId,
                    code,
                    joinedAt,
                },
            });
        } catch (error) {
            logger.warn(`[Invites] Failed to save invite use for ${guildId}/${member.id}: ${error}`);
        }

        await logAuditEvent(member.client, {
            guildId,
            tag: 'invites',
            actorId: inviterId,
            targetId: member.id,
            payload: {
                event: 'invite_join',
                memberId: member.id,
                inviterId,
                code,
            },
            severity: 'INFO',
        });
    },
};
