import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { kickMember } from '../../services/ModerationService';
import { buildAuditPreview, logAuditEvent } from '../../utils/auditLog';
import { localizeDescription } from '../../utils/commandLocalizations';
import { getInteractionLocale, t } from '../../utils/i18n';
import { buildStaffEmbed } from '../../utils/staffEmbeds';
import { Command } from '../../utils/types';

const command: Command = {
    data: localizeDescription(
        new SlashCommandBuilder()
            .setName('kick')
            .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
            .setDMPermission(false)
            .addUserOption((option) =>
                localizeDescription(option.setName('user').setRequired(true), {
                    en: 'Member to kick',
                    ru: 'Участник для кика',
                })
            )
            .addStringOption((option) =>
                localizeDescription(option.setName('reason').setRequired(false).setMaxLength(500), {
                    en: 'Reason',
                    ru: 'Причина',
                })
            ),
        {
            en: 'Kick a member from the guild',
            ru: 'Кикнуть участника с сервера',
        }
    ),
    accessGroup: 'moderation',
    accessKey: 'kick',
    requiredAccessLevel: 70,
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

        const moderationCase = await kickMember({ member, actorUserId: interaction.user.id, reason });
        const auditInput = {
            guildId: interaction.guild.id,
            tag: 'moderation',
            actorId: interaction.user.id,
            targetId: target.id,
            payload: { event: 'kick', caseNumber: moderationCase.caseNumber, reason },
            severity: 'WARN',
        } as const;
        await logAuditEvent(interaction.client, auditInput);
        const preview = await buildAuditPreview(interaction.client, auditInput);

        if (preview?.embeds?.length) {
            await interaction.reply({ embeds: preview.embeds, ephemeral: true });
            return;
        }

        await interaction.reply({
            embeds: [
                buildStaffEmbed({
                    actor: interaction.user,
                    title: t(locale, 'audit.moderation.kick.title'),
                    color: 0xf59e0b,
                    thumbnailUrl: target.displayAvatarURL({ size: 256 }),
                    description: [
                        '',
                        `**${t(locale, 'audit.moderation.target')}:** <@${target.id}>`,
                        `**${t(locale, 'audit.moderation.actor')}:** <@${interaction.user.id}>`,
                    ],
                    fields: [
                        { label: t(locale, 'audit.moderation.reason'), value: reason ?? t(locale, 'audit.moderation.notSpecified') },
                        { label: t(locale, 'moderation.action.case'), value: `#${moderationCase.caseNumber}` },
                    ],
                }),
            ],
            ephemeral: true,
        });
    },
};

export default command;
