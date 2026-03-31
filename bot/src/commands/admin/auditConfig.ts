import { ApplicationCommandType, ContextMenuCommandBuilder, ContextMenuCommandInteraction, GuildMember, PermissionFlagsBits } from 'discord.js';
import { hasGuildPermissionAccess } from '../../services/ModerationService';
import { buildAuditConfigUi } from '../../utils/auditConfigUi';
import { getGuildLocale, t } from '../../utils/i18n';
import { Command } from '../../utils/types';

const command: Command<ContextMenuCommandInteraction> = {
    data: new ContextMenuCommandBuilder()
        .setName('Audit Config')
        .setType(ApplicationCommandType.Message)
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    accessGroup: 'admin',
    accessKey: 'audit_config',
    async execute(interaction: ContextMenuCommandInteraction) {
        const locale = await getGuildLocale(interaction.guildId);
        if (!interaction.guildId) {
            await interaction.reply({ content: t(locale, 'general.guildOnly'), ephemeral: true });
            return;
        }

        const member = interaction.member instanceof GuildMember
            ? interaction.member
            : await interaction.guild?.members.fetch(interaction.user.id).catch(() => null);

        if (!member) {
            await interaction.reply({ content: t(locale, 'general.memberResolveFailed'), ephemeral: true });
            return;
        }

        if (!hasGuildPermissionAccess(member, PermissionFlagsBits.ManageGuild)) {
            await interaction.reply({ content: t(locale, 'general.manageServerRequired'), ephemeral: true });
            return;
        }

        const ui = await buildAuditConfigUi(interaction.guildId, interaction.user.id, 'moderation');
        await interaction.reply({ ...ui, ephemeral: true });
    },
};

export default command;
