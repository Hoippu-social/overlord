import { GuildMember, SlashCommandBuilder } from 'discord.js';
import {
    buildCommandDetailEmbed,
    buildGuildHelpView,
    buildHelpAccessDeniedEmbed,
    buildHelpOverviewEmbed,
    buildHelpSelectRow,
    getHelpModules,
    resolveGuildHelpCommand,
} from '../utils/helpMenu';
import { getInteractionLocale, t } from '../utils/i18n';
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
    accessGroup: 'general',
    accessKey: 'help',
    execute: async (interaction) => {
        const locale = await getInteractionLocale(interaction);
        const commandName = interaction.options.getString('command');
        const { commands } = await import('../handlers/commandHandler');
        const parentChannelId = interaction.channel && 'parentId' in interaction.channel ? interaction.channel.parentId : null;

        const member = interaction.guildId && interaction.guild
            ? (
                interaction.member instanceof GuildMember
                    ? interaction.member
                    : await interaction.guild.members.fetch(interaction.user.id).catch(() => null)
            )
            : null;

        if (interaction.guildId && interaction.guild && !member) {
            await interaction.reply({ content: t(locale, 'general.memberResolveFailed'), ephemeral: true });
            return;
        }

        if (commandName) {
            if (interaction.guildId && interaction.guild && member) {
                const result = await resolveGuildHelpCommand(locale, commandName, commands, member, {
                    channelId: interaction.channelId,
                    parentChannelId,
                });

                const helpModules = getHelpModules(locale, commands);
                const detail = result.state === 'allowed'
                    ? buildCommandDetailEmbed(commandName, locale, helpModules)
                    : result.state === 'denied'
                        ? buildHelpAccessDeniedEmbed(locale)
                        : buildCommandDetailEmbed(commandName, locale, helpModules);

                await interaction.reply({
                    embeds: [detail],
                    ephemeral: true,
                });
                return;
            }

            const detail = buildCommandDetailEmbed(commandName, locale, getHelpModules(locale, commands));
            await interaction.reply({
                embeds: [detail],
                ephemeral: true,
            });
            return;
        }

        const modules = interaction.guildId && interaction.guild && member
            ? (await buildGuildHelpView(locale, commands, member, {
                channelId: interaction.channelId,
                parentChannelId,
            })).modules
            : getHelpModules(locale, commands);
        const overview = buildHelpOverviewEmbed(locale, modules);
        const components = [buildHelpSelectRow(interaction.user.id, locale, modules)];

        await interaction.reply({
            embeds: [overview],
            components,
            ephemeral: true,
        });
    },
};

export default command;
