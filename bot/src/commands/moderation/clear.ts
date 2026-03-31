import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { clearMessageRange, clearRecentMessages, createModerationCase } from '../../services/ModerationService';
import { logAuditEvent } from '../../utils/auditLog';
import { localizeDescription } from '../../utils/commandLocalizations';
import { getInteractionLocale, t } from '../../utils/i18n';
import { buildStaffEmbed } from '../../utils/staffEmbeds';
import { Command } from '../../utils/types';

const command: Command = {
    data: localizeDescription(
        new SlashCommandBuilder()
            .setName('clear')
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
            .setDMPermission(false)
            .addSubcommand((sub) =>
                localizeDescription(sub.setName('count'), {
                    en: 'Delete the most recent messages',
                    ru: 'Удалить последние сообщения',
                })
                    .addIntegerOption((option) =>
                        localizeDescription(option.setName('amount').setRequired(true).setMinValue(1).setMaxValue(500), {
                            en: 'How many messages to delete',
                            ru: 'Сколько сообщений удалить',
                        })
                    )
                    .addUserOption((option) =>
                        localizeDescription(option.setName('user').setRequired(false), {
                            en: 'Optional user filter',
                            ru: 'Необязательный фильтр по пользователю',
                        })
                    )
                    .addStringOption((option) =>
                        localizeDescription(option.setName('query').setRequired(false).setMaxLength(100), {
                            en: 'Optional text filter',
                            ru: 'Необязательный текстовый фильтр',
                        })
                    )
            )
            .addSubcommand((sub) =>
                localizeDescription(sub.setName('range'), {
                    en: 'Delete a message range by ids',
                    ru: 'Удалить диапазон сообщений по ID',
                })
                    .addStringOption((option) =>
                        localizeDescription(option.setName('from_message_id').setRequired(true), {
                            en: 'First message id',
                            ru: 'ID первого сообщения',
                        })
                    )
                    .addStringOption((option) =>
                        localizeDescription(option.setName('to_message_id').setRequired(true), {
                            en: 'Last message id',
                            ru: 'ID последнего сообщения',
                        })
                    )
            ),
        {
            en: 'Delete messages in the current channel',
            ru: 'Удалить сообщения в текущем канале',
        }
    ),
    accessGroup: 'moderation',
    accessKey: 'clear',
    requiredAccessLevel: 50,
    async execute(interaction) {
        const locale = await getInteractionLocale(interaction);
        if (!interaction.channel || !interaction.guildId || !interaction.channel.isTextBased()) {
            await interaction.reply({
                embeds: [
                    buildStaffEmbed({
                        actor: interaction.user,
                        title: t(locale, 'staff.error.title'),
                        color: 0xef4444,
                        description: ['', t(locale, 'general.textChannelOnly')],
                    }),
                ],
                ephemeral: true,
            });
            return;
        }

        await interaction.deferReply({ ephemeral: true });

        try {
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

            const rangeValue = subcommand === 'range'
                ? `${interaction.options.getString('from_message_id', true)} -> ${interaction.options.getString('to_message_id', true)}`
                : `${result.bulkDeleted} / ${result.individuallyDeleted}`;

            await interaction.editReply({
                embeds: [
                    buildStaffEmbed({
                        actor: interaction.user,
                        title: t(locale, 'moderation.clear.title'),
                        color: 0xf97316,
                        description: [''],
                        fields: [
                            { label: t(locale, 'moderation.action.channel'), value: `<#${interaction.channelId}>` },
                            { label: t(locale, 'moderation.clear.amount'), value: String(result.totalDeleted) },
                            { label: t(locale, 'moderation.clear.range'), value: rangeValue },
                            { label: t(locale, 'moderation.action.case'), value: `#${moderationCase.caseNumber}` },
                        ],
                    }),
                ],
            });
        } catch (error) {
            const message = error instanceof Error && error.message === 'One or both messages were not found in this channel.'
                ? t(locale, 'moderation.clear.invalidRange')
                : t(locale, 'general.error');

            await interaction.editReply({
                embeds: [
                    buildStaffEmbed({
                        actor: interaction.user,
                        title: t(locale, 'staff.error.title'),
                        color: 0xef4444,
                        description: ['', message],
                    }),
                ],
            });
        }
    },
};

export default command;
