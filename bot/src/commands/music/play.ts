import { SlashCommandBuilder, GuildMember, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { Command } from '../../utils/types';
import logger from '../../utils/logger';

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
        try {
            const member = interaction.member as GuildMember;
            const voiceChannel = member.voice.channel;

            if (!voiceChannel) {
                await interaction.reply({ content: 'You need to be in a voice channel!', ephemeral: true });
                return;
            }

            const query = interaction.options.getString('query', true);
            await interaction.deferReply({ ephemeral: true });

            const player = interaction.client.lavalink.getPlayer(interaction.guildId!);

            if (player) {
                if (player.voiceChannelId !== voiceChannel.id) {
                    await interaction.editReply('You need to be in the same voice channel as the bot!');
                    return;
                }
            } else {
                await interaction.client.lavalink.createPlayer({
                    guildId: interaction.guildId!,
                    voiceChannelId: voiceChannel.id,
                    textChannelId: interaction.channelId,
                    selfDeaf: true,
                    selfMute: false,
                    volume: 100,
                });
            }

            const newPlayer = interaction.client.lavalink.getPlayer(interaction.guildId!);
            if (!newPlayer) {
                await interaction.editReply('Failed to create player.');
                return;
            }

            if (!newPlayer.connected) await newPlayer.connect();

            // Check if query is a URL or text search
            const isUrl = /^https?:\/\//i.test(query);

            if (!isUrl) {
                // Automatically search on YouTube for text queries
                const result = await newPlayer.search({ query: 'ytsearch:' + query }, interaction.user);

                if (result.loadType === 'empty' || !result.tracks.length) {
                    await interaction.editReply('No results found!');
                    return;
                }

                // Show top 10 results
                const tracks = result.tracks.slice(0, 10);

                const platformSelect = new StringSelectMenuBuilder()
                    .setCustomId(`search_platform_${interaction.user.id}`)
                    .setPlaceholder('Площадка: YouTube')
                    .addOptions(
                        new StringSelectMenuOptionBuilder()
                            .setLabel('YouTube')
                            .setDescription('Поиск видео на YouTube')
                            .setValue('ytsearch:')
                            .setEmoji('🔴'),
                        new StringSelectMenuOptionBuilder()
                            .setLabel('Spotify')
                            .setDescription('Поиск треков на Spotify')
                            .setValue('spsearch:')
                            .setEmoji('🟢'),
                        new StringSelectMenuOptionBuilder()
                            .setLabel('SoundCloud')
                            .setDescription('Поиск на SoundCloud')
                            .setValue('scsearch:')
                            .setEmoji('🟠')
                    );

                const trackSelect = new StringSelectMenuBuilder()
                    .setCustomId(`search_track_${interaction.user.id}`)
                    .setPlaceholder('Выберите трек')
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
                    .setLabel('Изменить трек')
                    .setStyle(ButtonStyle.Secondary);

                const cancelButton = new ButtonBuilder()
                    .setCustomId(`search_cancel_${interaction.user.id}`)
                    .setLabel('Отмена')
                    .setStyle(ButtonStyle.Danger);

                const row1 = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(platformSelect);
                const row2 = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(trackSelect);
                const row3 = new ActionRowBuilder<ButtonBuilder>().addComponents(changeButton, cancelButton);

                await interaction.editReply({
                    content: `🎵 Результаты поиска для: **${query}**`,
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
                await interaction.editReply('No results found!');
                return;
            }

            if (result.loadType === 'error') {
                await interaction.editReply('An error occurred while loading the track.');
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

                const playlistName = result.pluginInfo?.identifier || result.tracks[0]?.info.title || 'Unknown Playlist';
                await interaction.editReply(`Playlist **${playlistName}** added! (${result.tracks.length} tracks)`);
            } else {
                // Single track or search result
                const track = result.tracks[0];
                track.requester = interaction.user.id;
                await newPlayer.queue.add(track);

                if (!newPlayer.playing) await newPlayer.play();

                await interaction.editReply(`**${track.info.title}** enqueued!`);
            }

        } catch (error) {
            logger.error('Error executing play command:', error);
            if (interaction.deferred) {
                await interaction.editReply('An error occurred while trying to play music.');
            } else {
                await interaction.reply({ content: 'An error occurred while trying to play music.', ephemeral: true });
            }
        }
    },
};

export default command;
