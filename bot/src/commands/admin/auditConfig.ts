import { ApplicationCommandType, ContextMenuCommandBuilder, ContextMenuCommandInteraction, PermissionFlagsBits } from 'discord.js';
import { buildAuditConfigUi } from '../../utils/auditConfigUi';
import { Command } from '../../utils/types';

const command: Command<ContextMenuCommandInteraction> = {
    data: new ContextMenuCommandBuilder()
        .setName('Audit Config')
        .setType(ApplicationCommandType.Message)
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    async execute(interaction: ContextMenuCommandInteraction) {
        if (!interaction.guildId) {
            await interaction.reply({ content: 'Guild only.', ephemeral: true });
            return;
        }

        if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
            await interaction.reply({ content: 'Missing Manage Server permission.', ephemeral: true });
            return;
        }

        const ui = await buildAuditConfigUi(interaction.guildId, interaction.user.id, 'moderation');
        await interaction.reply({ ...ui, ephemeral: true });
    },
};

export default command;
