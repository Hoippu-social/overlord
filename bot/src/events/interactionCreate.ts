import { Events, Interaction, GuildMember, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { useMainPlayer, useQueue, QueryType } from 'discord-player';
import { buildHelpModuleEmbed, buildHelpOverviewEmbed, buildHelpSelectRow, HELP_MENU_CUSTOM_ID, VISIBLE_COMMANDS } from '../utils/helpMenu';
import { getGuildLocale, t } from '../utils/i18n';
import logger from '../utils/logger';
import { buildAuditConfigUi, deleteAuditRoute, getAuditRoute, upsertAuditRoute } from '../utils/auditConfigUi';

export default {
    name: Events.InteractionCreate,
    async execute(interaction: Interaction) {
        // Autocomplete for /help command lookup
        if (interaction.isAutocomplete()) {
            const focused = interaction.options.getFocused().toLowerCase();
            if (interaction.commandName === 'help') {
                const choices = VISIBLE_COMMANDS
                    .filter((name) => name.toLowerCase().includes(focused))
                    .slice(0, 25)
                    .map((name) => ({ name: `/${name}`, value: name }));
                await interaction.respond(choices);
            }
            return;
        }

        // ----- Context menu handling -----
        if (interaction.isContextMenuCommand()) {
            const { commands } = await import('../handlers/commandHandler');
            const command = commands.get(interaction.commandName);
            if (!command) {
                logger.error(`No context command matching ${interaction.commandName} was found.`);
                return;
            }

            try {
                await command.execute(interaction as any);
            } catch (error) {
                logger.error(`Error executing ${interaction.commandName}:`, error);
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp({ content: 'Command failed.', ephemeral: true });
                } else {
                    await interaction.reply({ content: 'Command failed.', ephemeral: true });
                }
            }
            return;
        }

        // ----- Slash command handling -----
        if (interaction.isChatInputCommand()) {
            const { commands } = await import('../handlers/commandHandler');
            const command = commands.get(interaction.commandName);
            if (!command) {
                logger.error(`No command matching ${interaction.commandName} was found.`);
                return;
            }

            const locale = await getGuildLocale(interaction.guildId);

            // Music Command Restrictions
            const musicCommands = ['play', 'skip', 'stop', 'pause', 'resume', 'queue', 'volume', 'loop', 'shuffle', 'nowplaying'];
            if (musicCommands.includes(interaction.commandName) && interaction.guildId) {
                const { prisma } = await import('../utils/database');
                const musicConfig = await prisma.musicConfig.findUnique({ where: { guildId: interaction.guildId } });

                if (musicConfig) {
                    // Channel Check
                    if (musicConfig.allowedChannels) {
                        const allowedChannels = JSON.parse(musicConfig.allowedChannels) as string[];
                        const member = interaction.member as GuildMember;
                        const voiceChannelId = member.voice.channelId;

                        if (musicConfig.channelMode === 'WHITELIST') {
                            if (!voiceChannelId || !allowedChannels.includes(voiceChannelId)) {
                                await interaction.reply({ content: `❌ ${t(locale, 'interactions.musicChannelWhitelist')}`, ephemeral: true });
                                return;
                            }
                        } else if (musicConfig.channelMode === 'BLACKLIST') {
                            if (voiceChannelId && allowedChannels.includes(voiceChannelId)) {
                                await interaction.reply({ content: `❌ ${t(locale, 'interactions.musicChannelBlacklist')}`, ephemeral: true });
                                return;
                            }
                        }
                    }

                    // DJ Role Check
                    if (musicConfig.djMode && musicConfig.djRoles) {
                        const member = interaction.member as GuildMember;
                        const djRoles = JSON.parse(musicConfig.djRoles) as string[];
                        const hasDJRole = member.roles.cache.some(r => djRoles.includes(r.id));
                        const isAdmin = member.permissions.has('Administrator');

                        if (!hasDJRole && !isAdmin) {
                            await interaction.reply({ content: `❌ ${t(locale, 'interactions.djOnly')}`, ephemeral: true });
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

        // ----- Audit config handling -----
        if (interaction.isStringSelectMenu() && interaction.customId.startsWith('audit_tag_select:')) {
            const [, userId] = interaction.customId.split(':');
            if (interaction.user.id !== userId) {
                await interaction.reply({ content: t(await getGuildLocale(interaction.guildId), 'general.notForYou'), ephemeral: true });
                return;
            }

            const tag = interaction.values[0];
            if (!interaction.guildId) return;
            const ui = await buildAuditConfigUi(interaction.guildId, userId, tag);
            await interaction.update(ui);
            return;
        }

        if (interaction.isChannelSelectMenu() && interaction.customId.startsWith('audit_channel_select:')) {
            const [, tag, userId] = interaction.customId.split(':');
            if (interaction.user.id !== userId) {
                await interaction.reply({ content: t(await getGuildLocale(interaction.guildId), 'general.notForYou'), ephemeral: true });
                return;
            }

            if (!interaction.guildId) return;
            const channelId = interaction.values[0];
            await upsertAuditRoute(interaction.guildId, tag, { channelId, enabled: true });
            const ui = await buildAuditConfigUi(interaction.guildId, userId, tag);
            await interaction.update(ui);
            return;
        }

        // ----- Search Menu Handling -----
        if (interaction.isStringSelectMenu()) {
            if (interaction.customId.startsWith(HELP_MENU_CUSTOM_ID)) {
                const locale = await getGuildLocale(interaction.guildId);
                const [, targetUserId] = interaction.customId.split(':');

                if (targetUserId && targetUserId !== interaction.user.id) {
                    await interaction.reply({ content: t(locale, 'general.notForYou'), ephemeral: true });
                    return;
                }

                const selected = interaction.values[0];
                const embed = selected === 'all'
                    ? buildHelpOverviewEmbed(locale)
                    : buildHelpModuleEmbed(selected, locale);

                await interaction.update({
                    embeds: [embed],
                    components: [buildHelpSelectRow(interaction.user.id, locale, selected)],
                });
                return;
            }

            const player = useMainPlayer();
            if (!player) return;

            if (interaction.customId === 'platform_select') {
                const locale = await getGuildLocale(interaction.guildId);
                await interaction.deferUpdate();

                // Extract query from message content: "Found X tracks for "**query**""
                const content = interaction.message.content;
                const match = content.match(/\*\*(.*?)\*\*/);
                if (!match) {
                    await interaction.followUp({ content: t(locale, 'search.queryExtractFailed'), ephemeral: true });
                    return;
                }
                const query = match[1];
                const searchEngine = interaction.values[0];

                try {
                    const searchResult = await player.search(query, {
                        requestedBy: interaction.user,
                        searchEngine: searchEngine as any
                    });

                    if (!searchResult || searchResult.tracks.length === 0) {
                        await interaction.followUp({ content: t(locale, 'search.noResultsOn', { platform: String(searchEngine) }), ephemeral: true });
                        return;
                    }
                } catch (error) {
                    logger.error('[Search] Error:', error);
                    await interaction.followUp({ content: t(locale, 'search.error'), ephemeral: true });
                }
            } else if (interaction.customId === 'track_select') {
                const locale = await getGuildLocale(interaction.guildId);
                const url = interaction.values[0];
                const member = interaction.member as GuildMember;

                logger.info(`[Track Select] User ${interaction.user.tag} selected: ${url}`);

                if (!member.voice.channel) {
                    await interaction.reply({ content: t(locale, 'general.notVoice'), ephemeral: true });
                    return;
                }

                logger.info(`[Track Select] Voice channel: ${member.voice.channel.name}`);
                await interaction.deferUpdate(); // Acknowledge

                try {
                    logger.info(`[Track Select] Calling player.play() with url: ${url}`);

                    const playResult = await player.play(member.voice.channel, url, {
                        requestedBy: interaction.user,
                        nodeOptions: {
                            metadata: interaction,
                            leaveOnEmpty: true,
                            leaveOnEmptyCooldown: 300000,
                            leaveOnEnd: false,
                            leaveOnStop: false,
                        }
                    });

                    logger.info(`[Track Select] player.play() returned:`, {
                        track: playResult.track?.title,
                        trackUrl: playResult.track?.url,
                        searchResult: !!playResult.searchResult,
                        queueId: playResult.queue?.id
                    });

                    // Success - delete the search menu or replace with success message
                    await interaction.editReply({ content: t(locale, 'search.trackAdded', { title: playResult.track.title }), components: [] });

                    logger.info(`[Track Select] Updated interaction reply successfully`);
                } catch (error) {
                    logger.error('[Track Select] Play Error:', error);
                    await interaction.followUp({ content: t(locale, 'interactions.playFailed', { error: String(error) }), ephemeral: true });
                }
            }
        }

        if (interaction.isButton() && interaction.customId === 'cancel_search') {
            await interaction.message.delete();
            return;
        }

        if (interaction.isButton() && interaction.customId.startsWith('audit_route_')) {
            const parts = interaction.customId.split(':');
            const action = parts[0];
            const tag = parts[1] || '';
            const userId = parts[2] || '';

            if (action === 'audit_route_close') {
                const closeUserId = parts[1] || '';
                if (interaction.user.id !== closeUserId) {
                    await interaction.reply({ content: t(await getGuildLocale(interaction.guildId), 'general.notForYou'), ephemeral: true });
                    return;
                }
                await interaction.update({ content: 'Audit config closed.', embeds: [], components: [] });
                return;
            }

            if (interaction.user.id !== userId) {
                await interaction.reply({ content: t(await getGuildLocale(interaction.guildId), 'general.notForYou'), ephemeral: true });
                return;
            }

            if (!interaction.guildId) return;

            const route = await getAuditRoute(interaction.guildId, tag);

            if (action === 'audit_route_enable') {
                if (!route?.channelId) {
                    await interaction.reply({ content: 'Select a channel first.', ephemeral: true });
                    return;
                }
                await upsertAuditRoute(interaction.guildId, tag, { enabled: true });
            } else if (action === 'audit_route_disable') {
                if (!route) {
                    await interaction.reply({ content: 'Route not set.', ephemeral: true });
                    return;
                }
                await upsertAuditRoute(interaction.guildId, tag, { enabled: false });
            } else if (action === 'audit_route_clear') {
                if (route) {
                    await deleteAuditRoute(interaction.guildId, tag);
                }
            }

            const ui = await buildAuditConfigUi(interaction.guildId, userId, tag);
            await interaction.update(ui);
            return;
        }

        // ----- Button interaction handling for music player -----
        if (!interaction.isButton()) return;

        const validIds = ['previous', 'pause', 'skip', 'stop', 'loop_track', 'loop_queue', 'shuffle', 'vol_down', 'vol_up', 'queue'];
        if (!validIds.includes(interaction.customId)) return;

        // Ensure we have a player instance
        const player = useMainPlayer();
        if (!player) {
            logger.error('[Button] No player instance found.');
            return interaction.reply({ content: t(await getGuildLocale(interaction.guildId), 'interactions.playerNotReady'), ephemeral: true });
        }

        // Retrieve the queue for this guild
        const guildId = interaction.guildId;
        if (!guildId) {
            logger.error('[Button] Interaction missing guildId.');
            return interaction.reply({ content: t(await getGuildLocale(interaction.guildId), 'general.serverUnknown'), ephemeral: true });
        }
        let queue = useQueue(guildId);
        if (!queue && player.nodes) {
            // Fallback: directly access player nodes if useQueue fails
            queue = player.nodes.get(guildId) ?? null;
        }
        logger.debug(`[Button] GuildId: ${guildId}, Queue exists: ${!!queue}`);
        if (!queue) {
            return interaction.reply({ content: t(await getGuildLocale(interaction.guildId), 'interactions.queueMissing'), ephemeral: true });
        }

        // Verify the user is in the same voice channel as the bot
        const member = interaction.member as GuildMember;
        if (member.voice.channelId !== interaction.guild?.members.me?.voice.channelId) {
            return interaction.reply({ content: t(await getGuildLocale(interaction.guildId), 'interactions.sameChannelRequired'), ephemeral: true });
        }

        // Defer the button update to avoid "this interaction failed" messages
        await interaction.deferUpdate();

        // Execute the appropriate action
        switch (interaction.customId) {
            case 'previous':
                if (queue.history.previousTrack) await queue.history.back();
                break;
            case 'pause':
                queue.node.setPaused(!queue.node.isPaused());
                break;
            case 'skip':
                queue.node.skip();
                break;
            case 'stop':
                queue.delete();
                break;
            case 'loop_track':
                // Toggle between TRACK (1) and OFF (0)
                queue.setRepeatMode(queue.repeatMode === 1 ? 0 : 1);
                break;
            case 'loop_queue':
                // Toggle between QUEUE (2) and OFF (0)
                queue.setRepeatMode(queue.repeatMode === 2 ? 0 : 2);
                break;
            case 'shuffle':
                queue.tracks.shuffle();
                break;
            case 'vol_down':
                queue.node.setVolume(Math.max(10, queue.node.volume - 10));
                break;
            case 'vol_up':
                queue.node.setVolume(Math.min(150, queue.node.volume + 10));
                break;
            case 'queue':
                const locale = await getGuildLocale(interaction.guildId);
                const embed = new EmbedBuilder()
                    .setTitle(t(locale, 'interactions.queueTitle'))
                    .setColor('#2f3136');
                if (queue.tracks?.data?.length === 0) {
                    embed.setDescription(t(locale, 'interactions.queueEmpty'));
                } else {
                    const description = queue.tracks.data
                        .map((t: any, i: number) => `${i + 1}. ${t.title}`)
                        .join('\n');
                    embed.setDescription(description);
                }
                await interaction.followUp({ embeds: [embed], ephemeral: true });
                break;
        }
    },
};
