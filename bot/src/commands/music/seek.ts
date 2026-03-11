import { SlashCommandBuilder, GuildMember } from 'discord.js';
import { Command } from '../../utils/types';

const command: Command = {
    data: new SlashCommandBuilder()
        .setName('seek')
        .setDescription('Seeks to a specific position in the track')
        .addStringOption(option =>
            option.setName('position')
                .setDescription('Position to seek to (e.g., 1:30 or 90)')
                .setRequired(true)
        ) as any,
    execute: async (interaction) => {
        const member = interaction.member as GuildMember;
        const voiceChannel = member.voice.channel;

        if (!voiceChannel) {
            await interaction.reply({ content: '❌ Вы должны быть в голосовом канале!', ephemeral: true });
            return;
        }

        const player = interaction.client.lavalink.getPlayer(interaction.guildId!);

        if (!player || !player.queue.current) {
            await interaction.reply({ content: '❌ Сейчас ничего не играет!', ephemeral: true });
            return;
        }

        if (player.voiceChannelId !== voiceChannel.id) {
            await interaction.reply({ content: '❌ Вы должны быть в том же канале, что и бот!', ephemeral: true });
            return;
        }

        const positionInput = interaction.options.getString('position', true);
        let positionMs: number;

        // Parse position (supports formats: "1:30", "90", "1m30s")
        if (positionInput.includes(':')) {
            const parts = positionInput.split(':');
            const minutes = parseInt(parts[0]) || 0;
            const seconds = parseInt(parts[1]) || 0;
            positionMs = (minutes * 60 + seconds) * 1000;
        } else if (positionInput.includes('m') || positionInput.includes('s')) {
            const minMatch = positionInput.match(/(\d+)m/);
            const secMatch = positionInput.match(/(\d+)s/);
            const minutes = minMatch ? parseInt(minMatch[1]) : 0;
            const seconds = secMatch ? parseInt(secMatch[1]) : 0;
            positionMs = (minutes * 60 + seconds) * 1000;
        } else {
            positionMs = parseInt(positionInput) * 1000;
        }

        if (isNaN(positionMs) || positionMs < 0) {
            await interaction.reply({ content: '❌ Неверный формат времени! Используйте: `1:30`, `90` или `1m30s`', ephemeral: true });
            return;
        }

        const track = player.queue.current;
        const duration = track.info.duration || 0;

        if (positionMs > duration) {
            await interaction.reply({ content: '❌ Указанная позиция превышает длительность трека!', ephemeral: true });
            return;
        }

        await player.seek(positionMs);

        // Format position for display
        const minutes = Math.floor(positionMs / 60000);
        const seconds = Math.floor((positionMs % 60000) / 1000);
        const formattedPosition = `${minutes}:${seconds.toString().padStart(2, '0')}`;

        await interaction.reply(`⏩ Перемотано на **${formattedPosition}**`);
    },
};

export default command;
