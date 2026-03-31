import { GuildMember, SlashCommandBuilder } from 'discord.js';
import { localizeDescription } from '../../utils/commandLocalizations';
import { getInteractionLocale, t } from '../../utils/i18n';
import { Command } from '../../utils/types';

const command: Command = {
    data: localizeDescription(
        new SlashCommandBuilder()
            .setName('loop')
            .addStringOption((option) =>
                localizeDescription(
                    option
                        .setName('mode')
                        .setRequired(false)
                        .addChoices(
                            { name: 'Off', value: 'off' },
                            { name: 'Track', value: 'track' },
                            { name: 'Queue', value: 'queue' }
                        ),
                    {
                        en: 'Loop mode',
                        ru: 'Режим повтора',
                    }
                )
            ) as any,
        {
            en: 'Set the loop mode',
            ru: 'Установить режим повтора',
        }
    ),
    accessGroup: 'music',
    accessKey: 'loop',
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
        await interaction.reply({
            content: t(locale, `music.loop.set.${newMode}` as never),
            ephemeral: true,
        });
    },
};

export default command;
