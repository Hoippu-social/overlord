import { GuildMember, SlashCommandBuilder } from 'discord.js';
import { localizeDescription } from '../../utils/commandLocalizations';
import { getInteractionLocale, t } from '../../utils/i18n';
import { Command } from '../../utils/types';

const command: Command = {
    data: localizeDescription(
        new SlashCommandBuilder()
            .setName('volume')
            .addIntegerOption((option) =>
                localizeDescription(option.setName('level').setMinValue(0).setMaxValue(100).setRequired(false), {
                    en: 'Volume level 0-100',
                    ru: 'Уровень громкости 0-100',
                })
            ) as any,
        {
            en: 'Set the player volume',
            ru: 'Изменить громкость плеера',
        }
    ),
    accessGroup: 'music',
    accessKey: 'volume',
    execute: async (interaction) => {
        const locale = await getInteractionLocale(interaction);
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
        await interaction.reply({ content: t(locale, 'music.volume.set', { value: level }), ephemeral: true });
    },
};

export default command;
