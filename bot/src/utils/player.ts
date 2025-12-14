import { Client } from 'discord.js';
import { Player } from 'discord-player';
import { DefaultExtractors, SpotifyExtractor, SoundCloudExtractor } from '@discord-player/extractor';
import logger from './logger';
import { botLog } from './botActivity';

let player: Player | null = null;

export const initializePlayer = async (client: Client) => {
    // Initialize player
    player = new Player(client);

    await player.extractors.loadMulti(DefaultExtractors);

    // Register Spotify Extractor
    if (process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET) {
        await player.extractors.register(SpotifyExtractor, {
            clientId: process.env.SPOTIFY_CLIENT_ID,
            clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
        });
        logger.info('Spotify Extractor registered successfully');
    } else {
        logger.warn('Spotify Client ID/Secret not found in .env. Spotify search may not work.');
    }

    // Register SoundCloud Extractor
    await player.extractors.register(SoundCloudExtractor, {});
    logger.info('SoundCloud Extractor registered successfully');

    // Register event handlers
    // playerStartHandler(player);

    player.events.on('error', (queue, error) => {
        botLog(`[Player Error]${error.message} `);
        logger.error(`[Player Error] ${error.message} `, error);
    });

    player.events.on('playerError', (queue, error) => {
        botLog(`[Player Connection Error]${error.message} `);
        logger.error(`[Player Connection Error] ${error.message} `, error);
    });

    // Add AudioPlayer diagnostics
    player.events.on('connection', (queue) => {
        logger.info(`[AudioPlayer] Voice connection established for guild: ${queue.guild.name}`);

        const connection = queue.connection;
        if (connection) {
            logger.info(`[AudioPlayer] Connection state: ${(connection as any).state?.status || 'unknown'}`);

            // Log when connection state changes
            (connection as any).on?.('stateChange', (oldState: any, newState: any) => {
                logger.info(`[AudioPlayer] Voice connection state: ${oldState?.status || 'unknown'} → ${newState?.status || 'unknown'}`);
            });
        }

        // Get the actual AudioPlayer instance
        const audioPlayer = (queue.dispatcher as any)?.audioPlayer;
        if (audioPlayer) {
            logger.info(`[AudioPlayer] AudioPlayer instance found`);

            // Listen to state changes
            audioPlayer.on('stateChange', (oldState: any, newState: any) => {
                logger.info(`[AudioPlayer] State: ${oldState?.status || 'unknown'} → ${newState?.status || 'unknown'}`);
                if (newState?.resource) {
                    logger.info(`[AudioPlayer] Resource metadata: ${JSON.stringify(newState.resource.metadata || {})}`);
                }
            });

            // Listen to errors
            audioPlayer.on('error', (error: any) => {
                logger.error(`[AudioPlayer] ERROR:`, error);
                logger.error(`[AudioPlayer] Error resource:`, error.resource?.metadata);
            });

            // Listen to debug events
            audioPlayer.on('debug', (message: string) => {
                logger.debug(`[AudioPlayer] Debug: ${message}`);
            });
        } else {
            logger.warn(`[AudioPlayer] Could not access AudioPlayer instance for diagnostics`);
        }
    });

    logger.info('Player initialized successfully');
    return player;
};

export const getPlayer = () => {
    if (!player) {
        throw new Error('Player has not been initialized!');
    }
    return player;
};
