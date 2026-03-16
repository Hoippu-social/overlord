import { SlashCommandBuilder, EmbedBuilder, GuildMember } from 'discord.js';
import { Command } from '../../utils/types';

const command: Command = {
    data: new SlashCommandBuilder()
        .setName('nowplaying')
        .setDescription('Shows the currently playing track'),
    accessGroup: 'music',
    accessKey: 'nowplaying',
    execute: async (interaction) => {
        const player = interaction.client.lavalink.getPlayer(interaction.guildId!);

        if (!player || !player.queue.current) {
            await interaction.reply({ content: '❌ Сейчас ничего не играет!', ephemeral: true });
            return;
        }

        const track = player.queue.current;

        // Format duration
        const formatDuration = (ms: number) => {
            const minutes = Math.floor(ms / 60000);
            const seconds = Math.floor((ms % 60000) / 1000);
            return `${minutes}:${seconds.toString().padStart(2, '0')}`;
        };

        // Progress bar
        const position = player.position || 0;
        const duration = track.info.duration || 0;
        const progress = duration > 0 ? Math.floor((position / duration) * 20) : 0;
        const progressBar = '▓'.repeat(progress) + '░'.repeat(20 - progress);

        const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setAuthor({ name: '🎵 Сейчас играет' })
            .setTitle(track.info.title)
            .setURL(track.info.uri || '')
            .addFields(
                { name: 'Автор', value: track.info.author || 'Неизвестен', inline: true },
                { name: 'Длительность', value: `\`${formatDuration(position)}\` / \`${formatDuration(duration)}\``, inline: true },
                { name: 'Громкость', value: `${player.volume}%`, inline: true }
            )
            .setDescription(`\`${progressBar}\``)
            .setFooter({ text: `Заказал: ${track.requester || 'Неизвестно'}` });

        // Add thumbnail if available
        if (track.info.artworkUrl) {
            embed.setThumbnail(track.info.artworkUrl);
        }

        // Add queue info
        const queueSize = player.queue.tracks.length;
        if (queueSize > 0) {
            embed.addFields({ name: 'В очереди', value: `${queueSize} треков`, inline: true });
        }

        // Add loop mode
        if (player.repeatMode !== 'off') {
            const loopModes: Record<string, string> = {
                'track': '🔂 Трек',
                'queue': '🔁 Очередь'
            };
            embed.addFields({ name: 'Повтор', value: loopModes[player.repeatMode] || 'Выкл', inline: true });
        }

        // Add pause status
        if (player.paused) {
            embed.addFields({ name: 'Статус', value: '⏸️ На паузе', inline: true });
        }

        await interaction.reply({ embeds: [embed] });
    },
};

export default command;
