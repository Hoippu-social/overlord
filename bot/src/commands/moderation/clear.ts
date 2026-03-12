import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { clearMessageRange, clearRecentMessages, createModerationCase } from '../../services/ModerationService';
import { logAuditEvent } from '../../utils/auditLog';
import { Command } from '../../utils/types';

const command: Command = {
    data: new SlashCommandBuilder()
        .setName('clear')
        .setDescription('Delete messages in the current channel')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .setDMPermission(false)
        .addSubcommand((sub) =>
            sub
                .setName('count')
                .setDescription('Delete the most recent messages')
                .addIntegerOption((option) => option.setName('amount').setDescription('How many messages to delete').setRequired(true).setMinValue(1).setMaxValue(500))
                .addUserOption((option) => option.setName('user').setDescription('Optional user filter').setRequired(false))
                .addStringOption((option) => option.setName('query').setDescription('Optional text filter').setRequired(false).setMaxLength(100))
        )
        .addSubcommand((sub) =>
            sub
                .setName('range')
                .setDescription('Delete a message range by ids')
                .addStringOption((option) => option.setName('from_message_id').setDescription('First message id').setRequired(true))
                .addStringOption((option) => option.setName('to_message_id').setDescription('Last message id').setRequired(true))
        ),
    accessGroup: 'moderation',
    accessKey: 'clear',
    requiredAccessLevel: 60,
    async execute(interaction) {
        if (!interaction.channel || !interaction.guildId || !interaction.channel.isTextBased()) {
            await interaction.reply({ content: 'This command requires a text channel inside a guild.', ephemeral: true });
            return;
        }

        await interaction.deferReply({ ephemeral: true });

        const subcommand = interaction.options.getSubcommand();
        const result = subcommand === 'count'
            ? await clearRecentMessages({
                channel: interaction.channel,
                amount: interaction.options.getInteger('amount', true),
                userId: interaction.options.getUser('user')?.id ?? null,
                query: interaction.options.getString('query'),
            })
            : await clearMessageRange({
                channel: interaction.channel,
                fromMessageId: interaction.options.getString('from_message_id', true),
                toMessageId: interaction.options.getString('to_message_id', true),
            });

        const moderationCase = await createModerationCase({
            guildId: interaction.guildId,
            actionType: 'CLEAR',
            source: 'manual',
            actorUserId: interaction.user.id,
            targetUserId: interaction.user.id,
            reason: `Deleted ${result.totalDeleted} messages`,
            status: 'CLEARED',
            metadata: {
                mode: subcommand,
                bulkDeleted: result.bulkDeleted,
                individuallyDeleted: result.individuallyDeleted,
            },
        });

        await logAuditEvent(interaction.client, {
            guildId: interaction.guildId,
            tag: 'moderation',
            actorId: interaction.user.id,
            channelId: interaction.channel.id,
            payload: {
                event: 'clear',
                caseNumber: moderationCase.caseNumber,
                mode: subcommand,
                ...result,
            },
            severity: 'WARN',
        });

        await interaction.editReply(`Deleted ${result.totalDeleted} messages (${result.bulkDeleted} bulk, ${result.individuallyDeleted} individual). Case #${moderationCase.caseNumber}.`);
    },
};

export default command;
