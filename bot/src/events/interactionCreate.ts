import { Events, GuildMember, Interaction } from 'discord.js';
import logger from '../utils/logger';
import { getCommandDefaultMemberPermissions } from '../utils/commandPermissions';
import { isCommandAllowedInChannel } from '../utils/commandChannelAccess';
import {
    buildGuildHelpView,
    buildHelpModuleEmbed,
    buildHelpOverviewEmbed,
    buildHelpSelectRow,
    HELP_MENU_CUSTOM_ID,
    getHelpCommandNames,
    getHelpModules,
} from '../utils/helpMenu';
import { getInteractionLocale, t } from '../utils/i18n';

export default {
    name: Events.InteractionCreate,
    async execute(interaction: Interaction) {
        if (interaction.isAutocomplete()) {
            if (interaction.commandName !== 'help') return;

            const locale = await getInteractionLocale(interaction);
            const focused = interaction.options.getFocused().trim().toLowerCase();
            const { commands } = await import('../handlers/commandHandler');

            const member = interaction.guildId && interaction.guild
                ? (
                    interaction.member instanceof GuildMember
                        ? interaction.member
                        : await interaction.guild.members.fetch(interaction.user.id).catch(() => null)
                )
                : null;
            if (interaction.guildId && interaction.guild && !member) {
                await interaction.respond([]);
                return;
            }
            const parentChannelId = interaction.channel && 'parentId' in interaction.channel ? interaction.channel.parentId : null;
            const commandNames = interaction.guildId && interaction.guild && member
                ? (await buildGuildHelpView(locale, commands, member, {
                    channelId: interaction.channelId,
                    parentChannelId,
                })).commandNames
                : getHelpCommandNames(getHelpModules(locale, commands));

            const matches = commandNames
                .filter((commandName) => commandName.includes(focused))
                .slice(0, 25)
                .map((commandName) => ({
                    name: `/${commandName}`,
                    value: commandName,
                }));

            try {
                await interaction.respond(matches);
            } catch (error) {
                logger.error('Error responding to help autocomplete:', error);
            }
            return;
        }

        if (interaction.isChatInputCommand()) {
            const { commands } = await import('../handlers/commandHandler');
            const command = commands.get(interaction.commandName);
            if (!command) {
                logger.error(`No command matching ${interaction.commandName} was found.`);
                return;
            }

            const locale = await getInteractionLocale(interaction);
            const parentChannelId = interaction.channel && 'parentId' in interaction.channel ? interaction.channel.parentId : null;

            if (interaction.guildId) {
                const allowedInChannel = await isCommandAllowedInChannel({
                    guildId: interaction.guildId,
                    channelId: interaction.channelId,
                    parentChannelId,
                });

                if (!allowedInChannel) {
                    await interaction.reply({ content: t(locale, 'general.commandChannelRestricted'), ephemeral: true });
                    return;
                }
            }

            if ((command.accessGroup || command.accessKey || command.requiredAccessLevel !== undefined) && interaction.guildId && interaction.guild) {
                const { ensureModeratorAccess } = await import('../services/ModerationService');
                const member = interaction.member instanceof GuildMember
                    ? interaction.member
                    : await interaction.guild.members.fetch(interaction.user.id).catch(() => null);

                if (!member) {
                    await interaction.reply({ content: t(locale, 'general.memberResolveFailed'), ephemeral: true });
                    return;
                }

                const allowed = await ensureModeratorAccess(interaction.guildId, member, {
                    accessGroup: command.accessGroup,
                    accessKey: command.accessKey ?? interaction.commandName,
                    requiredAccessLevel: command.requiredAccessLevel,
                    requiredDiscordPermissions: getCommandDefaultMemberPermissions(command),
                    channelId: interaction.channelId,
                    parentChannelId,
                });

                if (!allowed) {
                    await interaction.reply({ content: t(locale, 'general.noModerationAccess'), ephemeral: true });
                    return;
                }
            }

            const musicCommands = ['play', 'skip', 'stop', 'pause', 'resume', 'queue', 'volume', 'loop', 'shuffle', 'nowplaying'];
            if (musicCommands.includes(interaction.commandName) && interaction.guildId) {
                const { prisma } = await import('../utils/database');
                const musicConfig = await prisma.musicConfig.findUnique({ where: { guildId: interaction.guildId } });

                if (musicConfig) {
                    if (musicConfig.allowedChannels) {
                        const allowedChannels = JSON.parse(musicConfig.allowedChannels) as string[];
                        const member = interaction.member as GuildMember;
                        const voiceChannelId = member.voice.channelId;

                        if (musicConfig.channelMode === 'WHITELIST') {
                            if (!voiceChannelId || !allowedChannels.includes(voiceChannelId)) {
                                await interaction.reply({ content: t(locale, 'interactions.musicChannelWhitelist'), ephemeral: true });
                                return;
                            }
                        } else if (musicConfig.channelMode === 'BLACKLIST') {
                            if (voiceChannelId && allowedChannels.includes(voiceChannelId)) {
                                await interaction.reply({ content: t(locale, 'interactions.musicChannelBlacklist'), ephemeral: true });
                                return;
                            }
                        }
                    }

                    if (musicConfig.djMode && musicConfig.djRoles) {
                        const member = interaction.member as GuildMember;
                        const djRoles = JSON.parse(musicConfig.djRoles) as string[];
                        const hasDJRole = member.roles.cache.some((role) => djRoles.includes(role.id));
                        const isAdmin = member.permissions.has('Administrator');

                        if (!hasDJRole && !isAdmin) {
                            await interaction.reply({ content: t(locale, 'interactions.djOnly'), ephemeral: true });
                            return;
                        }
                    }
                }
            }

            try {
                await command.execute(interaction);
            } catch (error) {
                logger.error(`Error executing ${interaction.commandName}:`, error);
                const replyOpts = { content: t(locale, 'general.commandError'), ephemeral: true };
                if (interaction.replied || interaction.deferred) await interaction.followUp(replyOpts);
                else await interaction.reply(replyOpts);
            }
            return;
        }

        if (interaction.isStringSelectMenu() && interaction.customId.startsWith(`${HELP_MENU_CUSTOM_ID}:`)) {
            const locale = await getInteractionLocale(interaction);
            const [, ownerId] = interaction.customId.split(':');

            if (interaction.user.id !== ownerId) {
                await interaction.reply({
                    content: t(locale, 'general.notForYou'),
                    ephemeral: true,
                });
                return;
            }

            const { commands } = await import('../handlers/commandHandler');
            const member = interaction.guildId && interaction.guild
                ? (
                    interaction.member instanceof GuildMember
                        ? interaction.member
                        : await interaction.guild.members.fetch(interaction.user.id).catch(() => null)
                )
                : null;
            if (interaction.guildId && interaction.guild && !member) {
                await interaction.reply({
                    content: t(locale, 'general.error'),
                    ephemeral: true,
                });
                return;
            }
            const parentChannelId = interaction.channel && 'parentId' in interaction.channel ? interaction.channel.parentId : null;
            const modules = interaction.guildId && interaction.guild && member
                ? (await buildGuildHelpView(locale, commands, member, {
                    channelId: interaction.channelId,
                    parentChannelId,
                })).modules
                : getHelpModules(locale, commands);
            const moduleId = interaction.values[0] ?? 'all';
            const activeModuleId = moduleId !== 'all' && !modules.some((module) => module.id === moduleId)
                ? 'all'
                : moduleId;
            const embed = activeModuleId === 'all'
                ? buildHelpOverviewEmbed(locale, modules)
                : buildHelpModuleEmbed(activeModuleId, locale, modules);

            try {
                await interaction.update({
                    embeds: [embed],
                    components: [buildHelpSelectRow(ownerId, locale, modules, activeModuleId)],
                });
            } catch (error) {
                logger.error('Error updating help menu:', error);
                const replyOpts = {
                    content: t(locale, 'general.error'),
                    ephemeral: true,
                };

                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp(replyOpts).catch(() => null);
                } else {
                    await interaction.reply(replyOpts).catch(() => null);
                }
            }
        }
    },
};
