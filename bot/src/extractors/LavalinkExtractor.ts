
import { BaseExtractor, ExtractorInfo, ExtractorSearchContext, Track, SearchQueryType, Util } from 'discord-player';
import { Client } from 'discord.js';
import logger from '../utils/logger';

export class LavalinkExtractor extends BaseExtractor {
    static identifier = 'com.discord-bot.lavalinkextractor' as const;
    private node = {
        host: 'http://127.0.0.1:2333',
        password: 'youshallnotpass'
    };

    async validate(query: string, type?: SearchQueryType | null): Promise<boolean> {
        return true; // Handle everything as a fallback
    }

    async handle(query: string, context: ExtractorSearchContext): Promise<ExtractorInfo> {
        try {
            logger.info(`[LavalinkExtractor] Searching for: ${query}`);

            // Determine search type
            let identifier = query;
            if (!query.startsWith('http')) {
                identifier = `ytsearch:${query}`; // Default to YouTube search
            }

            // Call Lavalink API
            const params = new URLSearchParams({ identifier });
            const response = await fetch(`${this.node.host}/v4/loadtracks?${params}`, {
                headers: { Authorization: this.node.password }
            });

            if (!response.ok) {
                throw new Error(`Lavalink API error: ${response.statusText}`);
            }

            const data: any = await response.json();

            if (data.loadType === 'empty' || data.loadType === 'error') {
                return this.createResponse(null, []);
            }

            const tracks = [];
            if (data.loadType === 'search' || data.loadType === 'track') {
                const items = data.data ? (Array.isArray(data.data) ? data.data : [data.data]) : [];

                for (const item of items) {
                    const info = item.info;
                    tracks.push(new Track(this.context.player, {
                        title: info.title,
                        description: info.author,
                        author: info.author,
                        url: info.uri,
                        thumbnail: info.artworkUrl || '',
                        duration: Util.buildTimeCode(Util.parseMS(info.length)),
                        views: 0,
                        requestedBy: context.requestedBy,
                        source: info.sourceName,
                        live: info.isStream,
                        raw: item // Store full item for stream extraction
                    }));
                }
            }

            logger.info(`[LavalinkExtractor] Found ${tracks.length} tracks`);
            return this.createResponse(null, tracks);

        } catch (error) {
            logger.error('[LavalinkExtractor] Error handling query:', error);
            return this.createResponse(null, []);
        }
    }

    async stream(track: Track): Promise<string> {
        try {
            logger.info(`[LavalinkExtractor] Getting stream for: ${track.title}`);

            // We can't get the direct stream URL from Lavalink easily for discord-player to play directly
            // because Lavalink IS the player.

            // CRITICAL ISSUE: discord-player expects a direct audio URL (mp3/webm/etc) or a Readable stream.
            // Lavalink doesn't give us that. It expects to control the voice connection itself.

            // If we want to use Lavalink with discord-player, we usually use a bridge that makes Lavalink act as the audio source.
            // BUT, since we are using discord-player's AudioPlayer, we need a raw stream.

            // WORKAROUND: Use 'lavalink-stream' or similar? No.

            // Wait, if we use Lavalink, we usually replace discord-player's voice connection handling.
            // But the user wants to keep discord-player features.

            // ALTERNATIVE: Use a different extractor that works?
            // 'play-dl' or 'youtube-ext'.

            // BUT user explicitly asked for Lavalink.

            // Let's try to get the stream URL if possible.
            // Some sources (like SoundCloud) give a direct URL in the info.
            // For YouTube, Lavalink handles the decryption.

            // If we can't get a stream URL, this extractor approach won't work with standard discord-player.
            // We would need to use a library that integrates Lavalink as a Player node.

            // Let's try to use 'youtube-ext' instead? It's in package.json.

            // OK, to use Lavalink with discord-player v7 properly, we need to use it as a "Voice Node".
            // But discord-player v7 removed built-in Lavalink support.

            // Maybe we can use the Lavalink server to decode the track and pipe the audio?
            // Lavalink has an endpoint `/v4/decodetrack` but that's for metadata.

            // Actually, we can use the `track.url` if it's a direct link? No.

            // Let's look at `discord-player-lavalink` again. It might be under a different name.
            // Or maybe I should just use `ytdl-core` but via a proxy?

            // Let's assume for a moment that we CANNOT easily integrate Lavalink into discord-player v7 without a dedicated plugin.
            // And that plugin (discord-player-lavalink) failed to install.

            // Let's try to use `youtube-ext` which IS installed.
            // It might be the solution for YouTube.

            // But user wants Lavalink.

            // Let's try to install `lavalink-client` and use it?

            throw new Error('Lavalink stream extraction not implemented yet');
        } catch (error) {
            logger.error(`[LavalinkExtractor] Stream error:`, error);
            throw error;
        }
    }
}
