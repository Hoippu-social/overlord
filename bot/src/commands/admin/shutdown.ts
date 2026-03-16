import { GuildMember, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { hasGuildPermissionAccess } from '../../services/ModerationService';
import { getGuildLocale, t } from '../../utils/i18n';
import { Command } from '../../utils/types';

const command: Command = {
    data: new SlashCommandBuilder()
        .setName('shutdown')
        .setDescription('Shuts down the bot (Admin only)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .setDMPermission(false),
    hidden: true,
    accessGroup: 'admin',
    accessKey: 'shutdown',
    execute: async (interaction) => {
        const locale = await getGuildLocale(interaction.guildId);
        const member = interaction.guild
            ? (
                interaction.member instanceof GuildMember
                    ? interaction.member
                    : await interaction.guild.members.fetch(interaction.user.id).catch(() => null)
            )
            : null;

        if (!member) {
            await interaction.reply({ content: 'Unable to resolve your guild member state.', ephemeral: true });
            return;
        }

        if (!hasGuildPermissionAccess(member, PermissionFlagsBits.Administrator)) {
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
