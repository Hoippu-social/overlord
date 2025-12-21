import { SlashCommandBuilder, GuildMember } from 'discord.js';
import { getGuildLocale, t } from '../../utils/i18n';
import { Command } from '../../utils/types';

const command: Command = {
    data: new SlashCommandBuilder()
        .setName('skip')
        .setDescription('Skips the current track'),
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

        const currentTrack = player.queue.current;
        await player.skip();

        await interaction.reply(t(locale, 'music.skip.done', { title: currentTrack.info.title }));
    },
};

export default command;
