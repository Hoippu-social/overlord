import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { localizeDescription } from '../../utils/commandLocalizations';
import { getInteractionLocale, t } from '../../utils/i18n';
import { Command } from '../../utils/types';

const command: Command = {
    data: localizeDescription(new SlashCommandBuilder().setName('nowplaying'), {
        en: 'Show the currently playing track',
        ru: 'Показать текущий трек',
    }),
    accessGroup: 'music',
    accessKey: 'nowplaying',
    execute: async (interaction) => {
        const locale = await getInteractionLocale(interaction);
        const player = interaction.client.lavalink.getPlayer(interaction.guildId!);

        if (!player || !player.queue.current) {
            await interaction.reply({ content: t(locale, 'general.nothingPlaying'), ephemeral: true });
            return;
        }

        const track = player.queue.current;
        const formatDuration = (ms: number) => {
            const minutes = Math.floor(ms / 60000);
            const seconds = Math.floor((ms % 60000) / 1000);
            return `${minutes}:${seconds.toString().padStart(2, '0')}`;
        };

        const position = player.position || 0;
        const duration = track.info.duration || 0;
        const progress = duration > 0 ? Math.floor((position / duration) * 20) : 0;
        const progressBar = '▓'.repeat(progress) + '░'.repeat(20 - progress);

        const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setAuthor({ name: t(locale, 'music.nowplaying.title') })
            .setTitle(track.info.title)
            .setURL(track.info.uri || '')
            .addFields(
                { name: t(locale, 'music.nowplaying.field.author'), value: track.info.author || t(locale, 'general.unknown'), inline: true },
                { name: t(locale, 'music.nowplaying.field.progress'), value: `\`${formatDuration(position)}\` / \`${formatDuration(duration)}\``, inline: true },
                { name: t(locale, 'music.nowplaying.field.volume'), value: `${player.volume}%`, inline: true }
            )
            .setDescription(`\`${progressBar}\``)
            .setFooter({ text: `${t(locale, 'music.nowplaying.requester')}: ${track.requester || t(locale, 'general.unknown')}` });

        if (track.info.artworkUrl) {
            embed.setThumbnail(track.info.artworkUrl);
        }

        const queueSize = player.queue.tracks.length;
        if (queueSize > 0) {
            embed.addFields({ name: t(locale, 'music.nowplaying.field.queue'), value: t(locale, 'music.nowplaying.queueCount', { count: queueSize }), inline: true });
        }

        if (player.repeatMode !== 'off') {
            embed.addFields({ name: t(locale, 'music.nowplaying.field.loop'), value: t(locale, `music.nowplaying.loop.${player.repeatMode}` as never), inline: true });
        }

        if (player.paused) {
            embed.addFields({ name: t(locale, 'music.nowplaying.field.paused'), value: t(locale, 'music.nowplaying.paused'), inline: true });
        }

        await interaction.reply({ embeds: [embed], ephemeral: true });
    },
};

export default command;
