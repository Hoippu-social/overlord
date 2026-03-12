import { Events, Interaction, GuildMember, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { useMainPlayer, useQueue, QueryType } from 'discord-player';
import logger from '../utils/logger';

export default {
    name: Events.InteractionCreate,
    async execute(interaction: Interaction) {
        // ----- Slash command handling -----
        if (interaction.isChatInputCommand()) {
            const { commands } = await import('../handlers/commandHandler');
            const command = commands.get(interaction.commandName);
            if (!command) {
                logger.error(`No command matching ${interaction.commandName} was found.`);
                return;
            }

            if ((command.accessGroup || command.accessKey || command.requiredAccessLevel !== undefined) && interaction.guildId && interaction.guild) {
                const { ensureModeratorAccess } = await import('../services/ModerationService');
                const member = interaction.member instanceof GuildMember
                    ? interaction.member
                    : await interaction.guild.members.fetch(interaction.user.id).catch(() => null);

                if (!member) {
                    await interaction.reply({ content: 'Unable to resolve your guild member state.', ephemeral: true });
                    return;
                }

                const allowed = await ensureModeratorAccess(interaction.guildId, member, {
                    accessGroup: command.accessGroup,
                    accessKey: command.accessKey ?? interaction.commandName,
                    requiredAccessLevel: command.requiredAccessLevel,
                });

                if (!allowed) {
                    await interaction.reply({ content: 'You do not have access to this moderation command.', ephemeral: true });
                    return;
                }
            }

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
                                await interaction.reply({ content: `❌ You must be in a whitelisted Voice Channel to use music commands.`, ephemeral: true });
                                return;
                            }
                        } else if (musicConfig.channelMode === 'BLACKLIST') {
                            if (voiceChannelId && allowedChannels.includes(voiceChannelId)) {
                                await interaction.reply({ content: `❌ Music commands are not allowed in this Voice Channel.`, ephemeral: true });
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
                            await interaction.reply({ content: `❌ DJ Mode is enabled. You need a DJ role to use music commands.`, ephemeral: true });
                            return;
                        }
                    }
                }
            }

            try {
                await command.execute(interaction);
            } catch (error) {
                logger.error(`Error executing ${interaction.commandName}:`, error);
                const replyOpts = { content: 'There was an error while executing this command!', ephemeral: true };
                if (interaction.replied || interaction.deferred) await interaction.followUp(replyOpts);
                else await interaction.reply(replyOpts);
            }
            return;
        }

        // ----- Search Menu Handling -----
        if (interaction.isStringSelectMenu()) {
            const player = useMainPlayer();
            if (!player) return;

            if (interaction.customId === 'platform_select') {
                await interaction.deferUpdate();

                // Extract query from message content: "Found X tracks for "**query**""
                const content = interaction.message.content;
                const match = content.match(/\*\*(.*?)\*\*/);
                if (!match) {
                    await interaction.followUp({ content: 'Could not retrieve query from message.', ephemeral: true });
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
                        await interaction.followUp({ content: `No results found on ${searchEngine}`, ephemeral: true });
                        return;
                    }
                } catch (error) {
                    logger.error('[Search] Error:', error);
                    await interaction.followUp({ content: 'Error searching.', ephemeral: true });
                }
            } else if (interaction.customId === 'track_select') {
                const url = interaction.values[0];
                const member = interaction.member as GuildMember;

                logger.info(`[Track Select] User ${interaction.user.tag} selected: ${url}`);

                if (!member.voice.channel) {
                    await interaction.reply({ content: 'You need to be in a Voice Channel!', ephemeral: true });
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
                    await interaction.editReply({ content: `**${playResult.track.title}** added to queue!`, components: [] });

                    logger.info(`[Track Select] Updated interaction reply successfully`);
                } catch (error) {
                    logger.error('[Track Select] Play Error:', error);
                    await interaction.followUp({ content: `Failed to play: ${error}`, ephemeral: true });
                }
            }
        }

        if (interaction.isButton() && interaction.customId === 'cancel_search') {
            await interaction.message.delete();
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
            return interaction.reply({ content: 'Player is not ready.', ephemeral: true });
        }

        // Retrieve the queue for this guild
        const guildId = interaction.guildId;
        if (!guildId) {
            logger.error('[Button] Interaction missing guildId.');
            return interaction.reply({ content: 'Unable to identify server.', ephemeral: true });
        }
        let queue = useQueue(guildId);
        if (!queue && player.nodes) {
            // Fallback: directly access player nodes if useQueue fails
            queue = player.nodes.get(guildId) ?? null;
        }
        logger.debug(`[Button] GuildId: ${guildId}, Queue exists: ${!!queue}`);
        if (!queue) {
            return interaction.reply({ content: 'No music queue found for this server!', ephemeral: true });
        }

        // Verify the user is in the same voice channel as the bot
        const member = interaction.member as GuildMember;
        if (member.voice.channelId !== interaction.guild?.members.me?.voice.channelId) {
            return interaction.reply({ content: 'You need to be in the same voice channel as the bot!', ephemeral: true });
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
                const embed = new EmbedBuilder()
                    .setTitle('Current Queue')
                    .setColor('#2f3136');
                if (queue.tracks?.data?.length === 0) {
                    embed.setDescription('Queue is empty');
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
