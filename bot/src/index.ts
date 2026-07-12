import { Client, GatewayIntentBits, Partials } from 'discord.js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { LavalinkManager } from 'lavalink-client';
import { loadCommands } from './handlers/commandHandler';
import { loadEvents } from './handlers/eventHandler';
import { handleAiModerationButton, isAiModerationButton } from './services/AiModerationService';
import { ModerationLifecycleService } from './services/ModerationLifecycleService';
import { RetentionService } from './services/RetentionService';
import { TicketLifecycleService } from './services/TicketLifecycleService';
import { EconomyEarnService } from './services/EconomyEarnService';
import { EconomyLifecycleService } from './services/EconomyLifecycleService';
import { StatsService } from './services/StatsService';
import { connectDB, prisma } from './utils/database';
import { getInteractionLocale, t } from './utils/i18n';
import { initializeLavalink } from './utils/LavalinkManager';
import logger from './utils/logger';
import { buildSearchComponents, buildSearchModal } from './utils/musicSearchUi';

declare module 'discord.js' {
    interface Client {
        lavalink: LavalinkManager;
    }
}

dotenv.config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions,
    ],
    partials: [
        Partials.Channel,
        Partials.GuildMember,
        Partials.Message,
        Partials.Reaction,
    ],
    presence: {
        status: 'online',
        activities: [{
            name: '/play',
            type: 0,
        }],
    },
});

client.on('error', (error) => {
    logger.error('Discord Client Error:', error);
});

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
    StatsService.shutdown();
    ModerationLifecycleService.stop();
    RetentionService.stop();
    TicketLifecycleService.stop();
    EconomyEarnService.shutdown();
    EconomyLifecycleService.stop();
    cleanup();
    client.destroy();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    logger.info('Received SIGTERM, shutting down gracefully...');
    StatsService.shutdown();
    ModerationLifecycleService.stop();
    RetentionService.stop();
    TicketLifecycleService.stop();
    EconomyEarnService.shutdown();
    EconomyLifecycleService.stop();
    cleanup();
    client.destroy();
    process.exit(0);
});

process.on('uncaughtException', (error) => {
    const msg = error.message ?? '';
    if (
        msg.includes('Lavalink') ||
        msg.includes('/v4/info') ||
        msg.includes('not connected') ||
        msg.includes('ECONNREFUSED') ||
        msg.includes('WebSocket was closed before the connection was established')
    ) {
        logger.warn('[Process] Non-fatal Lavalink error (server may not be running yet):', msg);
    } else {
        logger.error('[Process] Uncaught exception:', error);
        process.exit(1);
    }
});

process.on('unhandledRejection', (reason) => {
    logger.error('[Process] Unhandled rejection:', reason);
});

async function main() {
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

    initializeLavalink(client);

    await loadEvents(client);
    await loadCommands(client);

    await client.login(token);
}

client.on('raw', (data) => client.lavalink.sendRawData(data));

client.on('interactionCreate', async (interaction) => {
    if (interaction.isModalSubmit() && interaction.customId.startsWith('search_modal_')) {
        const locale = await getInteractionLocale(interaction);
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

        const selectedPrefix = String(player.get('selectedPrefix') || 'ytsearch:');
        const result = await player.search({ query: selectedPrefix + newQuery }, interaction.user);

        if (result.loadType === 'empty' || !result.tracks.length) {
            await interaction.editReply({ content: t(locale, 'search.noResults'), components: [] });
            return;
        }

        const tracks = result.tracks.slice(0, 10);
        await interaction.editReply({
            content: t(locale, 'search.title', { query: newQuery }),
            components: buildSearchComponents(locale, interaction.user.id, tracks, selectedPrefix),
        });

        player.set('pendingSearch', newQuery);
        player.set('searchResults', tracks);
        return;
    }

    if (interaction.isStringSelectMenu()) {
        const locale = await getInteractionLocale(interaction);
        const customId = interaction.customId;

        if (customId.startsWith('search_platform_')) {
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

            const pendingSearch = String(player.get('pendingSearch') || '');
            if (!pendingSearch) {
                await interaction.followUp({ content: t(locale, 'search.pendingMissing'), ephemeral: true });
                return;
            }

            const prefix = String(interaction.values[0]);
            const result = await player.search({ query: prefix + pendingSearch }, interaction.user);

            if (result.loadType === 'empty' || !result.tracks.length) {
                await interaction.editReply({ content: t(locale, 'search.noResults'), components: [] });
                return;
            }

            const tracks = result.tracks.slice(0, 10);
            await interaction.editReply({
                content: t(locale, 'search.title', { query: pendingSearch }),
                components: buildSearchComponents(locale, interaction.user.id, tracks, prefix),
            });

            player.set('searchResults', tracks);
            player.set('selectedPrefix', prefix);
            return;
        }

        if (customId.startsWith('search_track_')) {
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

            const searchResults = player.get('searchResults') as any[] | undefined;
            if (!searchResults) {
                await interaction.followUp({ content: t(locale, 'search.pendingMissing'), ephemeral: true });
                return;
            }

            const trackIndex = Number.parseInt(interaction.values[0], 10);
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
                components: [],
            });

            player.set('pendingSearch', undefined);
            player.set('searchResults', undefined);
            return;
        }
    }

    if (!interaction.isButton()) return;

    const locale = await getInteractionLocale(interaction);
    const customId = interaction.customId;

    if (isAiModerationButton(customId)) {
        await handleAiModerationButton(interaction);
        return;
    }

    if (customId.startsWith('search_cancel_')) {
        const userId = customId.split('_')[2];
        if (interaction.user.id !== userId) {
            await interaction.reply({ content: t(locale, 'general.notForYou'), ephemeral: true });
            return;
        }

        await interaction.update({
            content: t(locale, 'search.cancelled'),
            components: [],
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

        const pendingSearch = String(player.get('pendingSearch') || '');
        await interaction.showModal(buildSearchModal(locale, interaction.user.id, pendingSearch));
        return;
    }

    if (!customId.startsWith('player_')) return;

    const player = client.lavalink.getPlayer(interaction.guildId!);
    if (!player || !player.musicHandler) {
        await interaction.reply({ content: t(locale, 'general.playerMissing'), ephemeral: true });
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
            return;

        case 'player_prev': {
            const success = await player.musicHandler?.playPrevious();
            if (!success) {
                await interaction.followUp({ content: t(locale, 'interactions.prevTrackMissing'), ephemeral: true });
            }
            return;
        }

        case 'player_loop':
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

        case 'player_queue': {
            const tracks = player.queue.tracks
                .slice(0, 10)
                .map((track, index) => `${index + 1}. ${track.info.title}`)
                .join('\n');

            await interaction.followUp({
                content: t(locale, 'interactions.queueCheck', {
                    tracks: tracks || t(locale, 'interactions.queueEmpty'),
                }),
                ephemeral: true,
            });
            return;
        }
    }

    await player.musicHandler.updateMessage(true);
});

client.once('ready', async () => {
    logger.info(`Logged in as ${client.user?.tag} !`);
    client.lavalink.init({
        id: client.user!.id,
        username: client.user!.username,
    });

    logger.info('Syncing guild data...');
    for (const guild of client.guilds.cache.values()) {
        await syncGuildData(guild);
    }
    logger.info('Guild data synced!');
});

async function syncGuildData(guild: any) {
    try {
        const channels = guild.channels.cache.map((channel: any) => ({
            id: channel.id,
            name: channel.name,
            type: channel.type,
            position: channel.position,
            parentId: channel.parentId || null,
        }));

        const roles = guild.roles.cache.map((role: any) => ({
            id: role.id,
            name: role.name,
            color: role.hexColor,
            permissions: role.permissions.bitfield.toString(),
            position: role.position,
        }));

        await prisma.guild.upsert({
            where: { id: guild.id },
            update: {
                name: guild.name,
                icon: guild.icon,
                channels: JSON.stringify(channels),
                roles: JSON.stringify(roles),
            },
            create: {
                id: guild.id,
                name: guild.name,
                icon: guild.icon,
                channels: JSON.stringify(channels),
                roles: JSON.stringify(roles),
            },
        });

        const musicConfig = await prisma.musicConfig.findUnique({ where: { guildId: guild.id } });
        if (!musicConfig) {
            await prisma.musicConfig.create({
                data: {
                    guildId: guild.id,
                },
            });
        }
    } catch (error) {
        logger.error(`Failed to sync guild ${guild.name} (${guild.id}): `, error);
    }
}

client.on('channelCreate', (channel) => {
    if ('guild' in channel) syncGuildData(channel.guild);
});
client.on('channelDelete', (channel) => {
    if ('guild' in channel) syncGuildData(channel.guild);
});
client.on('channelUpdate', (_oldChannel, newChannel) => {
    if ('guild' in newChannel) syncGuildData(newChannel.guild);
});
client.on('roleCreate', (role) => syncGuildData(role.guild));
client.on('roleDelete', (role) => syncGuildData(role.guild));
client.on('roleUpdate', (_oldRole, newRole) => syncGuildData(newRole.guild));

main();
