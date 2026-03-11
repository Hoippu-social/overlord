import { LavalinkManager, Player } from 'lavalink-client';
import { Client } from 'discord.js';
import logger from './logger';
import { MusicPlayerHandler } from './MusicPlayerHandler';

// Extend Player to include our handler
declare module 'lavalink-client' {
    interface Player {
        musicHandler?: MusicPlayerHandler;
    }
}

export function initializeLavalink(client: Client) {
    client.lavalink = new LavalinkManager({
        nodes: [
            {
                authorization: process.env.LAVALINK_PASSWORD || 'youshallnotpass',
                host: process.env.LAVALINK_HOST || 'localhost',
                port: parseInt(process.env.LAVALINK_PORT || '2333'),
                id: 'LocalNode',
            },
        ],
        sendToShard: (guildId, payload) => {
            const guild = client.guilds.cache.get(guildId);
            if (guild) guild.shard.send(payload);
        },
        autoSkip: true,
        client: {
            id: client.user?.id || '',
            username: client.user?.username || 'Bot',
        },
    });

    client.lavalink.nodeManager.on('connect', (node) => {
        logger.info(`[Lavalink] Node ${node.id} connected`);
    });

    client.lavalink.nodeManager.on('error', (node, error) => {
        logger.error(`[Lavalink] Node ${node.id} error:`, error);
    });

    client.lavalink.nodeManager.on('disconnect', (node, reason) => {
        logger.warn(`[Lavalink] Node ${node.id} disconnected:`, reason);
    });

    // Player Events
    client.lavalink.on('playerCreate', (player) => {
        player.musicHandler = new MusicPlayerHandler(player, client);
    });

    client.lavalink.on('playerDestroy', (player) => {
        player.musicHandler?.destroy();
    });

    client.lavalink.on('trackStart', async (player, track) => {
        if (!track) return;
        await player.musicHandler?.sendNowPlaying(track);
    });

    client.lavalink.on('trackEnd', async (player, track, payload) => {
        // Add track to history when it FINISHES, not when it starts
        if (track) {
            player.musicHandler?.addToHistory(track);
        }
    });

    client.lavalink.on('queueEnd', async (player) => {
        await player.musicHandler?.destroy();
        // Optional: Send "Queue finished" message
        const channel = client.channels.cache.get(player.textChannelId!) as any;
        if (channel) channel.send('Queue finished! Disconnecting...');
        player.destroy();
    });
}
