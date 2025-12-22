import { Events, GuildBan } from 'discord.js';
import { logAuditEvent } from '../utils/auditLog';

export default {
    name: Events.GuildBanRemove,
    once: false,
    async execute(ban: GuildBan) {
        await logAuditEvent(ban.client, {
            guildId: ban.guild.id,
            tag: 'moderation',
            targetId: ban.user.id,
            payload: {
                event: 'ban_remove',
                userId: ban.user.id,
                reason: ban.reason ?? null,
            },
            severity: 'INFO',
        });
    },
};
