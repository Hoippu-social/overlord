import { Events, Role } from 'discord.js';
import { logAuditEvent } from '../utils/auditLog';

export default {
    name: Events.GuildRoleDelete,
    once: false,
    async execute(role: Role) {
        await logAuditEvent(role.client, {
            guildId: role.guild.id,
            tag: 'role',
            payload: {
                event: 'role_delete',
                roleId: role.id,
                name: role.name,
                color: role.hexColor,
            },
            severity: 'INFO',
        });
    },
};
