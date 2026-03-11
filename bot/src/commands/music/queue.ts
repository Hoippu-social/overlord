import { SlashCommandBuilder, EmbedBuilder, GuildMember } from 'discord.js';
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
        const player = interaction.client.lavalink.getPlayer(interaction.guildId!);

        if (!player || !player.queue.current) {
            await interaction.reply({ content: '❌ Сейчас ничего не играет!', ephemeral: true });
            return;
        }

        const queue = player.queue;
        const currentTrack = queue.current;
        const tracks = queue.tracks;

        const pageSize = 10;
        const page = (interaction.options.getInteger('page') || 1) - 1;
        const totalPages = Math.ceil(tracks.length / pageSize) || 1;

        if (page >= totalPages || page < 0) {
            await interaction.reply({ content: `❌ Страница не найдена! Всего страниц: ${totalPages}`, ephemeral: true });
            return;
        }

        const startIndex = page * pageSize;
        const endIndex = startIndex + pageSize;
        const pageTracks = tracks.slice(startIndex, endIndex);

        // Format duration
        const formatDuration = (ms: number) => {
            const minutes = Math.floor(ms / 60000);
            const seconds = Math.floor((ms % 60000) / 1000);
            return `${minutes}:${seconds.toString().padStart(2, '0')}`;
        };

        // Current track info
        const currentInfo = `🎵 **Сейчас играет:**\n[${currentTrack!.info.title}](${currentTrack!.info.uri}) | \`${formatDuration(currentTrack!.info.duration || 0)}\``;

        // Queue tracks
        let queueInfo = '';
        if (pageTracks.length > 0) {
            queueInfo = pageTracks.map((track, index) => {
                const position = startIndex + index + 1;
                return `**${position}.** [${track.info.title}](${track.info.uri}) | \`${formatDuration(track.info.duration || 0)}\``;
            }).join('\n');
        } else {
            queueInfo = '*Очередь пуста*';
        }

        // Total duration
        const totalDuration = tracks.reduce((acc, track) => acc + (track.info.duration || 0), 0);
        const totalFormatted = formatDuration(totalDuration);

        const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('📋 Очередь воспроизведения')
            .setDescription(`${currentInfo}\n\n**Следующие треки:**\n${queueInfo}`)
            .setFooter({
                text: `Страница ${page + 1}/${totalPages} | ${tracks.length} треков | Общая длительность: ${totalFormatted}`
            });

        // Add loop mode info
        if (player.repeatMode !== 'off') {
            const loopModes: Record<string, string> = {
                'track': '🔂 Повтор трека',
                'queue': '🔁 Повтор очереди'
            };
            embed.addFields({ name: 'Режим повтора', value: loopModes[player.repeatMode] || 'Выключен', inline: true });
        }

        await interaction.reply({ embeds: [embed] });
    },
};

export default command;
