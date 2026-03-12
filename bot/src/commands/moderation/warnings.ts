import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { getActiveWarnings } from '../../services/ModerationService';
import { Command } from '../../utils/types';

const command: Command = {
    data: new SlashCommandBuilder()
        .setName('warnings')
        .setDescription('List active warnings for a member')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .setDMPermission(false)
        .addUserOption((option) =>
            option.setName('user').setDescription('Member to inspect').setRequired(true)
        ),
    accessGroup: 'moderation',
    accessKey: 'warnings',
    requiredAccessLevel: 40,
    async execute(interaction) {
        if (!interaction.guildId) {
            await interaction.reply({ content: 'Guild only.', ephemeral: true });
            return;
        }

        const target = interaction.options.getUser('user', true);
        const warnings = await getActiveWarnings(interaction.guildId, target.id);

        if (!warnings.length) {
            await interaction.reply({ content: `No active warnings for <@${target.id}>.`, ephemeral: true });
            return;
        }

        const lines = warnings.map((warning) => `#${warning.caseNumber} - ${warning.reason || 'No reason'}`);
        await interaction.reply({
            content: lines.join('\n').slice(0, 1900),
            ephemeral: true,
        });
    },
};

export default command;
