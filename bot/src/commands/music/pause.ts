import { SlashCommandBuilder, GuildMember } from 'discord.js';
import { getGuildLocale, t } from '../../utils/i18n';
import { Command } from '../../utils/types';

const command: Command = {
    data: new SlashCommandBuilder()
        .setName('pause')
        .setDescription('Pauses the current track'),
    execute: async (interaction) => {
        const locale = await getGuildLocale(interaction.guildId);
        const member = interaction.member as GuildMember;
        const voiceChannel = member.voice.channel;

        if (!voiceChannel) {
            await interaction.reply({ content: t(locale, 'general.notVoice'), ephemeral: true });
            return;
        }

        const player = interaction.client.lavalink.getPlayer(interaction.guildId!);

        if (!player || !player.queue.current) {
            await interaction.reply({ content: t(locale, 'general.nothingPlaying'), ephemeral: true });
            return;
        }

        if (player.voiceChannelId !== voiceChannel.id) {
            await interaction.reply({ content: t(locale, 'general.notSameVoice'), ephemeral: true });
            return;
        }

        if (player.paused) {
            await interaction.reply({ content: t(locale, 'music.pause.already'), ephemeral: true });
            return;
        }

        await player.pause();
        await player.musicHandler?.setNowPlaying(player.queue.current, { paused: true, positionMs: player.position });
        await interaction.reply(t(locale, 'music.pause.done'));
    },
};

export default command;
