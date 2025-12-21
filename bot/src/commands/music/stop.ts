import { SlashCommandBuilder } from 'discord.js';
import { getGuildLocale, t } from '../../utils/i18n';
import { Command } from '../../utils/types';

const command: Command = {
    data: new SlashCommandBuilder()
        .setName('stop')
        .setDescription('Stops the music and clears the queue'),
    execute: async (interaction) => {
        const locale = await getGuildLocale(interaction.guildId);
        const player = interaction.client.lavalink.getPlayer(interaction.guildId!);

        if (!player) {
            await interaction.reply({ content: t(locale, 'music.stop.noPlayer'), ephemeral: true });
            return;
        }

        await player.destroy();
        await interaction.reply(t(locale, 'music.stop.done'));
    },
};

export default command;
