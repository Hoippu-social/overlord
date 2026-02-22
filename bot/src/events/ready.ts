import { Events, Client } from 'discord.js';
import logger from '../utils/logger';
import { primeInviteCache } from '../utils/inviteTracker';
import { reconcileTempVoiceRooms } from '../utils/tempVoice';
import { startDashboardApi } from '../utils/dashboardApi';
import { syncGuildData } from '../utils/guildSync';
import { initVoiceSessions } from './voiceAudit';

export default {
    name: Events.ClientReady,
    once: true,
    async execute(client: Client) {
        logger.info(`Logged in as ${client.user?.tag}!`);

        // Initialize Lavalink Client with user data
        try {
            client.lavalink.init({
                id: client.user!.id,
                username: client.user!.username
            });
        } catch (error) {
            logger.warn('[Lavalink] Failed to initialize — music features will be unavailable:', error);
        }

        // Sync Guild Data
        logger.info('Syncing guild data...');
        for (const guild of client.guilds.cache.values()) {
            try {
                await syncGuildData(guild);
            } catch (error) {
                logger.error(`Failed to sync guild ${guild.name} (${guild.id}):`, error);
            }
        }
        logger.info('Guild data synced!');

        logger.info('Initializing voice sessions...');
        await initVoiceSessions(client);
        logger.info('Reconciling temp voice rooms...');
        await reconcileTempVoiceRooms(client);

        logger.info('Priming invite cache...');
        await primeInviteCache(client);

        // Start Dashboard API
        (client as any).dashboardServer = startDashboardApi(client);
    },
};
