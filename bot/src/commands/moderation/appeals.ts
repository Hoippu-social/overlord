import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { createAppealTicket, listAppealTickets, reviewAppealTicket } from '../../services/AppealService';
import { localizeDescription } from '../../utils/commandLocalizations';
import { getInteractionLocale, t } from '../../utils/i18n';
import { buildStaffEmbed } from '../../utils/staffEmbeds';
import { Command } from '../../utils/types';

const REVIEW_ACTIONS = ['IN_REVIEW', 'ACCEPTED', 'REJECTED'] as const;

const command: Command = {
    data: localizeDescription(
        new SlashCommandBuilder()
            .setName('appeals')
            .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
            .setDMPermission(false)
            .addSubcommand((sub: any) =>
                localizeDescription(sub.setName('list'), {
                    en: 'List appeal tickets',
                    ru: 'Показать тикеты апелляций',
                })
                    .addStringOption((option: any) =>
                        localizeDescription(option.setName('status').setRequired(false), {
                            en: 'Filter by status',
                            ru: 'Фильтр по статусу',
                        })
                    )
                    .addStringOption((option: any) =>
                        localizeDescription(option.setName('user_id').setRequired(false), {
                            en: 'Filter by user id',
                            ru: 'Фильтр по ID пользователя',
                        })
                    )
            )
            .addSubcommand((sub: any) =>
                localizeDescription(sub.setName('review'), {
                    en: 'Review an appeal ticket',
                    ru: 'Рассмотреть тикет апелляции',
                })
                    .addIntegerOption((option: any) =>
                        localizeDescription(option.setName('ticket_id').setRequired(true).setMinValue(1), {
                            en: 'Appeal ticket id',
                            ru: 'ID тикета апелляции',
                        })
                    )
                    .addStringOption((option: any) =>
                        localizeDescription(option.setName('decision').setRequired(true).addChoices(...REVIEW_ACTIONS.map((value) => ({ name: value, value }))), {
                            en: 'Review decision',
                            ru: 'Решение по апелляции',
                        })
                    )
                    .addStringOption((option: any) =>
                        localizeDescription(option.setName('note').setRequired(false).setMaxLength(1000), {
                            en: 'Optional staff note',
                            ru: 'Необязательная заметка стаффа',
                        })
                    )
            )
            .addSubcommand((sub: any) =>
                localizeDescription(sub.setName('pardon'), {
                    en: 'Create and immediately resolve a pardon for a moderation case',
                    ru: 'Создать и сразу закрыть помилование по кейсу',
                })
                    .addIntegerOption((option: any) =>
                        localizeDescription(option.setName('case_id').setRequired(true).setMinValue(1), {
                            en: 'Moderation case number',
                            ru: 'Номер модераторского кейса',
                        })
                    )
                    .addStringOption((option: any) =>
                        localizeDescription(option.setName('note').setRequired(true).setMaxLength(1000), {
                            en: 'Pardon reason',
                            ru: 'Причина помилования',
                        })
                    )
            ),
        {
            en: 'Review appeals and issue pardons',
            ru: 'Рассматривать апелляции и выдавать помилования',
        }
    ),
    accessGroup: 'moderation',
    accessKey: 'appeals',
    requiredAccessLevel: 70,
    async execute(interaction) {
        const locale = await getInteractionLocale(interaction);
        if (!interaction.guild) {
            await interaction.reply({ content: t(locale, 'general.guildOnly'), ephemeral: true });
            return;
        }

        const subcommand = interaction.options.getSubcommand();
        if (subcommand === 'list') {
            const tickets = await listAppealTickets(interaction.guild.id, {
                status: interaction.options.getString('status'),
                userId: interaction.options.getString('user_id'),
                limit: 20,
            });

            if (!tickets.length) {
                await interaction.reply({ content: t(locale, 'moderation.appeals.empty'), ephemeral: true });
                return;
            }

            await interaction.reply({
                embeds: [
                    buildStaffEmbed({
                        actor: interaction.user,
                        title: t(locale, 'moderation.appeals.list.title'),
                        color: 0x3498db,
                        fields: tickets.map((ticket) => ({
                            label: `#${ticket.id} | ${ticket.status}`,
                            value: [
                                `${t(locale, 'moderation.appeals.caseLabel')}: #${ticket.caseNumber}`,
                                `${t(locale, 'moderation.appeals.typeLabel')}: ${ticket.appealType}`,
                                `${t(locale, 'moderation.appeals.userLabel')}: ${ticket.userId}`,
                            ].join('\n'),
                            inline: false,
                        })),
                    }),
                ],
                ephemeral: true,
            });
            return;
        }

        if (subcommand === 'review') {
            try {
                const ticket = await reviewAppealTicket({
                    guild: interaction.guild,
                    ticketId: interaction.options.getInteger('ticket_id', true),
                    reviewerId: interaction.user.id,
                    decision: interaction.options.getString('decision', true) as 'IN_REVIEW' | 'ACCEPTED' | 'REJECTED',
                    note: interaction.options.getString('note'),
                    client: interaction.client,
                });

                await interaction.reply({
                    embeds: [
                        buildStaffEmbed({
                            actor: interaction.user,
                            title: t(locale, 'moderation.appeals.reviewed.title'),
                            color: 0x3498db,
                            fields: [
                                { label: t(locale, 'moderation.appeals.ticket'), value: `#${ticket.id}` },
                                { label: t(locale, 'moderation.appeals.statusLabel'), value: ticket.status },
                            ],
                        }),
                    ],
                    ephemeral: true,
                });
            } catch {
                await interaction.reply({
                    content: t(locale, 'moderation.appeals.failedReview'),
                    ephemeral: true,
                });
            }
            return;
        }

        try {
            const ticket = await createAppealTicket({
                guild: interaction.guild,
                userId: interaction.user.id,
                caseNumber: interaction.options.getInteger('case_id', true),
                message: interaction.options.getString('note', true),
                client: interaction.client,
                appealType: 'PARDON',
            });

            const updated = await reviewAppealTicket({
                guild: interaction.guild,
                ticketId: ticket.id,
                reviewerId: interaction.user.id,
                decision: 'PARDONED',
                note: interaction.options.getString('note', true),
                client: interaction.client,
            });

            await interaction.reply({
                embeds: [
                    buildStaffEmbed({
                        actor: interaction.user,
                        title: t(locale, 'moderation.appeals.pardon.title'),
                        color: 0x3498db,
                        fields: [
                            { label: t(locale, 'moderation.appeals.ticket'), value: `#${updated.id}` },
                            { label: t(locale, 'moderation.appeals.statusLabel'), value: updated.status },
                        ],
                    }),
                ],
                ephemeral: true,
            });
        } catch {
            await interaction.reply({
                content: t(locale, 'moderation.appeals.failedPardon'),
                ephemeral: true,
            });
        }
    },
};

export default command;
