import { SlashCommandBuilder, GuildMember } from 'discord.js';
import { getGuildLocale, t } from '../../utils/i18n';
import { Command } from '../../utils/types';

const command: Command = {
    data: new SlashCommandBuilder()
        .setName('volume')
        .setDescription('Sets the player volume')
        .addIntegerOption(option =>
            option.setName('level')
                .setDescription('Volume level (0-150)')
                .setMinValue(0)
                .setMaxValue(150)
                .setRequired(false)
        ) as any,
    execute: async (interaction) => {
        const locale = await getGuildLocale(interaction.guildId);
        const member = interaction.member as GuildMember;
        const voiceChannel = member.voice.channel;

        if (!voiceChannel) {
            await interaction.reply({ content: t(locale, 'general.notVoice'), ephemeral: true });
            return;
        }

        const player = interaction.client.lavalink.getPlayer(interaction.guildId!);

        if (!player) {
            await interaction.reply({ content: t(locale, 'general.playerMissing'), ephemeral: true });
            return;
        }

        if (player.voiceChannelId !== voiceChannel.id) {
            await interaction.reply({ content: t(locale, 'general.notSameVoice'), ephemeral: true });
            return;
        }

        const level = interaction.options.getInteger('level');

        if (level === null) {
            await interaction.reply({ content: t(locale, 'music.volume.current', { value: player.volume }), ephemeral: true });
            return;
        }

        await player.setVolume(level);
        await player.musicHandler?.setNowPlaying(player.queue.current, { volume: level, positionMs: player.position, paused: player.paused });

        await interaction.reply(t(locale, 'music.volume.set', { value: level }));
    },
};

export default command;
