import { SlashCommandBuilder } from 'discord.js';
import {
    buildCommandDetailEmbed,
    buildHelpOverviewEmbed,
    buildHelpSelectRow,
} from '../utils/helpMenu';
import { getInteractionLocale } from '../utils/i18n';
import { Command } from '../utils/types';

const command: Command = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Show the bot help menu')
        .setDescriptionLocalizations({
            ru: 'Показать справку по командам бота'
        })
        .addStringOption((option) =>
            option
                .setName('command')
                .setDescription('Command name to view details')
                .setDescriptionLocalizations({
                    ru: 'Название команды для подробной справки'
                })
                .setRequired(false)
                .setAutocomplete(true)
        ),
    execute: async (interaction) => {
        const locale = await getInteractionLocale(interaction);
        const commandName = interaction.options.getString('command');

        if (commandName) {
            const detail = buildCommandDetailEmbed(commandName, locale);
            await interaction.reply({
                embeds: [detail],
                ephemeral: true,
            });
            return;
        }

        const overview = buildHelpOverviewEmbed(locale);
        const components = [buildHelpSelectRow(interaction.user.id, locale)];

        await interaction.reply({
            embeds: [overview],
            components,
            ephemeral: true,
        });
    },
};

export default command;
