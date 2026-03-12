import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { createAppealTicket, listAppealTickets, reviewAppealTicket } from '../../services/AppealService';
import { Command } from '../../utils/types';

const REVIEW_ACTIONS = ['IN_REVIEW', 'ACCEPTED', 'REJECTED'] as const;

const command: Command = {
    data: new SlashCommandBuilder()
        .setName('appeals')
        .setDescription('Review appeals and issue pardons')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .setDMPermission(false)
        .addSubcommand((sub) =>
            sub
                .setName('list')
                .setDescription('List appeal tickets')
                .addStringOption((option) => option.setName('status').setDescription('Filter by status').setRequired(false))
                .addStringOption((option) => option.setName('user_id').setDescription('Filter by user id').setRequired(false))
        )
        .addSubcommand((sub) =>
            sub
                .setName('review')
                .setDescription('Review an appeal ticket')
                .addIntegerOption((option) => option.setName('ticket_id').setDescription('Appeal ticket id').setRequired(true).setMinValue(1))
                .addStringOption((option) =>
                    option
                        .setName('decision')
                        .setDescription('Review decision')
                        .setRequired(true)
                        .addChoices(...REVIEW_ACTIONS.map((value) => ({ name: value, value })))
                )
                .addStringOption((option) => option.setName('note').setDescription('Optional staff note').setRequired(false).setMaxLength(1000))
        )
        .addSubcommand((sub) =>
            sub
                .setName('pardon')
                .setDescription('Create and immediately resolve a pardon for a moderation case')
                .addIntegerOption((option) => option.setName('case_id').setDescription('Moderation case number').setRequired(true).setMinValue(1))
                .addStringOption((option) => option.setName('note').setDescription('Pardon reason').setRequired(true).setMaxLength(1000))
        ),
    accessGroup: 'moderation',
    accessKey: 'appeals',
    requiredAccessLevel: 60,
    async execute(interaction) {
        if (!interaction.guild) {
            await interaction.reply({ content: 'Guild only.', ephemeral: true });
            return;
        }

        const subcommand = interaction.options.getSubcommand();
        if (subcommand === 'list') {
            const tickets = await listAppealTickets(interaction.guild.id, {
                status: interaction.options.getString('status'),
                userId: interaction.options.getString('user_id'),
                limit: 20,
            });

            if (!tickets.length) {
                await interaction.reply({ content: 'No appeal tickets match this filter.', ephemeral: true });
                return;
            }

            await interaction.reply({
                content: tickets
                    .map((ticket) => `#${ticket.id} - ${ticket.appealType} - case #${ticket.caseNumber} - ${ticket.status} - user ${ticket.userId}`)
                    .join('\n')
                    .slice(0, 1900),
                ephemeral: true,
            });
            return;
        }

        if (subcommand === 'review') {
            try {
                const ticket = await reviewAppealTicket({
                    guild: interaction.guild,
                    ticketId: interaction.options.getInteger('ticket_id', true),
                    reviewerId: interaction.user.id,
                    decision: interaction.options.getString('decision', true) as 'IN_REVIEW' | 'ACCEPTED' | 'REJECTED',
                    note: interaction.options.getString('note'),
                    client: interaction.client,
                });

                await interaction.reply({
                    content: `Appeal ticket #${ticket.id} updated to ${ticket.status}.`,
                    ephemeral: true,
                });
            } catch (error) {
                await interaction.reply({
                    content: error instanceof Error ? error.message : 'Failed to review appeal ticket.',
                    ephemeral: true,
                });
            }
            return;
        }

        try {
            const ticket = await createAppealTicket({
                guild: interaction.guild,
                userId: interaction.user.id,
                caseNumber: interaction.options.getInteger('case_id', true),
                message: interaction.options.getString('note', true),
                client: interaction.client,
                appealType: 'PARDON',
            });

            const updated = await reviewAppealTicket({
                guild: interaction.guild,
                ticketId: ticket.id,
                reviewerId: interaction.user.id,
                decision: 'PARDONED',
                note: interaction.options.getString('note', true),
                client: interaction.client,
            });

            await interaction.reply({
                content: `Pardon ticket #${updated.id} completed with status ${updated.status}.`,
                ephemeral: true,
            });
        } catch (error) {
            await interaction.reply({
                content: error instanceof Error ? error.message : 'Failed to issue pardon.',
                ephemeral: true,
            });
        }
    },
};

export default command;
