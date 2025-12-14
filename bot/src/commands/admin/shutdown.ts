import { SlashCommandBuilder } from 'discord.js';
import { Command } from '../../utils/types';

const command: Command = {
    data: new SlashCommandBuilder()
        .setName('shutdown')
        .setDescription('Shuts down the bot (Admin only)'),
    execute: async (interaction) => {
        // Check if user has admin permissions
        if (!interaction.memberPermissions?.has('Administrator')) {
            await interaction.reply({ content: 'You need Administrator permissions to use this command!', ephemeral: true });
            return;
        }

        await interaction.reply({ content: 'Shutting down bot... 👋', ephemeral: true });

        // Gracefully destroy the client and exit
        setTimeout(async () => {
            await interaction.client.destroy();
            process.exit(0);
        }, 1000);
    },
};

export default command;
