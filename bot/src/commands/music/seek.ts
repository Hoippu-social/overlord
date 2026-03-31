import { GuildMember, SlashCommandBuilder } from 'discord.js';
import { localizeDescription } from '../../utils/commandLocalizations';
import { getInteractionLocale, t } from '../../utils/i18n';
import { Command } from '../../utils/types';

const command: Command = {
    data: localizeDescription(
        new SlashCommandBuilder()
            .setName('seek')
            .addStringOption((option) =>
                localizeDescription(option.setName('position').setRequired(true), {
                    en: 'Position to seek to, for example 1:30 or 90',
                    ru: 'Позиция перемотки, например 1:30 или 90',
                })
            ) as any,
        {
            en: 'Seek to a specific position in the track',
            ru: 'Перемотать трек на указанную позицию',
        }
    ),
    accessGroup: 'music',
    accessKey: 'seek',
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

        const positionInput = interaction.options.getString('position', true);
        let positionMs: number;

        if (positionInput.includes(':')) {
            const parts = positionInput.split(':');
            const minutes = parseInt(parts[0]) || 0;
            const seconds = parseInt(parts[1]) || 0;
            positionMs = (minutes * 60 + seconds) * 1000;
        } else if (positionInput.includes('m') || positionInput.includes('s')) {
            const minMatch = positionInput.match(/(\d+)m/);
            const secMatch = positionInput.match(/(\d+)s/);
            const minutes = minMatch ? parseInt(minMatch[1]) : 0;
            const seconds = secMatch ? parseInt(secMatch[1]) : 0;
            positionMs = (minutes * 60 + seconds) * 1000;
        } else {
            positionMs = parseInt(positionInput) * 1000;
        }

        if (isNaN(positionMs) || positionMs < 0) {
            await interaction.reply({ content: t(locale, 'music.seek.invalid'), ephemeral: true });
            return;
        }

        const track = player.queue.current;
        const duration = track.info.duration || 0;

        if (positionMs > duration) {
            await interaction.reply({ content: t(locale, 'music.seek.tooFar'), ephemeral: true });
            return;
        }

        await player.seek(positionMs);

        const minutes = Math.floor(positionMs / 60000);
        const seconds = Math.floor((positionMs % 60000) / 1000);
        const formattedPosition = `${minutes}:${seconds.toString().padStart(2, '0')}`;

        await interaction.reply({ content: t(locale, 'music.seek.done', { position: formattedPosition }), ephemeral: true });
    },
};

export default command;
