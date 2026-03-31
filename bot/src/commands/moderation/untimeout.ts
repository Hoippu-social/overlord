import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { untimeoutMember } from '../../services/ModerationService';
import { buildAuditPreview, logAuditEvent } from '../../utils/auditLog';
import { localizeDescription } from '../../utils/commandLocalizations';
import { getInteractionLocale, t } from '../../utils/i18n';
import { Command } from '../../utils/types';

const command: Command = {
    data: localizeDescription(
        new SlashCommandBuilder()
            .setName('untimeout')
            .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
            .setDMPermission(false)
            .addUserOption((option) => localizeDescription(option.setName('user').setRequired(true), { en: 'Member to untimeout', ru: 'Участник для снятия тайм-аута' }))
            .addStringOption((option) => localizeDescription(option.setName('reason').setRequired(false).setMaxLength(500), { en: 'Reason', ru: 'Причина' })),
        { en: 'Remove timeout from a guild member', ru: 'Снять тайм-аут с участника' }
    ),
    accessGroup: 'moderation',
    accessKey: 'untimeout',
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

        const moderationCase = await untimeoutMember({
            member,
            actorUserId: interaction.user.id,
            reason,
        });

        const auditInput = {
            guildId: interaction.guild.id,
            tag: 'moderation',
            actorId: interaction.user.id,
            targetId: target.id,
            payload: {
                event: 'untimeout',
                caseNumber: moderationCase.caseNumber,
                reason,
            },
            severity: 'INFO',
        } as const;

        await logAuditEvent(interaction.client, auditInput);
        const preview = await buildAuditPreview(interaction.client, auditInput);

        await interaction.reply({ embeds: preview?.embeds, ephemeral: true });
    },
};

export default command;
