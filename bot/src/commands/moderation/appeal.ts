import { SlashCommandBuilder } from 'discord.js';
import { createAppealTicket, listAppealTickets, safeEnsureAppealConfig } from '../../services/AppealService';
import { Command } from '../../utils/types';

const command: Command = {
    data: new SlashCommandBuilder()
        .setName('appeal')
        .setDescription('Submit or view your moderation appeals')
        .setDMPermission(false)
        .addSubcommand((sub) =>
            sub
                .setName('submit')
                .setDescription('Submit an appeal for one of your moderation cases')
                .addIntegerOption((option) => option.setName('case_id').setDescription('Moderation case number').setRequired(true).setMinValue(1))
                .addStringOption((option) => option.setName('message').setDescription('Why this case should be reviewed').setRequired(true).setMaxLength(1000))
        )
        .addSubcommand((sub) =>
            sub
                .setName('mine')
                .setDescription('Show your recent appeal tickets')
        ),
    async execute(interaction) {
        if (!interaction.guild) {
            await interaction.reply({ content: 'Guild only.', ephemeral: true });
            return;
        }

        const config = await safeEnsureAppealConfig(interaction.guild.id);
        if (!config?.enabled) {
            await interaction.reply({ content: 'Appeals are not enabled for this server.', ephemeral: true });
            return;
        }

        const subcommand = interaction.options.getSubcommand();
        if (subcommand === 'mine') {
            const tickets = await listAppealTickets(interaction.guild.id, {
                userId: interaction.user.id,
                limit: 10,
            });

            if (!tickets.length) {
                await interaction.reply({ content: 'You do not have any recent appeal tickets.', ephemeral: true });
                return;
            }

            await interaction.reply({
                content: tickets
                    .map((ticket) => `#${ticket.id} - ${ticket.appealType} - case #${ticket.caseNumber} - ${ticket.status}`)
                    .join('\n')
                    .slice(0, 1900),
                ephemeral: true,
            });
            return;
        }

        try {
            const ticket = await createAppealTicket({
                guild: interaction.guild,
                userId: interaction.user.id,
                caseNumber: interaction.options.getInteger('case_id', true),
                message: interaction.options.getString('message', true),
                client: interaction.client,
            });

            await interaction.reply({
                content: `Appeal ticket #${ticket.id} created for case #${ticket.caseNumber}.`,
                ephemeral: true,
            });
        } catch (error) {
            await interaction.reply({
                content: error instanceof Error ? error.message : 'Failed to create appeal ticket.',
                ephemeral: true,
            });
        }
    },
};

export default command;
