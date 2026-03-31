import { GuildMember, SlashCommandBuilder } from 'discord.js';
import { localizeDescription } from '../../utils/commandLocalizations';
import { getInteractionLocale, t } from '../../utils/i18n';
import { Command } from '../../utils/types';

const command: Command = {
    data: localizeDescription(new SlashCommandBuilder().setName('pause'), {
        en: 'Pause the current track',
        ru: 'Поставить текущий трек на паузу',
    }),
    accessGroup: 'music',
    accessKey: 'pause',
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

        if (player.paused) {
            await interaction.reply({ content: t(locale, 'music.pause.already'), ephemeral: true });
            return;
        }

        await player.pause();
        await interaction.reply({ content: t(locale, 'music.pause.done'), ephemeral: true });
    },
};

export default command;
