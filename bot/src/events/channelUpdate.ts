import { Channel, Events } from 'discord.js';
import { logAuditEvent } from '../utils/auditLog';

export default {
    name: Events.ChannelUpdate,
    once: false,
    async execute(oldChannel: Channel, newChannel: Channel) {
        if (!('guild' in newChannel)) return;

        const oldName = (oldChannel as any).name ?? null;
        const newName = (newChannel as any).name ?? null;
        const oldParent = (oldChannel as any).parentId ?? null;
        const newParent = (newChannel as any).parentId ?? null;

        if (oldName === newName && oldParent === newParent) return;

        await logAuditEvent(newChannel.client, {
            guildId: newChannel.guild.id,
            tag: 'channel',
            channelId: newChannel.id,
            payload: {
                event: 'channel_update',
                oldName,
                newName,
                oldParent,
                newParent,
            },
            severity: 'INFO',
        });
    },
};
