import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { getCaseByNumber } from '../../services/ModerationService';
import { Command } from '../../utils/types';

const command: Command = {
    data: new SlashCommandBuilder()
        .setName('case')
        .setDescription('Show a moderation case by case number')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .setDMPermission(false)
        .addIntegerOption((option) =>
            option.setName('id').setDescription('Moderation case number').setRequired(true).setMinValue(1)
        ),
    accessGroup: 'moderation',
    accessKey: 'case',
    requiredAccessLevel: 40,
    async execute(interaction) {
        if (!interaction.guildId) {
            await interaction.reply({ content: 'Guild only.', ephemeral: true });
            return;
        }

        const caseNumber = interaction.options.getInteger('id', true);
        const moderationCase = await getCaseByNumber(interaction.guildId, caseNumber);

        if (!moderationCase) {
            await interaction.reply({ content: `Case #${caseNumber} was not found.`, ephemeral: true });
            return;
        }

        const lines = [
            `Case #${moderationCase.caseNumber}`,
            `Action: ${moderationCase.actionType}`,
            `Status: ${moderationCase.status}`,
            `Source: ${moderationCase.source}`,
            `Target: ${moderationCase.targetUserId}`,
            `Actor: ${moderationCase.actorUserId ?? 'system'}`,
            moderationCase.relatedCaseId ? `Related case id: ${moderationCase.relatedCaseId}` : null,
            moderationCase.expiresAt ? `Expires: ${new Date(moderationCase.expiresAt).toLocaleString()}` : null,
            moderationCase.reason ? `Reason: ${moderationCase.reason}` : null,
        ].filter(Boolean);

        if (moderationCase.notes.length) {
            lines.push('', 'Notes:');
            lines.push(...moderationCase.notes.map((note) => `- ${note.actorUserId}: ${note.note}`));
        }

        await interaction.reply({
            content: lines.join('\n').slice(0, 1900),
            ephemeral: true,
        });
    },
};

export default command;
