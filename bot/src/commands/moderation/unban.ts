import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { unbanUser } from '../../services/ModerationService';
import { buildAuditPreview, logAuditEvent } from '../../utils/auditLog';
import { localizeDescription } from '../../utils/commandLocalizations';
import { getInteractionLocale, t } from '../../utils/i18n';
import { Command } from '../../utils/types';

const command: Command = {
    data: localizeDescription(
        new SlashCommandBuilder()
            .setName('unban')
            .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
            .setDMPermission(false)
            .addStringOption((option) => localizeDescription(option.setName('user_id').setRequired(true), { en: 'User id to unban', ru: 'ID пользователя для разбана' }))
            .addStringOption((option) => localizeDescription(option.setName('reason').setRequired(false).setMaxLength(500), { en: 'Reason', ru: 'Причина' })),
        { en: 'Unban a user by id', ru: 'Разбанить пользователя по ID' }
    ),
    accessGroup: 'moderation',
    accessKey: 'unban',
    requiredAccessLevel: 80,
    async execute(interaction) {
        const locale = await getInteractionLocale(interaction);
        if (!interaction.guild) {
            await interaction.reply({ content: t(locale, 'general.guildOnly'), ephemeral: true });
            return;
        }

        const targetUserId = interaction.options.getString('user_id', true).trim();
        const reason = interaction.options.getString('reason');
        const moderationCase = await unbanUser({
            guild: interaction.guild,
            targetUserId,
            actorUserId: interaction.user.id,
            reason,
        });

        const auditInput = {
            guildId: interaction.guild.id,
            tag: 'moderation',
            actorId: interaction.user.id,
            targetId: targetUserId,
            payload: { event: 'unban', caseNumber: moderationCase.caseNumber, reason },
            severity: 'INFO',
        } as const;
        await logAuditEvent(interaction.client, auditInput);
        const preview = await buildAuditPreview(interaction.client, auditInput);

        await interaction.reply({ embeds: preview?.embeds, ephemeral: true });
    },
};

export default command;
