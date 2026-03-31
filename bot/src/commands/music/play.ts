import { GuildMember, SlashCommandBuilder } from 'discord.js';
import { localizeDescription } from '../../utils/commandLocalizations';
import { getInteractionLocale, t } from '../../utils/i18n';
import logger from '../../utils/logger';
import { buildSearchComponents } from '../../utils/musicSearchUi';
import { Command } from '../../utils/types';

const command: Command = {
    data: localizeDescription(
        new SlashCommandBuilder()
            .setName('play')
            .addStringOption((option) =>
                localizeDescription(option.setName('query').setRequired(true), {
                    en: 'The song to play',
                    ru: 'Песня или ссылка для воспроизведения',
                })
            ) as any,
        {
            en: 'Play a song',
            ru: 'Воспроизвести песню',
        }
    ),
    accessGroup: 'music',
    accessKey: 'play',
    execute: async (interaction) => {
        const locale = await getInteractionLocale(interaction);
        try {
            const member = interaction.member as GuildMember;
            const voiceChannel = member.voice.channel;

            if (!voiceChannel) {
                await interaction.reply({ content: t(locale, 'general.notVoice'), ephemeral: true });
                return;
            }

            const query = interaction.options.getString('query', true);
            await interaction.deferReply({ ephemeral: true });

            const player = interaction.client.lavalink.getPlayer(interaction.guildId!);

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
                    volume: 100,
                });
            }

            const newPlayer = interaction.client.lavalink.getPlayer(interaction.guildId!);
            if (!newPlayer) {
                await interaction.editReply(t(locale, 'music.play.failedCreate'));
                return;
            }

            if (!newPlayer.connected) await newPlayer.connect();

            const isUrl = /^https?:\/\//i.test(query);

            if (!isUrl) {
                const result = await newPlayer.search({ query: `ytsearch:${query}` }, interaction.user);

                if (result.loadType === 'empty' || !result.tracks.length) {
                    await interaction.editReply(t(locale, 'search.noResults'));
                    return;
                }

                const tracks = result.tracks.slice(0, 10);
                await interaction.editReply({
                    content: t(locale, 'music.play.searchPrompt', { query }),
                    components: buildSearchComponents(locale, interaction.user.id, tracks, 'ytsearch:'),
                });

                newPlayer.set('pendingSearch', query);
                newPlayer.set('searchResults', tracks);
                newPlayer.set('selectedPrefix', 'ytsearch:');
                return;
            }

            const result = await newPlayer.search({ query }, interaction.user);

            if (result.loadType === 'empty') {
                await interaction.editReply(t(locale, 'search.noResults'));
                return;
            }

            if (result.loadType === 'error') {
                await interaction.editReply(t(locale, 'music.play.errorLoading'));
                return;
            }

            if (result.loadType === 'playlist') {
                for (const track of result.tracks) {
                    track.requester = interaction.user.id;
                }
                await newPlayer.queue.add(result.tracks);

                if (!newPlayer.playing) await newPlayer.play();

                const playlistName = result.pluginInfo?.identifier || result.tracks[0]?.info.title || t(locale, 'music.play.unknownPlaylist');
                await interaction.editReply(t(locale, 'music.play.playlistAdded', {
                    name: playlistName,
                    count: result.tracks.length,
                }));
            } else {
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
