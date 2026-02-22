import { Client, GatewayIntentBits, Partials, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import logger from './utils/logger';
import { getGuildLocale, t } from './utils/i18n';
import { connectDB, prisma } from './utils/database';
import { loadCommands } from './handlers/commandHandler';
import { loadEvents } from './handlers/eventHandler';
import { LavalinkManager } from 'lavalink-client';
import { initializeLavalink } from './utils/LavalinkManager';
import { StatsService } from './services/StatsService';

declare module 'discord.js' {
    interface Client {
        lavalink: LavalinkManager;
    }
}

dotenv.config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.GuildInvites,
    ],
    partials: [
        Partials.Channel,
        Partials.Message,
        Partials.GuildMember,
    ],
    presence: {
        status: 'online',
        activities: [{
            name: '/play',
            type: 0 // Playing
        }]
    }
});



client.on('error', (error) => {
    logger.error('Discord Client Error:', error);
});

// Graceful shutdown handlers
const pidFile = path.resolve(process.cwd(), 'bot.pid');

const cleanup = () => {
    if (fs.existsSync(pidFile)) {
        try {
            fs.unlinkSync(pidFile);
            logger.info('Removed PID file');
        } catch (error) {
            logger.error('Failed to remove PID file:', error);
        }
    }
};

process.on('SIGINT', async () => {
    logger.info('Received SIGINT, shutting down gracefully...');
    const server = (client as any).dashboardServer;
    if (server) {
        server.close();
        logger.info('Dashboard API server closed');
    }
    cleanup();
    client.destroy();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    logger.info('Received SIGTERM, shutting down gracefully...');
    const server = (client as any).dashboardServer;
    if (server) {
        server.close();
        logger.info('Dashboard API server closed');
    }
    cleanup();
    client.destroy();
    process.exit(0);
});

// Prevent async crashes (e.g. Lavalink WebSocket throws) from killing the process
process.on('unhandledRejection', (reason, promise) => {
    logger.error('[Process] Unhandled rejection:', reason);
});

process.on('uncaughtException', (error) => {
    // Only log Lavalink-related errors; re-throw truly critical ones
    if (error.message?.includes('Lavalink') || error.message?.includes('/v4/info') || error.message?.includes('not connected')) {
        logger.warn('[Process] Non-fatal Lavalink error caught:', error.message);
    } else {
        logger.error('[Process] Uncaught exception:', error);
        // For truly unknown errors, still exit to avoid corrupt state
        process.exit(1);
    }
});

async function main() {
    // Write PID file
    try {
        fs.writeFileSync(pidFile, process.pid.toString());
        logger.info(`PID file created at ${pidFile} (PID: ${process.pid})`);
    } catch (error) {
        logger.error('Failed to create PID file:', error);
    }

    await connectDB();

    const token = process.env.DISCORD_TOKEN;
    if (!token) {
        logger.error('DISCORD_TOKEN is not defined in .env');
        process.exit(1);
    }

    // Initialize StatsService (Dual-DB Architecture)
    await StatsService.init();

    // Initialize Lavalink
    initializeLavalink(client);

    await loadEvents(client);
    await loadCommands(client);

    await client.login(token);
}

// Listen for raw events for Lavalink
client.on('raw', (d) => client.lavalink.sendRawData(d));

client.on('interactionCreate', async (interaction) => {
    // Handle Modal Submit
    if (interaction.isModalSubmit()) {
        if (interaction.customId.startsWith('search_modal_')) {
            const locale = await getGuildLocale(interaction.guildId);
            const userId = interaction.customId.split('_')[2];
            if (interaction.user.id !== userId) {
                await interaction.reply({ content: t(locale, 'general.notForYou'), ephemeral: true });
                return;
            }

            await interaction.deferUpdate();

            const newQuery = interaction.fields.getTextInputValue('search_query');
            const player = client.lavalink.getPlayer(interaction.guildId!);

            if (!player) {
                await interaction.followUp({ content: t(locale, 'general.playerNotFound'), ephemeral: true });
                return;
            }

            const selectedPrefix = player.get('selectedPrefix') || 'ytsearch:';
            const result = await player.search({ query: selectedPrefix + newQuery }, interaction.user);

            if (result.loadType === 'empty' || !result.tracks.length) {
                await interaction.editReply({ content: t(locale, 'search.noResults'), components: [] });
                return;
            }

            const tracks = result.tracks.slice(0, 10);

            const platformSelect = new StringSelectMenuBuilder()
                .setCustomId(`search_platform_${interaction.user.id}`)
                .setPlaceholder(t(locale, 'search.platformPlaceholder', { platform: selectedPrefix === 'ytsearch:' ? 'YouTube' : selectedPrefix === 'spsearch:' ? 'Spotify' : 'SoundCloud' }))
                .addOptions(
                    new StringSelectMenuOptionBuilder()
                        .setLabel('YouTube')
                        .setDescription(t(locale, 'search.platformDesc.youtube'))
                        .setValue('ytsearch:'),
                    new StringSelectMenuOptionBuilder()
                        .setLabel('Spotify')
                        .setDescription(t(locale, 'search.platformDesc.spotify'))
                        .setValue('spsearch:'),
                    new StringSelectMenuOptionBuilder()
                        .setLabel('SoundCloud')
                        .setDescription(t(locale, 'search.platformDesc.soundcloud'))
                        .setValue('scsearch:'),
                );

            const trackSelect = new StringSelectMenuBuilder()
                .setCustomId(`search_track_${interaction.user.id}`)
                .setPlaceholder(t(locale, 'search.trackPlaceholder'))
                .addOptions(
                    tracks.map((track, index) => {
                        const duration = track.info.duration ? `[${Math.floor(track.info.duration / 60000)}:${Math.floor((track.info.duration % 60000) / 1000).toString().padStart(2, '0')}]` : '';
                        return new StringSelectMenuOptionBuilder()
                            .setLabel(`${track.info.title.substring(0, 85)}`)
                            .setDescription(`${track.info.author} ${duration}`.substring(0, 100))
                            .setValue(index.toString());
                    })
                );

            const changeButton = new ButtonBuilder()
                .setCustomId(`search_change_${interaction.user.id}`)
                .setLabel(t(locale, 'search.changeLabel'))
                .setStyle(ButtonStyle.Secondary);

            const cancelButton = new ButtonBuilder()
                .setCustomId(`search_cancel_${interaction.user.id}`)
                .setLabel(t(locale, 'search.cancelLabel'))
                .setStyle(ButtonStyle.Danger);

            const row1 = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(platformSelect);
            const row2 = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(trackSelect);
            const row3 = new ActionRowBuilder<any>().addComponents(changeButton, cancelButton);

            await interaction.editReply({
                content: t(locale, 'search.title', { query: newQuery }),
                components: [row1, row2, row3]
            });

            player.set('pendingSearch', newQuery);
            player.set('searchResults', tracks);
            return;
        }
    }

    // Handle String Select Menus
    if (interaction.isStringSelectMenu()) {
        const customId = interaction.customId;

        // Platform selection
        if (customId.startsWith('search_platform_')) {
            const locale = await getGuildLocale(interaction.guildId);
            const userId = customId.split('_')[2];
            if (interaction.user.id !== userId) {
                await interaction.reply({ content: t(locale, 'general.notForYou'), ephemeral: true });
                return;
            }

            await interaction.deferUpdate();

            const player = client.lavalink.getPlayer(interaction.guildId!);
            if (!player) {
                await interaction.followUp({ content: t(locale, 'general.playerNotFound'), ephemeral: true });
                return;
            }

            const pendingSearch = player.get('pendingSearch') as string | undefined;
            if (!pendingSearch) {
                await interaction.followUp({ content: t(locale, 'search.pendingMissing'), ephemeral: true });
                return;
            }

            const prefix = interaction.values[0]; // 'ytsearch:', 'spsearch:', etc.
            const result = await player.search({ query: prefix + pendingSearch }, interaction.user);

            if (result.loadType === 'empty' || !result.tracks.length) {
                await interaction.editReply({ content: t(locale, 'search.noResults'), components: [] });
                return;
            }

            // Show top 10 results
            const tracks = result.tracks.slice(0, 10);

            const platformName = prefix === 'ytsearch:' ? 'YouTube' : prefix === 'spsearch:' ? 'Spotify' : 'SoundCloud';

            // Recreate platform select
            const platformSelect = new StringSelectMenuBuilder()
                .setCustomId(`search_platform_${interaction.user.id}`)
                .setPlaceholder(t(locale, 'search.platformPlaceholderSelected', { platform: platformName }))
                .addOptions(
                    new StringSelectMenuOptionBuilder()
                        .setLabel('YouTube')
                        .setDescription(t(locale, 'search.platformDesc.youtube'))
                        .setValue('ytsearch:'),
                    new StringSelectMenuOptionBuilder()
                        .setLabel('Spotify')
                        .setDescription(t(locale, 'search.platformDesc.spotify'))
                        .setValue('spsearch:'),
                    new StringSelectMenuOptionBuilder()
                        .setLabel('SoundCloud')
                        .setDescription(t(locale, 'search.platformDesc.soundcloud'))
                        .setValue('scsearch:'),
                );

            const trackSelect = new StringSelectMenuBuilder()
                .setCustomId(`search_track_${interaction.user.id}`)
                .setPlaceholder(t(locale, 'search.trackPlaceholder'))
                .addOptions(
                    tracks.map((track, index) => {
                        const duration = track.info.duration ? `[${Math.floor(track.info.duration / 60000)}:${Math.floor((track.info.duration % 60000) / 1000).toString().padStart(2, '0')}]` : '';
                        return new StringSelectMenuOptionBuilder()
                            .setLabel(`${track.info.title.substring(0, 85)}`)
                            .setDescription(`${track.info.author} ${duration}`.substring(0, 100))
                            .setValue(index.toString());
                    })
                );

            const { ButtonBuilder, ButtonStyle } = await import('discord.js');
            const changeButton = new ButtonBuilder()
                .setCustomId(`search_change_${interaction.user.id}`)
                .setLabel(t(locale, 'search.changeLabel'))
                .setStyle(ButtonStyle.Secondary);

            const cancelButton = new ButtonBuilder()
                .setCustomId(`search_cancel_${interaction.user.id}`)
                .setLabel(t(locale, 'search.cancelLabel'))
                .setStyle(ButtonStyle.Danger);

            const row1 = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(platformSelect);
            const row2 = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(trackSelect);
            const row3 = new ActionRowBuilder<any>().addComponents(changeButton, cancelButton);

            await interaction.editReply({
                content: t(locale, 'search.title', { query: pendingSearch }),
                components: [row1, row2, row3]
            });

            // Store search results
            player.set('searchResults', tracks);
            player.set('selectedPrefix', prefix);
            return;
        }

        // Track selection
        if (customId.startsWith('search_track_')) {
            const locale = await getGuildLocale(interaction.guildId);
            const userId = customId.split('_')[2];
            if (interaction.user.id !== userId) {
                await interaction.reply({ content: t(locale, 'general.notForYou'), ephemeral: true });
                return;
            }

            await interaction.deferUpdate();

            const player = client.lavalink.getPlayer(interaction.guildId!);
            if (!player) {
                await interaction.followUp({ content: t(locale, 'general.playerNotFound'), ephemeral: true });
                return;
            }

            const searchResults = player.get('searchResults') as any[];
            if (!searchResults) {
                await interaction.followUp({ content: t(locale, 'search.pendingMissing'), ephemeral: true });
                return;
            }

            const trackIndex = parseInt(interaction.values[0]);
            const track = searchResults[trackIndex];

            if (!track) {
                await interaction.followUp({ content: t(locale, 'search.invalidSelection'), ephemeral: true });
                return;
            }

            track.requester = interaction.user.id;
            await player.queue.add(track);

            if (!player.playing) await player.play();

            await interaction.editReply({
                content: t(locale, 'search.trackAdded', { title: track.info.title }),
                components: []
            });

            // Clear stored data
            player.set('pendingSearch', undefined);
            player.set('searchResults', undefined);
            return;
        }
    }

    if (!interaction.isButton()) return;

    const customId = interaction.customId;

    // Handle search menu buttons
    if (customId.startsWith('search_cancel_')) {
        const locale = await getGuildLocale(interaction.guildId);
        const userId = customId.split('_')[2];
        if (interaction.user.id !== userId) {
            await interaction.reply({ content: t(locale, 'general.notForYou'), ephemeral: true });
            return;
        }

        await interaction.update({
            content: t(locale, 'search.cancelled'),
            components: []
        });

        const player = client.lavalink.getPlayer(interaction.guildId!);
        if (player) {
            player.set('pendingSearch', undefined);
            player.set('searchResults', undefined);
            player.set('selectedPrefix', undefined);
        }
        return;
    }

    if (customId.startsWith('search_change_')) {
        const locale = await getGuildLocale(interaction.guildId);
        const userId = customId.split('_')[2];
        if (interaction.user.id !== userId) {
            await interaction.reply({ content: t(locale, 'general.notForYou'), ephemeral: true });
            return;
        }

        const player = client.lavalink.getPlayer(interaction.guildId!);
        if (!player) {
            await interaction.reply({ content: t(locale, 'general.playerNotFound'), ephemeral: true });
            return;
        }

        const pendingSearch = player.get('pendingSearch') || '';

        // Show Modal for new search query
        const modal = new ModalBuilder()
            .setCustomId(`search_modal_${interaction.user.id}`)
            .setTitle(t(locale, 'search.modalTitle'));

        const queryInput = new TextInputBuilder()
            .setCustomId('search_query')
            .setLabel(t(locale, 'search.modalLabel'))
            .setStyle(TextInputStyle.Short)
            .setPlaceholder(t(locale, 'search.modalPlaceholder'))
            .setValue(String(pendingSearch))
            .setRequired(true);

        const row = new ActionRowBuilder<TextInputBuilder>().addComponents(queryInput);
        modal.addComponents(row);

        await interaction.showModal(modal);
        return;
    }

    if (!customId.startsWith('player_')) return;

    const player = client.lavalink.getPlayer(interaction.guildId!);
    if (!player || !player.musicHandler) {
        await interaction.reply({ content: t(await getGuildLocale(interaction.guildId), 'general.playerMissing'), ephemeral: true });
        return;
    }

    await interaction.deferUpdate();

    switch (customId) {
        case 'player_pause':
            if (player.paused) await player.resume();
            else await player.pause();
            break;

        case 'player_skip':
            await player.skip();
            break;

        case 'player_stop':
            await player.destroy();
            await interaction.message.delete().catch(() => { });
            return; // Don't update message as it's deleted

        case 'player_prev':
            const success = await player.musicHandler?.playPrevious();
            if (!success) {
                await interaction.followUp({ content: t(await getGuildLocale(interaction.guildId), 'interactions.prevTrackMissing'), ephemeral: true });
            }
            return; // trackStart will send new message

        case 'player_loop':
            // Cycle: off -> queue -> track -> off
            if (player.repeatMode === 'off') await player.setRepeatMode('queue');
            else if (player.repeatMode === 'queue') await player.setRepeatMode('track');
            else await player.setRepeatMode('off');
            break;

        case 'player_vol_up':
            await player.setVolume(Math.min(player.volume + 10, 100));
            break;

        case 'player_vol_down':
            await player.setVolume(Math.max(player.volume - 10, 0));
            break;

        case 'player_queue':
            // Show queue ephemeral
            const locale = await getGuildLocale(interaction.guildId);
            const tracks = player.queue.tracks.slice(0, 10).map((t, i) => `${i + 1}. ${t.info.title}`).join('\n');
            const list = tracks || t(locale, 'interactions.queueEmpty');
            await interaction.followUp({ content: t(locale, 'interactions.queueCheck', { tracks: list }), ephemeral: true });
            return; // Don't update message for queue check
    }

    // Update the player message to reflect changes (force update to bypass rate limit)
    await player.musicHandler.updateMessage(true);
});



const hasPresenceIntent = client.options.intents.has(GatewayIntentBits.GuildPresences);

const getOnlineCount = (guild: any) => {
    if (!hasPresenceIntent) return null;
    const presences = guild?.presences?.cache;
    if (!presences) return null;
    return presences.filter((presence: any) => presence?.status && presence.status !== 'offline' && presence.status !== 'invisible').size;
};

async function syncGuildData(guild: any) {
    try {
        const channels = guild.channels.cache.map((c: any) => ({
            id: c.id,
            name: c.name,
            type: c.type,
            position: c.position,
            parentId: c.parentId || null
        }));

        const roles = guild.roles.cache.map((r: any) => ({
            id: r.id,
            name: r.name,
            color: r.hexColor,
            permissions: r.permissions.bitfield.toString(),
            position: r.position
        }));

        const memberCount = typeof guild.memberCount === 'number' ? guild.memberCount : null;
        const onlineCount = getOnlineCount(guild);

        await prisma.guild.upsert({
            where: { id: guild.id },
            update: {
                name: guild.name,
                icon: guild.icon,
                channels: JSON.stringify(channels),
                roles: JSON.stringify(roles),
                memberCount,
                onlineCount
            },
            create: {
                id: guild.id,
                name: guild.name,
                icon: guild.icon,
                channels: JSON.stringify(channels),
                roles: JSON.stringify(roles),
                memberCount,
                onlineCount
            }
        });

        // Ensure MusicConfig exists
        const musicConfig = await prisma.musicConfig.findUnique({ where: { guildId: guild.id } });
        if (!musicConfig) {
            await prisma.musicConfig.create({
                data: {
                    guildId: guild.id
                }
            });
        }
    } catch (error) {
        logger.error(`Failed to sync guild ${guild.name} (${guild.id}):`, error);
    }
}

const guildSyncTimers = new Map<string, NodeJS.Timeout>();

const scheduleGuildSync = (guild: any, delayMs = 15000) => {
    if (!guild?.id) return;
    if (guildSyncTimers.has(guild.id)) return;
    const timer = setTimeout(() => {
        guildSyncTimers.delete(guild.id);
        syncGuildData(guild);
    }, delayMs);
    guildSyncTimers.set(guild.id, timer);
};

// Auto-sync events
client.on('channelCreate', (channel) => {
    if ('guild' in channel) syncGuildData(channel.guild);
});
client.on('channelDelete', (channel) => {
    if ('guild' in channel) syncGuildData(channel.guild);
});
client.on('channelUpdate', (oldChannel, newChannel) => {
    if ('guild' in newChannel) syncGuildData(newChannel.guild);
});
client.on('roleCreate', (role) => syncGuildData(role.guild));
client.on('roleDelete', (role) => syncGuildData(role.guild));
client.on('roleUpdate', (oldRole, newRole) => syncGuildData(newRole.guild));
client.on('guildMemberAdd', (member) => scheduleGuildSync(member.guild, 2000));
client.on('guildMemberRemove', (member) => scheduleGuildSync(member.guild, 2000));
client.on('presenceUpdate', (_oldPresence, newPresence) => {
    if (newPresence?.guild) scheduleGuildSync(newPresence.guild);
});

main();
