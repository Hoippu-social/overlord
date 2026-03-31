import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { localizeDescription } from '../../utils/commandLocalizations';
import { getInteractionLocale, t } from '../../utils/i18n';
import { Command } from '../../utils/types';

const command: Command = {
    data: localizeDescription(
        new SlashCommandBuilder()
            .setName('queue')
            .addIntegerOption((option) =>
                localizeDescription(option.setName('page').setMinValue(1).setRequired(false), {
                    en: 'Page number',
                    ru: 'Номер страницы',
                })
            ) as any,
        {
            en: 'Show the current music queue',
            ru: 'Показать текущую очередь музыки',
        }
    ),
    accessGroup: 'music',
    accessKey: 'queue',
    execute: async (interaction) => {
        const locale = await getInteractionLocale(interaction);
        const player = interaction.client.lavalink.getPlayer(interaction.guildId!);

        if (!player || !player.queue.current) {
            await interaction.reply({ content: t(locale, 'general.nothingPlaying'), ephemeral: true });
            return;
        }

        const queue = player.queue;
        const currentTrack = queue.current;
        const tracks = queue.tracks;
        const pageSize = 10;
        const page = (interaction.options.getInteger('page') || 1) - 1;
        const totalPages = Math.ceil(tracks.length / pageSize) || 1;

        if (page >= totalPages || page < 0) {
            await interaction.reply({ content: t(locale, 'music.queue.invalidPage', { pages: totalPages }), ephemeral: true });
            return;
        }

        const startIndex = page * pageSize;
        const endIndex = startIndex + pageSize;
        const pageTracks = tracks.slice(startIndex, endIndex);

        const formatDuration = (ms: number) => {
            const minutes = Math.floor(ms / 60000);
            const seconds = Math.floor((ms % 60000) / 1000);
            return `${minutes}:${seconds.toString().padStart(2, '0')}`;
        };

        const currentInfo = `[${currentTrack!.info.title}](${currentTrack!.info.uri}) | \`${formatDuration(currentTrack!.info.duration || 0)}\``;
        const queueInfo = pageTracks.length > 0
            ? pageTracks.map((track, index) => {
                const position = startIndex + index + 1;
                return `**${position}.** [${track.info.title}](${track.info.uri}) | \`${formatDuration(track.info.duration || 0)}\``;
            }).join('\n')
            : t(locale, 'music.queue.empty');

        const totalDuration = tracks.reduce((acc, track) => acc + (track.info.duration || 0), 0);
        const totalFormatted = formatDuration(totalDuration);

        const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle(t(locale, 'music.queue.title'))
            .setDescription(`**${t(locale, 'music.queue.current')}**\n${currentInfo}\n\n**${t(locale, 'music.queue.next')}**\n${queueInfo}`)
            .setFooter({
                text: t(locale, 'music.queue.footer', {
                    page: page + 1,
                    pages: totalPages,
                    count: tracks.length,
                    duration: totalFormatted,
                }),
            });

        if (player.repeatMode !== 'off') {
            embed.addFields({ name: t(locale, 'music.nowplaying.field.loop'), value: t(locale, `music.queue.loop.${player.repeatMode}` as never), inline: true });
        }

        await interaction.reply({ embeds: [embed], ephemeral: true });
    },
};

export default command;
