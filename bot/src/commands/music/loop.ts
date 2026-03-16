import { SlashCommandBuilder, GuildMember } from 'discord.js';
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
                    { name: '❌ Выключить', value: 'off' },
                    { name: '🔂 Повтор трека', value: 'track' },
                    { name: '🔁 Повтор очереди', value: 'queue' }
                )
        ) as any,
    accessGroup: 'music',
    accessKey: 'loop',
    execute: async (interaction) => {
        const member = interaction.member as GuildMember;
        const voiceChannel = member.voice.channel;

        if (!voiceChannel) {
            await interaction.reply({ content: '❌ Вы должны быть в голосовом канале!', ephemeral: true });
            return;
        }

        const player = interaction.client.lavalink.getPlayer(interaction.guildId!);

        if (!player) {
            await interaction.reply({ content: '❌ Плеер не активен!', ephemeral: true });
            return;
        }

        if (player.voiceChannelId !== voiceChannel.id) {
            await interaction.reply({ content: '❌ Вы должны быть в том же канале, что и бот!', ephemeral: true });
            return;
        }

        const mode = interaction.options.getString('mode');

        // If no mode specified, cycle through modes
        let newMode: 'off' | 'track' | 'queue';
        if (!mode) {
            // Cycle: off -> track -> queue -> off
            if (player.repeatMode === 'off') newMode = 'track';
            else if (player.repeatMode === 'track') newMode = 'queue';
            else newMode = 'off';
        } else {
            newMode = mode as 'off' | 'track' | 'queue';
        }

        await player.setRepeatMode(newMode);

        const modeMessages: Record<string, string> = {
            'off': '❌ Повтор выключен',
            'track': '🔂 Повтор текущего трека включен',
            'queue': '🔁 Повтор очереди включен'
        };

        await interaction.reply(modeMessages[newMode]);
    },
};

export default command;
