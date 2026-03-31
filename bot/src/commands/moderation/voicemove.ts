import { ChannelType, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { logAuditEvent } from '../../utils/auditLog';
import { voiceMoveMember } from '../../services/ModerationService';
import { localizeDescription } from '../../utils/commandLocalizations';
import { getInteractionLocale, t } from '../../utils/i18n';
import { buildStaffEmbed } from '../../utils/staffEmbeds';
import { Command } from '../../utils/types';

const command: Command = {
    data: localizeDescription(
        new SlashCommandBuilder()
            .setName('voicemove')
            .setDefaultMemberPermissions(PermissionFlagsBits.MoveMembers)
            .setDMPermission(false)
            .addUserOption((option) =>
                localizeDescription(option.setName('user').setRequired(true), {
                    en: 'Member to move',
                    ru: 'Участник для перемещения',
                })
            )
            .addChannelOption((option) =>
                localizeDescription(option.setName('channel').setRequired(true).addChannelTypes(ChannelType.GuildVoice, ChannelType.GuildStageVoice), {
                    en: 'Target voice channel',
                    ru: 'Целевой голосовой канал',
                })
            )
            .addStringOption((option) =>
                localizeDescription(option.setName('reason').setRequired(false).setMaxLength(500), {
                    en: 'Reason',
                    ru: 'Причина',
                })
            ),
        {
            en: 'Move a member to another voice channel',
            ru: 'Переместить участника в другой голосовой канал',
        }
    ),
    accessGroup: 'moderation',
    accessKey: 'voicemove',
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
        const targetChannel = interaction.options.getChannel('channel', true);
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
        const moderationCase = await voiceMoveMember({
            member,
            targetChannelId: targetChannel.id,
            actorUserId: interaction.user.id,
            reason,
        });

        await logAuditEvent(interaction.client, {
            guildId: interaction.guild.id,
            tag: 'moderation',
            actorId: interaction.user.id,
            targetId: target.id,
            channelId: targetChannel.id,
            payload: {
                event: 'voicemove',
                caseNumber: moderationCase.caseNumber,
                reason,
                fromChannelId,
                toChannelId: targetChannel.id,
            },
            severity: 'INFO',
        });

        await interaction.reply({
            embeds: [
                buildStaffEmbed({
                    actor: interaction.user,
                    title: t(locale, 'moderation.voicemove.title'),
                    color: 0x38bdf8,
                    thumbnailUrl: target.displayAvatarURL({ size: 256 }),
                    description: [''],
                    fields: [
                        { label: t(locale, 'moderation.action.member'), value: `<@${target.id}>` },
                        { label: t(locale, 'moderation.action.fromChannel'), value: `<#${fromChannelId}>` },
                        { label: t(locale, 'moderation.action.toChannel'), value: `<#${targetChannel.id}>` },
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
