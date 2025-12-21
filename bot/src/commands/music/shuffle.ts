import { SlashCommandBuilder, GuildMember } from 'discord.js';
import { getGuildLocale, t } from '../../utils/i18n';
import { Command } from '../../utils/types';

const command: Command = {
    data: new SlashCommandBuilder()
        .setName('shuffle')
        .setDescription('Shuffles the queue'),
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

        const queue = player.queue;

        if (queue.tracks.length < 2) {
            await interaction.reply({ content: t(locale, 'music.shuffle.tooShort'), ephemeral: true });
            return;
        }

        await queue.shuffle();

        await interaction.reply(t(locale, 'music.shuffle.done', { count: queue.tracks.length }));
    },
};

export default command;
