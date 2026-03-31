import { SlashCommandBuilder } from 'discord.js';
import { localizeDescription } from '../../utils/commandLocalizations';
import { getInteractionLocale, t } from '../../utils/i18n';
import { Command } from '../../utils/types';

const command: Command = {
    data: localizeDescription(new SlashCommandBuilder().setName('stop'), {
        en: 'Stop the music and clear the queue',
        ru: 'Остановить музыку и очистить очередь',
    }),
    accessGroup: 'music',
    accessKey: 'stop',
    execute: async (interaction) => {
        const locale = await getInteractionLocale(interaction);
        const player = interaction.client.lavalink.getPlayer(interaction.guildId!);

        if (!player) {
            await interaction.reply({ content: t(locale, 'music.stop.noPlayer'), ephemeral: true });
            return;
        }

        await player.destroy();
        await interaction.reply({ content: t(locale, 'music.stop.done'), ephemeral: true });
    },
};

export default command;
