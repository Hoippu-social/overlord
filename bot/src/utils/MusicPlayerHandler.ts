import {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    Message,
    TextChannel,
    Client
} from 'discord.js';
import { Player, Track } from 'lavalink-client';
import logger from './logger';
import { prisma } from './database';

export class MusicPlayerHandler {
    private message: Message | null = null;
    private updateInterval: NodeJS.Timeout | null = null;
    private lastUpdate: number = 0;
    private playedTracks: Track[] = []; // History for Previous button
    private readonly MAX_HISTORY = 40;
    private isGoingBack: boolean = false; // Flag to prevent adding to history when going back

    constructor(private player: Player, private client: Client) { }

    async sendNowPlaying(track: Track) {
        // Clear previous interval if exists
        this.stopUpdateInterval();

        // Delete old message if exists
        if (this.message) {
            try {
                await this.message.delete();
            } catch (e) {
                // Message might be already deleted
            }
            this.message = null;
        }

        const channel = this.client.channels.cache.get(this.player.textChannelId!) as TextChannel;
        if (!channel) return;

        const embed = this.createEmbed(track);
        const rows = this.createButtons();

        try {
            this.message = await channel.send({ embeds: [embed], components: rows });
            await this.setNowPlaying(track);
            this.startUpdateInterval();
        } catch (error) {
            logger.error('Failed to send now playing message:', error);
        }
    }

    async updateMessage(forceUpdate: boolean = false) {
        if (!this.message || !this.player.queue.current) return;

        // Rate limit updates (max once per 5 seconds to be safe), unless forced
        if (!forceUpdate && Date.now() - this.lastUpdate < 5000) return;
        this.lastUpdate = Date.now();

        const embed = this.createEmbed(this.player.queue.current);
        const rows = this.createButtons();

        try {
            await this.message.edit({ embeds: [embed], components: rows });
            await this.setNowPlaying(this.player.queue.current);
        } catch (error) {
            logger.error('Failed to update player message:', error);
            this.stopUpdateInterval();
        }
    }

    addToHistory(track: Track) {
        // Don't add to history if we're going back
        if (this.isGoingBack) {
            this.isGoingBack = false;
            return;
        }

        this.playedTracks.push(track);
        // Keep only last 40 tracks
        if (this.playedTracks.length > this.MAX_HISTORY) {
            this.playedTracks.shift();
        }
    }

    async playPrevious(): Promise<boolean> {
        if (this.playedTracks.length === 0) return false;

        const previousTrack = this.playedTracks.pop()!; // Get Трек 2 from history

        // Set flag to prevent adding previous track to history again
        this.isGoingBack = true;

        // Insert both previous and current tracks at the front of the queue
        // This puts: [Трек 2, Трек 3, Трек 4...]
        if (this.player.queue.current) {
            await this.player.queue.splice(0, 0, [previousTrack, this.player.queue.current]);
        } else {
            await this.player.queue.add(previousTrack, 0);
        }

        // Skip current track (Трек 3) to start playing Трек 2 from queue
        await this.player.skip();
        // Result: Playing Трек 2, Queue: [Трек 3, Трек 4...]

        return true;
    }

    async destroy() {
        this.stopUpdateInterval();
        this.playedTracks = []; // Clear history
        if (this.message) {
            try {
                await this.message.delete();
            } catch (e) { }
            this.message = null;
        }
        try {
            await prisma.musicNowPlaying.deleteMany({ where: { guildId: this.player.guildId } });
        } catch (e) {
            logger.error('Failed to clear now playing state:', e);
        }
    }

    async setNowPlaying(track: Track | null | undefined, patch?: Partial<{ volume: number; paused: boolean; positionMs: number }>) {
        if (!track) {
            await prisma.musicNowPlaying.deleteMany({ where: { guildId: this.player.guildId } });
            return;
        }
        const durationMs = track.info.duration ?? null;
        const positionMs = patch?.positionMs ?? this.player.position ?? null;
        const volume = patch?.volume ?? this.player.volume ?? null;
        const paused = patch?.paused ?? this.player.paused ?? false;

        try {
            await prisma.musicNowPlaying.upsert({
                where: { guildId: this.player.guildId },
                update: {
                    title: track.info.title || 'Unknown',
                    author: track.info.author || null,
                    uri: track.info.uri || null,
                    artworkUrl: track.info.artworkUrl || null,
                    durationMs,
                    positionMs,
                    volume,
                    paused,
                },
                create: {
                    guildId: this.player.guildId,
                    title: track.info.title || 'Unknown',
                    author: track.info.author || null,
                    uri: track.info.uri || null,
                    artworkUrl: track.info.artworkUrl || null,
                    durationMs,
                    positionMs,
                    volume,
                    paused,
                },
            });
        } catch (error) {
            logger.error('Failed to persist now playing:', error);
        }
    }

    private startUpdateInterval() {
        this.updateInterval = setInterval(() => {
            this.updateMessage();
        }, 10000); // Update every 10 seconds
    }

    private stopUpdateInterval() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }

    private createEmbed(track: Track): EmbedBuilder {
        const duration = track.info.duration;
        const position = this.player.position;

        const formatTime = (ms: number) => {
            const totalSeconds = Math.floor(ms / 1000);
            const hours = Math.floor(totalSeconds / 3600);
            const minutes = Math.floor((totalSeconds % 3600) / 60);
            const seconds = totalSeconds % 60;

            if (hours > 0) {
                return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            }
            return `${minutes}:${seconds.toString().padStart(2, '0')}`;
        };

        const sourceColor = this.getSourceColor(track.info.sourceName);

        // Status Icons
        const loopStatus = this.player.repeatMode === 'track' ? '🔂' : (this.player.repeatMode === 'queue' ? '🔁' : '⏩');
        const volume = this.player.volume;

        // Requester (track.requester is already the user ID)
        const requester = track.requester ? `<@${track.requester}>` : 'Unknown';

        return new EmbedBuilder()
            .setColor(sourceColor)
            .setAuthor({ name: '📻 Сейчас играет' })
            .setTitle(track.info.title)
            .setURL(track.info.uri || null)
            .setThumbnail(track.info.artworkUrl || null)
            .addFields(
                { name: '🔊 Громкость', value: `\`${volume}%\``, inline: true },
                { name: 'Автор', value: `\`${track.info.author || 'Unknown'}\``, inline: true },
                { name: 'Длительность', value: `\`${formatTime(position)}/${formatTime(duration)}\``, inline: true }
            )
            .addFields(
                { name: 'Добавил', value: requester, inline: true },
                { name: 'Повтор', value: loopStatus, inline: true }
            )
            .setFooter({ text: 'Hoippu Radio' });
    }

    private createButtons(): ActionRowBuilder<ButtonBuilder>[] {
        const row1 = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('player_prev')
                    .setEmoji('⏮️')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(this.playedTracks.length === 0),
                new ButtonBuilder()
                    .setCustomId('player_pause')
                    .setEmoji(this.player.paused ? '▶️' : '⏸️')
                    .setStyle(this.player.paused ? ButtonStyle.Success : ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('player_skip')
                    .setEmoji('⏭️')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('player_stop')
                    .setEmoji('⏹️')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId('player_queue')
                    .setEmoji('📜')
                    .setStyle(ButtonStyle.Secondary)
            );

        const row2 = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('player_loop')
                    .setEmoji(this.getNextLoopIcon())
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('player_vol_down')
                    .setEmoji('🔉')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('player_vol_up')
                    .setEmoji('🔊')
                    .setStyle(ButtonStyle.Secondary)
            );

        return [row1, row2];
    }

    private getNextLoopIcon(): string {
        // Button shows the NEXT mode, not current
        switch (this.player.repeatMode) {
            case 'off': return '🔁'; // Will switch to queue
            case 'queue': return '🔂'; // Will switch to track
            case 'track': return '⏩'; // Will switch to off
            default: return '🔁';
        }
    }

    private getSourceColor(source: string): number {
        switch (source.toLowerCase()) {
            case 'youtube': return 0xFF0000;
            case 'spotify': return 0x1DB954;
            case 'soundcloud': return 0xFF5500;
            case 'yandexmusic': return 0xFFCC00;
            default: return 0x5865F2; // Discord Blurple
        }
    }
}
