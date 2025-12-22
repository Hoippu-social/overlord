import { Events, Role } from 'discord.js';
import { logAuditEvent } from '../utils/auditLog';

export default {
    name: Events.GuildRoleUpdate,
    once: false,
    async execute(oldRole: Role, newRole: Role) {
        if (oldRole.name === newRole.name && oldRole.hexColor === newRole.hexColor) return;

        await logAuditEvent(newRole.client, {
            guildId: newRole.guild.id,
            tag: 'role',
            payload: {
                event: 'role_update',
                roleId: newRole.id,
                oldName: oldRole.name,
                newName: newRole.name,
                oldColor: oldRole.hexColor,
                newColor: newRole.hexColor,
            },
            severity: 'INFO',
        });
    },
};
