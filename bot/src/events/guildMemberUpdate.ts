import { Events, GuildMember } from 'discord.js';
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
    },
};
