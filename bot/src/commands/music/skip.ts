import { GuildMember, SlashCommandBuilder } from 'discord.js';
import { localizeDescription } from '../../utils/commandLocalizations';
import { getInteractionLocale, t } from '../../utils/i18n';
import { Command } from '../../utils/types';

const command: Command = {
    data: localizeDescription(new SlashCommandBuilder().setName('skip'), {
        en: 'Skip the current track',
        ru: 'Пропустить текущий трек',
    }),
    accessGroup: 'music',
    accessKey: 'skip',
    execute: async (interaction) => {
        const locale = await getInteractionLocale(interaction);
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
        await interaction.reply({ content: t(locale, 'music.skip.done', { title: currentTrack.info.title }), ephemeral: true });
    },
};

export default command;
