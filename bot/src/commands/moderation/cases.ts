import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { replyWithCases } from '../../services/ModerationService';
import { Command } from '../../utils/types';

const command: Command = {
    data: new SlashCommandBuilder()
        .setName('cases')
        .setDescription('List moderation cases for a member')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .setDMPermission(false)
        .addUserOption((option) =>
            option.setName('user').setDescription('Member to inspect').setRequired(true)
        ),
    accessGroup: 'moderation',
    accessKey: 'cases',
    requiredAccessLevel: 40,
    async execute(interaction) {
        if (!interaction.guildId) {
            await interaction.reply({ content: 'Guild only.', ephemeral: true });
            return;
        }

        const target = interaction.options.getUser('user', true);
        await replyWithCases(interaction, interaction.guildId, target.id, 15);
    },
};

export default command;
