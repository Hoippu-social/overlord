import { SlashCommandBuilder, GuildMember } from 'discord.js';
import { Command } from '../../utils/types';

const command: Command = {
    data: new SlashCommandBuilder()
        .setName('volume')
        .setDescription('Sets the player volume')
        .addIntegerOption(option =>
            option.setName('level')
                .setDescription('Volume level (0-150)')
                .setMinValue(0)
                .setMaxValue(150)
                .setRequired(false)
        ) as any,
    execute: async (interaction) => {
        const member = interaction.member as GuildMember;
        const voiceChannel = member.voice.channel;

        if (!voiceChannel) {
            await interaction.reply({ content: 'You need to be in a voice channel!', ephemeral: true });
            return;
        }

        const player = interaction.client.lavalink.getPlayer(interaction.guildId!);

        if (!player) {
            await interaction.reply({ content: 'Player is not active.', ephemeral: true });
            return;
        }

        if (player.voiceChannelId !== voiceChannel.id) {
            await interaction.reply({ content: 'You must be in the same voice channel as the bot.', ephemeral: true });
            return;
        }

        const level = interaction.options.getInteger('level');

        if (level === null) {
            await interaction.reply({ content: `Current volume: **${player.volume}%**`, ephemeral: true });
            return;
        }

        await player.setVolume(level);
        await player.musicHandler?.setNowPlaying(player.queue.current, { volume: level, positionMs: player.position, paused: player.paused });

        await interaction.reply(`Volume set to **${level}%**`);
    },
};

export default command;
