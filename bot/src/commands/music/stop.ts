import { SlashCommandBuilder } from 'discord.js';
import { Command } from '../../utils/types';

const command: Command = {
    data: new SlashCommandBuilder()
        .setName('stop')
        .setDescription('Stops the music and clears the queue'),
    accessGroup: 'music',
    accessKey: 'stop',
    execute: async (interaction) => {
        const player = interaction.client.lavalink.getPlayer(interaction.guildId!);

        if (!player) {
            await interaction.reply({ content: 'No music is currently playing!', ephemeral: true });
            return;
        }

        await player.destroy();
        await interaction.reply('Stopped the music and disconnected!');
    },
};

export default command;
