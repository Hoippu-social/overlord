import { SlashCommandBuilder } from 'discord.js';
import { Command } from '../utils/types';
import { localizeDescription } from '../utils/commandLocalizations';
import { getInteractionLocale, t } from '../utils/i18n';

const command: Command = {
    data: localizeDescription(new SlashCommandBuilder().setName('ping'), {
        en: 'Reply with Pong!',
        ru: 'Ответить Pong!',
    }),
    accessGroup: 'general',
    accessKey: 'ping',
    execute: async (interaction) => {
        const locale = await getInteractionLocale(interaction);
        await interaction.reply({ content: t(locale, 'general.ping'), ephemeral: true });
    },
};

export default command;
