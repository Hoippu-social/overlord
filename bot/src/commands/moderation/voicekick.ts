import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { logAuditEvent } from '../../utils/auditLog';
import { voiceKickMember } from '../../services/ModerationService';
import { localizeDescription } from '../../utils/commandLocalizations';
import { getInteractionLocale, t } from '../../utils/i18n';
import { buildStaffEmbed } from '../../utils/staffEmbeds';
import { Command } from '../../utils/types';

const command: Command = {
    data: localizeDescription(
        new SlashCommandBuilder()
            .setName('voicekick')
            .setDefaultMemberPermissions(PermissionFlagsBits.MoveMembers)
            .setDMPermission(false)
            .addUserOption((option) =>
                localizeDescription(option.setName('user').setRequired(true), {
                    en: 'Member to disconnect',
                    ru: 'Участник для отключения',
                })
            )
            .addStringOption((option) =>
                localizeDescription(option.setName('reason').setRequired(false).setMaxLength(500), {
                    en: 'Reason',
                    ru: 'Причина',
                })
            ),
        {
            en: 'Disconnect a member from voice',
            ru: 'Отключить участника от голосового канала',
        }
    ),
    accessGroup: 'moderation',
    accessKey: 'voicekick',
    requiredAccessLevel: 50,
    async execute(interaction) {
        const locale = await getInteractionLocale(interaction);
        if (!interaction.guild) {
            await interaction.reply({
                embeds: [
                    buildStaffEmbed({
                        actor: interaction.user,
                        title: t(locale, 'staff.error.title'),
                        color: 0xef4444,
                        description: ['', t(locale, 'general.guildOnly')],
                    }),
                ],
                ephemeral: true,
            });
            return;
        }

        const target = interaction.options.getUser('user', true);
        const reason = interaction.options.getString('reason');
        const member = await interaction.guild.members.fetch(target.id).catch(() => null);

        if (!member) {
            await interaction.reply({
                embeds: [
                    buildStaffEmbed({
                        actor: interaction.user,
                        title: t(locale, 'staff.error.title'),
                        color: 0xef4444,
                        description: ['', t(locale, 'general.memberNotFound')],
                    }),
                ],
                ephemeral: true,
            });
            return;
        }

        if (!member.voice.channelId) {
            await interaction.reply({
                embeds: [
                    buildStaffEmbed({
                        actor: interaction.user,
                        title: t(locale, 'staff.error.title'),
                        color: 0xef4444,
                        description: ['', t(locale, 'general.voiceTargetMissing')],
                    }),
                ],
                ephemeral: true,
            });
            return;
        }

        const fromChannelId = member.voice.channelId;
        const moderationCase = await voiceKickMember({
            member,
            actorUserId: interaction.user.id,
            reason,
        });

        await logAuditEvent(interaction.client, {
            guildId: interaction.guild.id,
            tag: 'moderation',
            actorId: interaction.user.id,
            targetId: target.id,
            channelId: fromChannelId,
            payload: {
                event: 'voicekick',
                caseNumber: moderationCase.caseNumber,
                reason,
            },
            severity: 'WARN',
        });

        await interaction.reply({
            embeds: [
                buildStaffEmbed({
                    actor: interaction.user,
                    title: t(locale, 'moderation.voicekick.title'),
                    color: 0xf59e0b,
                    thumbnailUrl: target.displayAvatarURL({ size: 256 }),
                    description: [''],
                    fields: [
                        { label: t(locale, 'moderation.action.member'), value: `<@${target.id}>` },
                        { label: t(locale, 'moderation.action.fromChannel'), value: `<#${fromChannelId}>` },
                        { label: t(locale, 'moderation.action.reason'), value: reason ?? t(locale, 'audit.moderation.notSpecified') },
                        { label: t(locale, 'moderation.action.case'), value: `#${moderationCase.caseNumber}` },
                    ],
                }),
            ],
            ephemeral: true,
        });
    },
};

export default command;
