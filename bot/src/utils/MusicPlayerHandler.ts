import {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    Message,
    TextChannel,
    Client,
} from 'discord.js';
import { Player, Track } from 'lavalink-client';
import logger from './logger';
import { prisma } from './database';
import { getGuildLocale, t, LocaleCode } from './i18n';

export class MusicPlayerHandler {
    private message: Message | null = null;
    private updateInterval: NodeJS.Timeout | null = null;
    private lastUpdate: number = 0;
    private playedTracks: Track[] = [];
    private readonly MAX_HISTORY = 40;
    private isGoingBack: boolean = false;

    constructor(private player: Player, private client: Client) { }

    async sendNowPlaying(track: Track) {
        this.stopUpdateInterval();

        if (this.message) {
            try {
                await this.message.delete();
            } catch {
                // Ignore message delete errors.
            }
            this.message = null;
        }

        const channel = this.client.channels.cache.get(this.player.textChannelId!) as TextChannel;
        if (!channel) return;

        const locale = await getGuildLocale(this.player.guildId);
        const embed = this.createEmbed(track, locale);
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

        if (!forceUpdate && Date.now() - this.lastUpdate < 5000) return;
        this.lastUpdate = Date.now();

        const locale = await getGuildLocale(this.player.guildId);
        const embed = this.createEmbed(this.player.queue.current, locale);
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
        if (this.isGoingBack) {
            this.isGoingBack = false;
            return;
        }

        this.playedTracks.push(track);
        if (this.playedTracks.length > this.MAX_HISTORY) {
            this.playedTracks.shift();
        }
    }

    async playPrevious(): Promise<boolean> {
        if (this.playedTracks.length === 0) return false;

        const previousTrack = this.playedTracks.pop()!;

        this.isGoingBack = true;

        if (this.player.queue.current) {
            await this.player.queue.splice(0, 0, [previousTrack, this.player.queue.current]);
        } else {
            await this.player.queue.add(previousTrack, 0);
        }

        await this.player.skip();

        return true;
    }

    async destroy() {
        this.stopUpdateInterval();
        this.playedTracks = [];
        if (this.message) {
            try {
                await this.message.delete();
            } catch {
                // Ignore message delete errors.
            }
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
        }, 10000);
    }

    private stopUpdateInterval() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }

    private createEmbed(track: Track, locale: LocaleCode): EmbedBuilder {
        const duration = track.info.duration || 0;
        const position = this.player.position || 0;

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

        const loopStatus = this.player.repeatMode === 'track'
            ? t(locale, 'music.player.loop.track')
            : this.player.repeatMode === 'queue'
                ? t(locale, 'music.player.loop.queue')
                : t(locale, 'music.player.loop.off');
        const volume = this.player.volume;

        const requester = track.requester ? `<@${track.requester}>` : t(locale, 'general.unknown');
        const author = track.info.author || t(locale, 'general.unknown');

        return new EmbedBuilder()
            .setColor(sourceColor)
            .setAuthor({ name: t(locale, 'music.nowplaying.title') })
            .setTitle(track.info.title)
            .setURL(track.info.uri || null)
            .setThumbnail(track.info.artworkUrl || null)
            .addFields(
                { name: t(locale, 'music.player.field.volume'), value: `\`${volume}%\``, inline: true },
                { name: t(locale, 'music.player.field.author'), value: `\`${author}\``, inline: true },
                { name: t(locale, 'music.player.field.duration'), value: `\`${formatTime(position)}/${formatTime(duration)}\``, inline: true },
            )
            .addFields(
                { name: t(locale, 'music.player.field.requester'), value: requester, inline: true },
                { name: t(locale, 'music.player.field.loop'), value: loopStatus, inline: true },
            )
            .setFooter({ text: 'Hoippu Radio' });
    }

    private createButtons(): ActionRowBuilder<ButtonBuilder>[] {
        const row1 = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('player_prev')
                    .setEmoji('??')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(this.playedTracks.length === 0),
                new ButtonBuilder()
                    .setCustomId('player_pause')
                    .setEmoji(this.player.paused ? '??' : '??')
                    .setStyle(this.player.paused ? ButtonStyle.Success : ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('player_skip')
                    .setEmoji('??')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('player_stop')
                    .setEmoji('??')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId('player_queue')
                    .setEmoji('??')
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
                    .setEmoji('??')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('player_vol_up')
                    .setEmoji('??')
                    .setStyle(ButtonStyle.Secondary)
            );

        return [row1, row2];
    }

    private getNextLoopIcon(): string {
        switch (this.player.repeatMode) {
            case 'off':
                return '??';
            case 'queue':
                return '??';
            case 'track':
                return '??';
            default:
                return '??';
        }
    }

    private getSourceColor(source: string): number {
        switch (source.toLowerCase()) {
            case 'youtube':
                return 0xFF0000;
            case 'spotify':
                return 0x1DB954;
            case 'soundcloud':
                return 0xFF5500;
            case 'yandexmusic':
                return 0xFFCC00;
            default:
                return 0x5865F2;
        }
    }
}
