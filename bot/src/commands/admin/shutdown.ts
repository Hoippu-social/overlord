import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { getGuildLocale, t } from '../../utils/i18n';
import { Command } from '../../utils/types';

const command: Command = {
    data: new SlashCommandBuilder()
        .setName('shutdown')
        .setDescription('Shuts down the bot (Admin only)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .setDMPermission(false),
    hidden: true,
    execute: async (interaction) => {
        const locale = await getGuildLocale(interaction.guildId);

        if (!interaction.memberPermissions?.has('Administrator')) {
            await interaction.reply({ content: t(locale, 'general.notAdmin'), ephemeral: true });
            return;
        }

        await interaction.reply({ content: t(locale, 'admin.shutdown.confirm'), ephemeral: true });

        setTimeout(async () => {
            await interaction.client.destroy();
            process.exit(0);
        }, 1000);
    },
};

export default command;
