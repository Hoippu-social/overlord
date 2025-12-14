import { useMainPlayer } from 'discord-player';
import {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageActionRowComponentBuilder,
    CommandInteraction,
    TextChannel
} from 'discord.js';
import logger from '../../utils/logger';

export default function (player: any) { // Using any for now to avoid type issues with the event emitter
    player.events.on('playerStart', async (queue: any, track: any) => {
        logger.info(`[PlayerStart] Event triggered - Track: ${track.title}`);

        const metadata = queue.metadata as CommandInteraction;

        if (!metadata || !metadata.channel) {
            logger.warn('[PlayerStart] No metadata or channel found, skipping embed');
            return;
        }

        const embed = new EmbedBuilder()
            .setColor('#2f3136') // Dark theme color
            .setAuthor({ name: '📻 Сейчас играет' })
            .setTitle(track.title)
            .setURL(track.url)
            .addFields(
                { name: 'Добавил', value: `<@${track.requestedBy?.id}>`, inline: true },
                { name: 'Автор', value: track.author, inline: true },
                { name: 'Длительность', value: track.duration, inline: true },
                { name: '🔊 Громкость', value: `${queue.node.volume}%`, inline: true }
            )
            .setFooter({ text: `Radio Hoippu` });

        // Only set thumbnail if it's a valid URL
        if (track.thumbnail && track.thumbnail.startsWith('http')) {
            embed.setThumbnail(track.thumbnail);
        }

        // Row 1: Controls
        const row1 = new ActionRowBuilder<MessageActionRowComponentBuilder>()
            .addComponents(
                new ButtonBuilder().setCustomId('previous').setEmoji('⏮️').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('pause').setEmoji('⏯️').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('skip').setEmoji('⏭️').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('stop').setEmoji('⏹️').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('queue').setEmoji('📄').setStyle(ButtonStyle.Secondary)
            );

        // Row 2: Options
        const row2 = new ActionRowBuilder<MessageActionRowComponentBuilder>()
            .addComponents(
                new ButtonBuilder().setCustomId('loop_track').setEmoji('🔂').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('loop_queue').setEmoji('🔁').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('shuffle').setEmoji('🔀').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('vol_down').setEmoji('🔉').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('vol_up').setEmoji('🔊').setStyle(ButtonStyle.Secondary)
            );

        if (metadata.channel.isTextBased()) {
            const channel = metadata.channel as TextChannel;
            try {
                logger.info('[PlayerStart] Sending embed message to channel');
                const message = await channel.send({ embeds: [embed], components: [row1, row2] });
                queue.metadata.message = message;
                logger.info('[PlayerStart] Embed message sent successfully');
            } catch (error) {
                logger.error("[PlayerStart] Failed to send player start message:", error);
            }
        }
    });
}
