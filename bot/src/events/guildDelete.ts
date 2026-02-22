import { Events } from 'discord.js';
import logger from '../utils/logger';
import { cleanupGuildData } from '../utils/guildSync';

export default {
    name: Events.GuildDelete,
    async execute(guild: any) {
        const guildId = guild?.id;
        if (!guildId) return;
        await cleanupGuildData(guildId);
        logger.info(`[GuildDelete] Cleaned up guild ${guildId}`);
    },
};

