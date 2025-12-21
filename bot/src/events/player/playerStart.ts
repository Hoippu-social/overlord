import {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageActionRowComponentBuilder,
    CommandInteraction,
    TextChannel,
} from 'discord.js';
import { getGuildLocale, t } from '../../utils/i18n';
import logger from '../../utils/logger';

export default function (player: any) {
    player.events.on('playerStart', async (queue: any, track: any) => {
        logger.info(`[PlayerStart] Event triggered - Track: ${track.title}`);

        const metadata = queue.metadata as CommandInteraction;

        if (!metadata || !metadata.channel) {
            logger.warn('[PlayerStart] No metadata or channel found, skipping embed');
            return;
        }

        const locale = await getGuildLocale(metadata.guildId ?? queue.guild?.id);
        const requester = track.requestedBy?.id ? `<@${track.requestedBy.id}>` : t(locale, 'general.unknown');

        const embed = new EmbedBuilder()
            .setColor('#2f3136')
            .setAuthor({ name: t(locale, 'music.nowplaying.title') })
            .setTitle(track.title)
            .setURL(track.url)
            .addFields(
                { name: t(locale, 'music.player.field.requester'), value: requester, inline: true },
                { name: t(locale, 'music.player.field.author'), value: track.author || t(locale, 'general.unknown'), inline: true },
                { name: t(locale, 'music.player.field.duration'), value: track.duration, inline: true },
                { name: t(locale, 'music.player.field.volume'), value: `${queue.node.volume}%`, inline: true }
            )
            .setFooter({ text: 'Radio Hoippu' });

        if (track.thumbnail && track.thumbnail.startsWith('http')) {
            embed.setThumbnail(track.thumbnail);
        }

        const row1 = new ActionRowBuilder<MessageActionRowComponentBuilder>()
            .addComponents(
                new ButtonBuilder().setCustomId('previous').setEmoji('??').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('pause').setEmoji('??').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('skip').setEmoji('??').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('stop').setEmoji('??').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('queue').setEmoji('??').setStyle(ButtonStyle.Secondary)
            );

        const row2 = new ActionRowBuilder<MessageActionRowComponentBuilder>()
            .addComponents(
                new ButtonBuilder().setCustomId('loop_track').setEmoji('??').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('loop_queue').setEmoji('??').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('shuffle').setEmoji('??').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('vol_down').setEmoji('??').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('vol_up').setEmoji('??').setStyle(ButtonStyle.Secondary)
            );

        if (metadata.channel.isTextBased()) {
            const channel = metadata.channel as TextChannel;
            try {
                logger.info('[PlayerStart] Sending embed message to channel');
                const message = await channel.send({ embeds: [embed], components: [row1, row2] });
                queue.metadata.message = message;
                logger.info('[PlayerStart] Embed message sent successfully');
            } catch (error) {
                logger.error('[PlayerStart] Failed to send player start message:', error);
            }
        }
    });
}
