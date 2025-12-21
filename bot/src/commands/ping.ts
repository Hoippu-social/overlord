import { SlashCommandBuilder } from 'discord.js';
import { Command } from '../utils/types';
import { getInteractionLocale, t } from '../utils/i18n';

const command: Command = {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Replies with Pong!'),
    execute: async (interaction) => {
        const locale = await getInteractionLocale(interaction);
        await interaction.reply(t(locale, 'general.ping'));
    },
};

export default command;
