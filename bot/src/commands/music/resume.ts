import { SlashCommandBuilder, GuildMember } from 'discord.js';
import { Command } from '../../utils/types';

const command: Command = {
    data: new SlashCommandBuilder()
        .setName('resume')
        .setDescription('Resumes the paused track'),
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

        if (!player.paused) {
            await interaction.reply({ content: '⚠️ Музыка уже играет!', ephemeral: true });
            return;
        }

        await player.resume();
        await interaction.reply('▶️ Воспроизведение возобновлено');
    },
};

export default command;
