import { Channel, Events } from 'discord.js';
import { logAuditEvent } from '../utils/auditLog';

export default {
    name: Events.ChannelCreate,
    once: false,
    async execute(channel: Channel) {
        if (!('guild' in channel)) return;

        await logAuditEvent(channel.client, {
            guildId: channel.guild.id,
            tag: 'channel',
            channelId: channel.id,
            payload: {
                event: 'channel_create',
                name: (channel as any).name ?? null,
                type: channel.type,
            },
            severity: 'INFO',
        });
    },
};
