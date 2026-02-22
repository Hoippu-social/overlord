import { Events } from 'discord.js';
import logger from '../utils/logger';
import { syncGuildData } from '../utils/guildSync';

export default {
    name: Events.GuildCreate,
    async execute(guild: any) {
        try {
            await syncGuildData(guild);
            logger.info(`[GuildCreate] Synced guild ${guild?.name ?? 'unknown'} (${guild?.id ?? 'unknown'})`);
        } catch (error) {
            logger.error(`[GuildCreate] Failed to sync guild ${guild?.id ?? 'unknown'}:`, error);
        }
    },
};

