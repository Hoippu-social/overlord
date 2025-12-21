import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { getGuildLocale, t } from '../../utils/i18n';
import { Command } from '../../utils/types';

const command: Command = {
    data: new SlashCommandBuilder()
        .setName('queue')
        .setDescription('Shows the current music queue')
        .addIntegerOption(option =>
            option.setName('page')
                .setDescription('Page number')
                .setMinValue(1)
                .setRequired(false)
        ) as any,
    execute: async (interaction) => {
        const locale = await getGuildLocale(interaction.guildId);
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

        const currentInfo = `**${t(locale, 'music.queue.current')}**
[${currentTrack!.info.title}](${currentTrack!.info.uri}) | \`${formatDuration(currentTrack!.info.duration || 0)}\``;

        let queueInfo = '';
        if (pageTracks.length > 0) {
            queueInfo = pageTracks.map((track, index) => {
                const position = startIndex + index + 1;
                return `**${position}.** [${track.info.title}](${track.info.uri}) | \`${formatDuration(track.info.duration || 0)}\``;
            }).join('\n');
        } else {
            queueInfo = t(locale, 'music.queue.empty');
        }

        const totalDuration = tracks.reduce((acc, track) => acc + (track.info.duration || 0), 0);
        const totalFormatted = formatDuration(totalDuration);

        const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle(t(locale, 'music.queue.title'))
            .setDescription(`${currentInfo}

**${t(locale, 'music.queue.next')}**
${queueInfo}`)
            .setFooter({
                text: t(locale, 'music.queue.footer', { page: page + 1, pages: totalPages, count: tracks.length, duration: totalFormatted })
            });

        if (player.repeatMode !== 'off') {
            const loopModes: Record<string, string> = {
                track: t(locale, 'music.queue.loop.track'),
                queue: t(locale, 'music.queue.loop.queue'),
                off: t(locale, 'music.queue.loop.off'),
            };
            embed.addFields({
                name: t(locale, 'music.nowplaying.field.loop'),
                value: loopModes[player.repeatMode] || t(locale, 'music.queue.loop.off'),
                inline: true,
            });
        }

        await interaction.reply({ embeds: [embed] });
    },
};

export default command;
