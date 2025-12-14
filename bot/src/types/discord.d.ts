import { LavalinkManager } from 'lavalink-client';

declare module 'discord.js' {
    interface Client {
        lavalink: LavalinkManager;
    }
}
