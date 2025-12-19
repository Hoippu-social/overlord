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
            await interaction.reply({ content: 'You need to be in a voice channel!', ephemeral: true });
            return;
        }

        const player = interaction.client.lavalink.getPlayer(interaction.guildId!);

        if (!player || !player.queue.current) {
            await interaction.reply({ content: 'Nothing is playing right now.', ephemeral: true });
            return;
        }

        if (player.voiceChannelId !== voiceChannel.id) {
            await interaction.reply({ content: 'You must be in the same voice channel as the bot.', ephemeral: true });
            return;
        }

        if (!player.paused) {
            await interaction.reply({ content: 'Already playing.', ephemeral: true });
            return;
        }

        await player.resume();
        await player.musicHandler?.setNowPlaying(player.queue.current, { paused: false, positionMs: player.position });
        await interaction.reply('Player resumed.');
    },
};

export default command;
