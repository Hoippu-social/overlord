import { SlashCommandBuilder, GuildMember } from 'discord.js';
import { Command } from '../../utils/types';

const command: Command = {
    data: new SlashCommandBuilder()
        .setName('shuffle')
        .setDescription('Shuffles the queue'),
    execute: async (interaction) => {
        const member = interaction.member as GuildMember;
        const voiceChannel = member.voice.channel;

        if (!voiceChannel) {
            await interaction.reply({ content: '❌ Вы должны быть в голосовом канале!', ephemeral: true });
            return;
        }

        const player = interaction.client.lavalink.getPlayer(interaction.guildId!);

        if (!player) {
            await interaction.reply({ content: '❌ Плеер не активен!', ephemeral: true });
            return;
        }

        if (player.voiceChannelId !== voiceChannel.id) {
            await interaction.reply({ content: '❌ Вы должны быть в том же канале, что и бот!', ephemeral: true });
            return;
        }

        const queue = player.queue;

        if (queue.tracks.length < 2) {
            await interaction.reply({ content: '❌ Недостаточно треков в очереди для перемешивания!', ephemeral: true });
            return;
        }

        // Shuffle the queue
        await queue.shuffle();

        await interaction.reply(`🔀 Очередь перемешана! (${queue.tracks.length} треков)`);
    },
};

export default command;
