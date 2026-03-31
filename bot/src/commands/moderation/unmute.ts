import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { unmuteMember } from '../../services/ModerationService';
import { buildAuditPreview, logAuditEvent } from '../../utils/auditLog';
import { localizeDescription } from '../../utils/commandLocalizations';
import { getInteractionLocale, t } from '../../utils/i18n';
import { Command } from '../../utils/types';

const command: Command = {
    data: localizeDescription(
        new SlashCommandBuilder()
            .setName('unmute')
            .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
            .setDMPermission(false)
            .addUserOption((option) => localizeDescription(option.setName('user').setRequired(true), { en: 'Member to unmute', ru: 'Участник для снятия мута' }))
            .addStringOption((option) => localizeDescription(option.setName('reason').setRequired(false).setMaxLength(500), { en: 'Reason', ru: 'Причина' })),
        { en: 'Remove the configured mute role from a member', ru: 'Снять мут с участника' }
    ),
    accessGroup: 'moderation',
    accessKey: 'unmute',
    requiredAccessLevel: 50,
    async execute(interaction) {
        const locale = await getInteractionLocale(interaction);
        if (!interaction.guild) {
            await interaction.reply({ content: t(locale, 'general.guildOnly'), ephemeral: true });
            return;
        }

        const target = interaction.options.getUser('user', true);
        const reason = interaction.options.getString('reason');
        const member = await interaction.guild.members.fetch(target.id).catch(() => null);
        if (!member) {
            await interaction.reply({ content: t(locale, 'general.memberNotFound'), ephemeral: true });
            return;
        }

        try {
            const moderationCase = await unmuteMember({ member, actorUserId: interaction.user.id, reason });
            const auditInput = {
                guildId: interaction.guild.id,
                tag: 'moderation',
                actorId: interaction.user.id,
                targetId: target.id,
                payload: { event: 'unmute', caseNumber: moderationCase.caseNumber, reason },
                severity: 'INFO',
            } as const;
            await logAuditEvent(interaction.client, auditInput);
            const preview = await buildAuditPreview(interaction.client, auditInput);
            await interaction.reply({ embeds: preview?.embeds, ephemeral: true });
        } catch {
            await interaction.reply({ content: t(locale, 'general.error'), ephemeral: true });
        }
    },
};

export default command;
