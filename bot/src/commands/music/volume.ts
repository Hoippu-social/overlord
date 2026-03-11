import { SlashCommandBuilder, GuildMember } from 'discord.js';
import { Command } from '../../utils/types';

const command: Command = {
    data: new SlashCommandBuilder()
        .setName('volume')
        .setDescription('Sets the player volume')
        .addIntegerOption(option =>
            option.setName('level')
                .setDescription('Volume level (0-100)')
                .setMinValue(0)
                .setMaxValue(100)
                .setRequired(false)
        ) as any,
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

        const level = interaction.options.getInteger('level');

        if (level === null) {
            // Show current volume
            const volumeBar = '█'.repeat(Math.floor(player.volume / 10)) + '░'.repeat(10 - Math.floor(player.volume / 10));
            await interaction.reply(`🔊 Текущая громкость: **${player.volume}%**\n\`[${volumeBar}]\``);
            return;
        }

        await player.setVolume(level);

        const emoji = level === 0 ? '🔇' : level < 30 ? '🔈' : level < 70 ? '🔉' : '🔊';
        const volumeBar = '█'.repeat(Math.floor(level / 10)) + '░'.repeat(10 - Math.floor(level / 10));

        await interaction.reply(`${emoji} Громкость установлена на **${level}%**\n\`[${volumeBar}]\``);
    },
};

export default command;
