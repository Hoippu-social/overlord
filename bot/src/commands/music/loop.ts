import { SlashCommandBuilder, GuildMember } from 'discord.js';
import { getGuildLocale, t } from '../../utils/i18n';
import { Command } from '../../utils/types';

const command: Command = {
    data: new SlashCommandBuilder()
        .setName('loop')
        .setDescription('Sets the loop mode')
        .addStringOption(option =>
            option.setName('mode')
                .setDescription('Loop mode')
                .setRequired(false)
                .addChoices(
                    { name: 'Off', name_localizations: { ru: 'Выключено' }, value: 'off' },
                    { name: 'Track loop', name_localizations: { ru: 'Повтор трека' }, value: 'track' },
                    { name: 'Queue loop', name_localizations: { ru: 'Повтор очереди' }, value: 'queue' }
                )
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

        const mode = interaction.options.getString('mode');

        let newMode: 'off' | 'track' | 'queue';
        if (!mode) {
            if (player.repeatMode === 'off') newMode = 'track';
            else if (player.repeatMode === 'track') newMode = 'queue';
            else newMode = 'off';
        } else {
            newMode = mode as 'off' | 'track' | 'queue';
        }

        await player.setRepeatMode(newMode);

        const modeMessages: Record<string, string> = {
            off: t(locale, 'music.loop.set.off'),
            track: t(locale, 'music.loop.set.track'),
            queue: t(locale, 'music.loop.set.queue'),
        };

        await interaction.reply(modeMessages[newMode]);
    },
};

export default command;
