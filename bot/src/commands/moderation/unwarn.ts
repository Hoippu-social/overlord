import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { clearWarningCase } from '../../services/ModerationService';
import { logAuditEvent } from '../../utils/auditLog';
import { Command } from '../../utils/types';

const command: Command = {
    data: new SlashCommandBuilder()
        .setName('unwarn')
        .setDescription('Clear a warning case by its id')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .setDMPermission(false)
        .addIntegerOption((option) =>
            option.setName('warn_id').setDescription('Warning case number').setRequired(true).setMinValue(1)
        )
        .addStringOption((option) =>
            option.setName('reason').setDescription('Reason for clearing the warning').setRequired(false).setMaxLength(500)
        ),
    accessGroup: 'moderation',
    accessKey: 'unwarn',
    requiredAccessLevel: 50,
    async execute(interaction) {
        if (!interaction.guildId) {
            await interaction.reply({ content: 'Guild only.', ephemeral: true });
            return;
        }

        const warnId = interaction.options.getInteger('warn_id', true);
        const reason = interaction.options.getString('reason');

        const cleared = await clearWarningCase(interaction.guildId, interaction.user.id, warnId, reason);

        await logAuditEvent(interaction.client, {
            guildId: interaction.guildId,
            tag: 'moderation',
            actorId: interaction.user.id,
            targetId: cleared.targetUserId,
            payload: {
                event: 'unwarn',
                caseNumber: cleared.caseNumber,
                relatedCaseId: cleared.relatedCaseId,
                reason: cleared.reason,
            },
            severity: 'INFO',
        });

        await interaction.reply({
            content: `Warning #${warnId} cleared. New case #${cleared.caseNumber}.`,
            ephemeral: true,
        });
    },
};

export default command;
