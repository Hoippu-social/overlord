import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { clearWarningCase } from '../../services/ModerationService';
import { buildAuditPreview, logAuditEvent } from '../../utils/auditLog';
import { localizeDescription } from '../../utils/commandLocalizations';
import { getInteractionLocale, t } from '../../utils/i18n';
import { Command } from '../../utils/types';

const command: Command = {
    data: localizeDescription(
        new SlashCommandBuilder()
            .setName('unwarn')
            .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
            .setDMPermission(false)
            .addIntegerOption((option) => localizeDescription(option.setName('warn_id').setRequired(true).setMinValue(1), { en: 'Warning case number', ru: 'Номер кейса варна' }))
            .addStringOption((option) => localizeDescription(option.setName('reason').setRequired(false).setMaxLength(500), { en: 'Reason for clearing the warning', ru: 'Причина снятия варна' })),
        { en: 'Clear a warning case by its id', ru: 'Снять варн по номеру кейса' }
    ),
    accessGroup: 'moderation',
    accessKey: 'unwarn',
    requiredAccessLevel: 70,
    async execute(interaction) {
        const locale = await getInteractionLocale(interaction);
        if (!interaction.guildId) {
            await interaction.reply({ content: t(locale, 'general.guildOnly'), ephemeral: true });
            return;
        }

        const warnId = interaction.options.getInteger('warn_id', true);
        const reason = interaction.options.getString('reason');

        const cleared = await clearWarningCase(interaction.guildId, interaction.user.id, warnId, reason);
        const auditInput = {
            guildId: interaction.guildId,
            tag: 'moderation',
            actorId: interaction.user.id,
            targetId: cleared.targetUserId,
            payload: {
                event: 'unwarn',
                caseNumber: cleared.caseNumber,
                reason: cleared.reason,
            },
            severity: 'INFO',
        } as const;

        await logAuditEvent(interaction.client, auditInput);
        const preview = await buildAuditPreview(interaction.client, auditInput);
        await interaction.reply({ embeds: preview?.embeds, ephemeral: true });
    },
};

export default command;
