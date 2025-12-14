import { BaseExtractor, ExtractorInfo, ExtractorSearchContext, Track, SearchQueryType, Util } from 'discord-player';
import ytdl from '@distube/ytdl-core';
import logger from '../utils/logger';

export class YtdlExtractor extends BaseExtractor {
    static identifier = 'com.discord-bot.ytdlextractor' as const;

    async validate(query: string, type?: SearchQueryType | null): Promise<boolean> {
        // Validate YouTube URLs and search queries
        if (!type) return false;

        const youtubeTypes = [
            'youtube',
            'youtubePlaylist',
            'youtubeSearch',
            'youtubeVideo',
            'auto',
            'autoSearch'
        ];

        return youtubeTypes.includes(type);
    }

    async handle(query: string, context: ExtractorSearchContext): Promise<ExtractorInfo> {
        try {
            // For direct YouTube URLs
            if (ytdl.validateURL(query)) {
                const info = await ytdl.getInfo(query);

                const track = this.createResponse(null, [
                    new Track(this.context.player, {
                        title: info.videoDetails.title,
                        description: info.videoDetails.description || '',
                        author: info.videoDetails.author.name,
                        url: info.videoDetails.video_url,
                        thumbnail: info.videoDetails.thumbnails[0]?.url || '',
                        duration: Util.buildTimeCode(
                            Util.parseMS(parseInt(info.videoDetails.lengthSeconds) * 1000)
                        ),
                        views: parseInt(info.videoDetails.viewCount),
                        requestedBy: context.requestedBy,
                        source: 'youtube',
                        live: info.videoDetails.isLiveContent,
                        raw: info
                    })
                ]);

                return track;
            }

            // For search queries, return empty (let discord-player handle search)
            return this.createResponse(null, []);
        } catch (error) {
            logger.error('[YtdlExtractor] Error handling query:', error);
            return this.createResponse(null, []);
        }
    }

    async stream(track: Track): Promise<string> {
        try {
            logger.info(`[YtdlExtractor] Getting stream for: ${track.title} (live: ${track.raw?.videoDetails?.isLiveContent || false})`);

            const info = await ytdl.getInfo(track.url);

            // For livestreams, get HLS manifest URL
            if (info.videoDetails.isLiveContent) {
                const hlsUrl = info.formats.find(f => f.isHLS)?.url;
                if (hlsUrl) {
                    logger.info(`[YtdlExtractor] Got HLS URL for livestream`);
                    return hlsUrl;
                }
            }

            // For regular tracks, get best audio format
            const format = ytdl.chooseFormat(info.formats, {
                quality: 'highestaudio',
                filter: 'audioonly'
            });

            if (!format || !format.url) {
                throw new Error('No suitable format found');
            }

            logger.info(`[YtdlExtractor] Got audio URL (format: ${format.itag}, bitrate: ${format.audioBitrate})`);
            return format.url;
        } catch (error: any) {
            logger.error(`[YtdlExtractor] Stream error:`, error);
            throw error;
        }
    }

    async getRelatedTracks(track: Track): Promise<ExtractorInfo> {
        // Return empty - we don't implement related tracks
        return this.createResponse(null, []);
    }
}
