import { ApplicationCommandType, ContextMenuCommandBuilder, ContextMenuCommandInteraction, GuildMember, PermissionFlagsBits } from 'discord.js';
import { hasGuildPermissionAccess } from '../../services/ModerationService';
import { buildAuditConfigUi } from '../../utils/auditConfigUi';
import { Command } from '../../utils/types';

const command: Command<ContextMenuCommandInteraction> = {
    data: new ContextMenuCommandBuilder()
        .setName('Audit Config')
        .setType(ApplicationCommandType.Message)
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    accessGroup: 'admin',
    accessKey: 'audit_config',
    async execute(interaction: ContextMenuCommandInteraction) {
        if (!interaction.guildId) {
            await interaction.reply({ content: 'Guild only.', ephemeral: true });
            return;
        }

        const member = interaction.member instanceof GuildMember
            ? interaction.member
            : await interaction.guild?.members.fetch(interaction.user.id).catch(() => null);

        if (!member) {
            await interaction.reply({ content: 'Unable to resolve your guild member state.', ephemeral: true });
            return;
        }

        if (!hasGuildPermissionAccess(member, PermissionFlagsBits.ManageGuild)) {
            await interaction.reply({ content: 'Missing Manage Server permission.', ephemeral: true });
            return;
        }

        const ui = await buildAuditConfigUi(interaction.guildId, interaction.user.id, 'moderation');
        await interaction.reply({ ...ui, ephemeral: true });
    },
};

export default command;
