import { SlashCommandBuilder, GuildMember, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { Command } from '../../utils/types';
import { getGuildLocale, t, LocaleCode } from '../../utils/i18n';
import logger from '../../utils/logger';
import { prisma } from '../../utils/database';

const command: Command = {
    data: new SlashCommandBuilder()
        .setName('play')
        .setDescription('Plays a song')
        .addStringOption(option =>
            option.setName('query')
                .setDescription('The song to play')
                .setRequired(true)
        ) as any,
    execute: async (interaction) => {
        let locale: LocaleCode = 'ru';
        try {
            locale = await getGuildLocale(interaction.guildId);
            const member = interaction.member as GuildMember;
            const voiceChannel = member.voice.channel;

            if (!voiceChannel) {
                await interaction.reply({ content: t(locale, 'general.notVoice'), ephemeral: true });
                return;
            }

            const query = interaction.options.getString('query', true);
            await interaction.deferReply({ ephemeral: true });

            const player = interaction.client.lavalink.getPlayer(interaction.guildId!);

            let targetVolume = 100;
            try {
                const cfg = await prisma.musicConfig.upsert({
                    where: { guildId: interaction.guildId! },
                    update: {},
                    create: {
                        guildId: interaction.guildId!,
                        channelMode: 'BLACKLIST',
                        allowedChannels: JSON.stringify([]),
                        djMode: false,
                        djRoles: JSON.stringify([]),
                        defaultVolume: 50,
                    },
                });
                targetVolume = cfg.defaultVolume ?? 100;
            } catch (e) {
                logger.error('Failed to load music config for volume, using default 100', e);
            }

            if (player) {
                if (player.voiceChannelId !== voiceChannel.id) {
                    await interaction.editReply(t(locale, 'music.play.sameChannel'));
                    return;
                }
            } else {
                await interaction.client.lavalink.createPlayer({
                    guildId: interaction.guildId!,
                    voiceChannelId: voiceChannel.id,
                    textChannelId: interaction.channelId,
                    selfDeaf: true,
                    selfMute: false,
                    volume: targetVolume,
                });
            }

            const newPlayer = interaction.client.lavalink.getPlayer(interaction.guildId!);
            if (!newPlayer) {
                await interaction.editReply(t(locale, 'music.play.failedCreate'));
                return;
            }

            if (!newPlayer.connected) await newPlayer.connect();

            // Check if query is a URL or text search
            const isUrl = /^https?:\/\//i.test(query);

            if (!isUrl) {
                // Automatically search on YouTube for text queries
                const result = await newPlayer.search({ query: 'ytsearch:' + query }, interaction.user);

                if (result.loadType === 'empty' || !result.tracks.length) {
                    await interaction.editReply(t(locale, 'search.noResults'));
                    return;
                }

                // Show top 10 results
                const tracks = result.tracks.slice(0, 10);

                const platformSelect = new StringSelectMenuBuilder()
                    .setCustomId(`search_platform_${interaction.user.id}`)
                    .setPlaceholder(t(locale, 'search.platformPlaceholder', { platform: 'YouTube' }))
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
                const row3 = new ActionRowBuilder<ButtonBuilder>().addComponents(changeButton, cancelButton);

                await interaction.editReply({
                    content: t(locale, 'search.title', { query }),
                    components: [row1, row2, row3]
                });

                // Store search data
                newPlayer.set('pendingSearch', query);
                newPlayer.set('searchResults', tracks);
                newPlayer.set('selectedPrefix', 'ytsearch:');
                return;
            }

            // Search for track (URL)
            const result = await newPlayer.search({ query: query }, interaction.user);

            if (result.loadType === 'empty') {
                await interaction.editReply(t(locale, 'search.noResults'));
                return;
            }

            if (result.loadType === 'error') {
                await interaction.editReply(t(locale, 'music.play.errorLoading'));
                return;
            }

            // Handle playlists
            if (result.loadType === 'playlist') {
                // Add all tracks from playlist
                for (const track of result.tracks) {
                    track.requester = interaction.user.id;
                }
                await newPlayer.queue.add(result.tracks);

                if (!newPlayer.playing) await newPlayer.play();

                const playlistName = result.pluginInfo?.identifier || result.tracks[0]?.info.title || t(locale, 'music.play.unknownPlaylist');
                await interaction.editReply(t(locale, 'music.play.playlistAdded', { name: playlistName, count: result.tracks.length }));
            } else {
                // Single track or search result
                const track = result.tracks[0];
                track.requester = interaction.user.id;
                await newPlayer.queue.add(track);

                if (!newPlayer.playing) await newPlayer.play();

                await interaction.editReply(t(locale, 'music.play.trackEnqueued', { title: track.info.title }));
            }

        } catch (error) {
            logger.error('Error executing play command:', error);
            if (interaction.deferred) {
                await interaction.editReply(t(locale, 'music.play.errorGeneric'));
            } else {
                await interaction.reply({ content: t(locale, 'music.play.errorGeneric'), ephemeral: true });
            }
        }
    },
};

export default command;
