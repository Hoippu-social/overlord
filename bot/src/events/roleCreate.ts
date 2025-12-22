import { Events, Role } from 'discord.js';
import { logAuditEvent } from '../utils/auditLog';

export default {
    name: Events.GuildRoleCreate,
    once: false,
    async execute(role: Role) {
        await logAuditEvent(role.client, {
            guildId: role.guild.id,
            tag: 'role',
            payload: {
                event: 'role_create',
                roleId: role.id,
                name: role.name,
                color: role.hexColor,
            },
            severity: 'INFO',
        });
    },
};
