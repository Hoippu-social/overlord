import { PermissionsBitField } from 'discord.js';
import { Command } from './types';

export function getCommandDefaultMemberPermissions(command: Command<any>) {
    const payload = command.data.toJSON() as { default_member_permissions?: string | null };
    const rawValue = payload.default_member_permissions;

    if (rawValue === undefined || rawValue === null || rawValue === '0') {
        return null;
    }

    try {
        return new PermissionsBitField(BigInt(rawValue));
    } catch {
        return null;
    }
}
