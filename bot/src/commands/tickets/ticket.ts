import { EmbedBuilder, GuildMember, PermissionFlagsBits, SlashCommandBuilder, ThreadChannel } from 'discord.js';
import { prisma } from '../../utils/database';
import { getInteractionLocale, t } from '../../utils/i18n';
import { localizeDescription } from '../../utils/commandLocalizations';
import { Command } from '../../utils/types';
import {
    addToBlacklist,
    addUserToTicket,
    claimTicket,
    closeTicket,
    findTicketByThread,
    isStaff,
    removeFromBlacklist,
    removeUserFromTicket,
    reopenTicket,
    resumeTicket,
    setTicketOnHold,
    unclaimTicket,
} from '../../services/TicketService';
import { syncTicketPanel } from '../../services/TicketPanelService';

function isThread(channel: unknown): channel is ThreadChannel {
    return Boolean(
        channel &&
        typeof channel === 'object' &&
        'isThread' in channel &&
        typeof (channel as { isThread?: () => boolean }).isThread === 'function' &&
        (channel as { isThread: () => boolean }).isThread()
    );
}

async function resolveTicketInThread(guildId: string, channelId: string) {
    const ticket = await findTicketByThread(channelId);
    if (!ticket || ticket.guildId !== guildId) return null;
    return ticket;
}

async function resolveAgentRoles(categoryId: number): Promise<string[]> {
    const category = await prisma.ticketCategory.findUnique({ where: { id: categoryId } });
    if (!category?.agentRoles) return [];
    try { return JSON.parse(category.agentRoles) as string[]; } catch { return []; }
}

const command: Command = {
    data: localizeDescription(
        new SlashCommandBuilder()
            .setName('ticket')
            .setDefaultMemberPermissions(null)

            // close
            .addSubcommand((sub) =>
                localizeDescription(sub.setName('close'), {
                    en: 'Close this ticket',
                    ru: 'Закрыть этот тикет',
                }).addStringOption((opt) =>
                    localizeDescription(opt.setName('reason').setRequired(false).setMaxLength(512), {
                        en: 'Reason for closing',
                        ru: 'Причина закрытия',
                    })
                )
            )

            // claim
            .addSubcommand((sub) =>
                localizeDescription(sub.setName('claim'), {
                    en: 'Claim this ticket',
                    ru: 'Взять тикет в работу',
                })
            )

            // unclaim
            .addSubcommand((sub) =>
                localizeDescription(sub.setName('unclaim'), {
                    en: 'Unclaim this ticket',
                    ru: 'Освободить тикет',
                })
            )

            // hold
            .addSubcommand((sub) =>
                localizeDescription(sub.setName('hold'), {
                    en: 'Put this ticket on hold',
                    ru: 'Поставить тикет на ожидание',
                })
            )

            // resume
            .addSubcommand((sub) =>
                localizeDescription(sub.setName('resume'), {
                    en: 'Resume a ticket from hold',
                    ru: 'Возобновить тикет',
                })
            )

            // reopen
            .addSubcommand((sub) =>
                localizeDescription(sub.setName('reopen'), {
                    en: 'Reopen a closed ticket',
                    ru: 'Переоткрыть закрытый тикет',
                }).addIntegerOption((opt) =>
                    localizeDescription(opt.setName('number').setRequired(true).setMinValue(1), {
                        en: 'Ticket number',
                        ru: 'Номер тикета',
                    })
                )
            )

            // add-user
            .addSubcommand((sub) =>
                localizeDescription(sub.setName('add-user'), {
                    en: 'Add a user to this ticket',
                    ru: 'Добавить пользователя в тикет',
                }).addUserOption((opt) =>
                    localizeDescription(opt.setName('user').setRequired(true), {
                        en: 'User to add',
                        ru: 'Пользователь',
                    })
                )
            )

            // remove-user
            .addSubcommand((sub) =>
                localizeDescription(sub.setName('remove-user'), {
                    en: 'Remove a user from this ticket',
                    ru: 'Удалить пользователя из тикета',
                }).addUserOption((opt) =>
                    localizeDescription(opt.setName('user').setRequired(true), {
                        en: 'User to remove',
                        ru: 'Пользователь',
                    })
                )
            )

            // rename
            .addSubcommand((sub) =>
                localizeDescription(sub.setName('rename'), {
                    en: 'Rename this ticket thread',
                    ru: 'Переименовать тред тикета',
                }).addStringOption((opt) =>
                    localizeDescription(opt.setName('name').setRequired(true).setMaxLength(100), {
                        en: 'New thread name',
                        ru: 'Новое имя треда',
                    })
                )
            )

            // transcript
            .addSubcommand((sub) =>
                localizeDescription(sub.setName('transcript'), {
                    en: 'Get the transcript link for a ticket',
                    ru: 'Получить ссылку на транскрипт тикета',
                }).addIntegerOption((opt) =>
                    localizeDescription(opt.setName('number').setRequired(false).setMinValue(1), {
                        en: 'Ticket number (defaults to current ticket)',
                        ru: 'Номер тикета (по умолчанию — текущий)',
                    })
                )
            )

            // blacklist add
            .addSubcommandGroup((group) =>
                localizeDescription(group.setName('blacklist'), {
                    en: 'Manage the ticket blacklist',
                    ru: 'Управление чёрным списком тикетов',
                })
                    .addSubcommand((sub) =>
                        localizeDescription(sub.setName('add'), {
                            en: 'Add a user to the blacklist',
                            ru: 'Добавить пользователя в чёрный список',
                        })
                            .addUserOption((opt) =>
                                localizeDescription(opt.setName('user').setRequired(true), {
                                    en: 'User to blacklist',
                                    ru: 'Пользователь',
                                })
                            )
                            .addStringOption((opt) =>
                                localizeDescription(opt.setName('reason').setRequired(false).setMaxLength(256), {
                                    en: 'Reason',
                                    ru: 'Причина',
                                })
                            )
                    )
                    .addSubcommand((sub) =>
                        localizeDescription(sub.setName('remove'), {
                            en: 'Remove a user from the blacklist',
                            ru: 'Убрать пользователя из чёрного списка',
                        }).addUserOption((opt) =>
                            localizeDescription(opt.setName('user').setRequired(true), {
                                en: 'User to remove',
                                ru: 'Пользователь',
                            })
                        )
                    )
                    .addSubcommand((sub) =>
                        localizeDescription(sub.setName('list'), {
                            en: 'List all blacklisted users',
                            ru: 'Показать чёрный список',
                        })
                    )
            )

            // panel sync
            .addSubcommand((sub) =>
                localizeDescription(sub.setName('panel'), {
                    en: 'Sync all ticket panels in this server',
                    ru: 'Синхронизировать панели тикетов',
                }).addIntegerOption((opt) =>
                    localizeDescription(opt.setName('category').setRequired(false).setMinValue(1), {
                        en: 'Specific category ID to sync',
                        ru: 'ID конкретной категории',
                    })
                )
            ),
        { en: 'Manage tickets', ru: 'Управление тикетами' }
    ),

    async execute(interaction) {
        if (!interaction.isChatInputCommand()) return;
        if (!interaction.guild || !interaction.member) {
            await interaction.reply({ content: t('en', 'general.guildOnly'), ephemeral: true });
            return;
        }

        const locale = await getInteractionLocale(interaction);
        const member = interaction.member as GuildMember;
        const subGroup = interaction.options.getSubcommandGroup(false);
        const sub = interaction.options.getSubcommand();

        // ── blacklist group ──────────────────────────────────────────────────
        if (subGroup === 'blacklist') {
            if (!member.permissions.has(PermissionFlagsBits.ManageGuild)) {
                await interaction.reply({ content: t(locale, 'general.notAdmin'), ephemeral: true });
                return;
            }

            if (sub === 'add') {
                const user = interaction.options.getUser('user', true);
                const reason = interaction.options.getString('reason') ?? '';
                await addToBlacklist(interaction.guild.id, user.id, reason, member.id);
                await interaction.reply({ content: t(locale, 'tickets.blacklist.added', { userId: user.id }), ephemeral: true });

            } else if (sub === 'remove') {
                const user = interaction.options.getUser('user', true);
                await removeFromBlacklist(interaction.guild.id, user.id);
                await interaction.reply({ content: t(locale, 'tickets.blacklist.removed', { userId: user.id }), ephemeral: true });

            } else if (sub === 'list') {
                const config = await prisma.ticketConfig.findUnique({ where: { guildId: interaction.guild.id } });
                let list: { userId: string; reason: string; addedBy: string; addedAt: string }[] = [];
                try { list = config?.blacklist ? JSON.parse(config.blacklist) : []; } catch { /* noop */ }

                if (list.length === 0) {
                    await interaction.reply({ content: t(locale, 'tickets.blacklist.empty'), ephemeral: true });
                    return;
                }

                const lines = list.map((e, i) => `${i + 1}. <@${e.userId}>${e.reason ? ` — ${e.reason}` : ''}`);
                const embed = new EmbedBuilder()
                    .setTitle(t(locale, 'tickets.blacklist.list', { count: list.length }))
                    .setDescription(lines.join('\n').slice(0, 4096))
                    .setColor(0xed4245);
                await interaction.reply({ embeds: [embed], ephemeral: true });
            }
            return;
        }

        // ── panel sync ───────────────────────────────────────────────────────
        if (sub === 'panel') {
            if (!member.permissions.has(PermissionFlagsBits.ManageGuild)) {
                await interaction.reply({ content: t(locale, 'general.notAdmin'), ephemeral: true });
                return;
            }

            const categoryId = interaction.options.getInteger('category');
            await interaction.deferReply({ ephemeral: true });

            if (categoryId) {
                const result = await syncTicketPanel(interaction.client, interaction.guild.id, categoryId);
                const ok = result.state !== 'error';
                await interaction.editReply({
                    content: ok ? t(locale, 'tickets.panel.synced') : `${t(locale, 'tickets.panel.failed')} ${result.error ?? ''}`,
                });
            } else {
                const categories = await prisma.ticketCategory.findMany({
                    where: { guildId: interaction.guild.id, channelId: { not: null } },
                });
                let synced = 0;
                for (const cat of categories) {
                    const r = await syncTicketPanel(interaction.client, interaction.guild.id, cat.id);
                    if (r.state !== 'error') synced++;
                }
                await interaction.editReply({ content: `${t(locale, 'tickets.panel.synced')} (${synced}/${categories.length})` });
            }
            return;
        }

        // ── reopen (by number, not necessarily in thread) ────────────────────
        if (sub === 'reopen') {
            const ticketNumber = interaction.options.getInteger('number', true);
            const ticket = await prisma.ticket.findUnique({
                where: { guildId_number: { guildId: interaction.guild.id, number: ticketNumber } },
            });
            if (!ticket) {
                await interaction.reply({ content: t(locale, 'tickets.notFound'), ephemeral: true });
                return;
            }

            const agentRoles = await resolveAgentRoles(ticket.categoryId);
            if (!isStaff(member, agentRoles)) {
                await interaction.reply({ content: t(locale, 'tickets.staffOnly'), ephemeral: true });
                return;
            }

            await interaction.deferReply({ ephemeral: true });
            try {
                await reopenTicket({ client: interaction.client, guild: interaction.guild, ticketId: ticket.id, actorId: member.id });
                await interaction.editReply({ content: t(locale, 'tickets.reopened', { number: ticket.number }) });
            } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : '';
                await interaction.editReply({ content: msg === 'notClosed' ? t(locale, 'tickets.notClosed') : t(locale, 'general.error') });
            }
            return;
        }

        // ── transcript ───────────────────────────────────────────────────────
        if (sub === 'transcript') {
            const ticketNumber = interaction.options.getInteger('number');

            let ticket;
            if (ticketNumber) {
                ticket = await prisma.ticket.findUnique({
                    where: { guildId_number: { guildId: interaction.guild.id, number: ticketNumber } },
                });
            } else if (isThread(interaction.channel)) {
                ticket = await resolveTicketInThread(interaction.guild.id, interaction.channelId);
            }

            if (!ticket) {
                await interaction.reply({ content: t(locale, 'tickets.notFound'), ephemeral: true });
                return;
            }

            const agentRoles = await resolveAgentRoles(ticket.categoryId);
            if (!isStaff(member, agentRoles)) {
                await interaction.reply({ content: t(locale, 'tickets.staffOnly'), ephemeral: true });
                return;
            }

            if (!ticket.transcriptToken) {
                await interaction.reply({ content: t(locale, 'tickets.transcript.notAvailable'), ephemeral: true });
                return;
            }

            const dashboardUrl = process.env.DASHBOARD_URL || process.env.NEXTAUTH_URL || '';
            const link = dashboardUrl ? `${dashboardUrl}/transcripts/${ticket.transcriptToken}` : `(token: ${ticket.transcriptToken})`;
            await interaction.reply({
                content: `${t(locale, 'tickets.transcript.link', { number: ticket.number })}: ${link}`,
                ephemeral: true,
            });
            return;
        }

        // ── in-thread subcommands ─────────────────────────────────────────────
        if (!isThread(interaction.channel)) {
            await interaction.reply({ content: t(locale, 'tickets.notInTicket'), ephemeral: true });
            return;
        }

        const ticket = await resolveTicketInThread(interaction.guild.id, interaction.channelId);
        if (!ticket) {
            await interaction.reply({ content: t(locale, 'tickets.notFound'), ephemeral: true });
            return;
        }

        const agentRoles = await resolveAgentRoles(ticket.categoryId);
        const staff = isStaff(member, agentRoles);

        switch (sub) {
            case 'close': {
                const category = await prisma.ticketCategory.findUnique({ where: { id: ticket.categoryId } });
                const isAuthor = ticket.authorId === member.id;
                if (!staff && !(isAuthor && category?.allowUserClose)) {
                    await interaction.reply({ content: t(locale, 'tickets.noPermission'), ephemeral: true });
                    return;
                }

                const reason = interaction.options.getString('reason');
                await interaction.deferReply({ ephemeral: true });
                try {
                    await closeTicket({
                        client: interaction.client,
                        guild: interaction.guild,
                        ticketId: ticket.id,
                        actorId: member.id,
                        reason,
                    });
                    await interaction.editReply({ content: t(locale, 'tickets.closed', { number: ticket.number }) });
                } catch (err: unknown) {
                    const msg = err instanceof Error ? err.message : '';
                    await interaction.editReply({ content: msg === 'alreadyClosed' ? t(locale, 'tickets.alreadyClosed') : t(locale, 'general.error') });
                }
                break;
            }

            case 'claim': {
                if (!staff) { await interaction.reply({ content: t(locale, 'tickets.staffOnly'), ephemeral: true }); return; }
                await interaction.deferReply({ ephemeral: true });
                await claimTicket({ client: interaction.client, guild: interaction.guild, ticketId: ticket.id, actorId: member.id });
                await interaction.editReply({ content: t(locale, 'tickets.claimed', { number: ticket.number, userId: member.id }) });
                break;
            }

            case 'unclaim': {
                if (!staff) { await interaction.reply({ content: t(locale, 'tickets.staffOnly'), ephemeral: true }); return; }
                await interaction.deferReply({ ephemeral: true });
                await unclaimTicket({ client: interaction.client, guild: interaction.guild, ticketId: ticket.id, actorId: member.id });
                await interaction.editReply({ content: t(locale, 'tickets.unclaimed', { number: ticket.number }) });
                break;
            }

            case 'hold': {
                if (!staff) { await interaction.reply({ content: t(locale, 'tickets.staffOnly'), ephemeral: true }); return; }
                await interaction.deferReply({ ephemeral: true });
                try {
                    await setTicketOnHold({ client: interaction.client, guild: interaction.guild, ticketId: ticket.id, actorId: member.id });
                    await interaction.editReply({ content: t(locale, 'tickets.onHold', { number: ticket.number }) });
                } catch (err: unknown) {
                    const msg = err instanceof Error ? err.message : '';
                    await interaction.editReply({ content: msg === 'alreadyClosed' ? t(locale, 'tickets.alreadyClosed') : t(locale, 'general.error') });
                }
                break;
            }

            case 'resume': {
                if (!staff) { await interaction.reply({ content: t(locale, 'tickets.staffOnly'), ephemeral: true }); return; }
                await interaction.deferReply({ ephemeral: true });
                try {
                    await resumeTicket({ client: interaction.client, guild: interaction.guild, ticketId: ticket.id, actorId: member.id });
                    await interaction.editReply({ content: t(locale, 'tickets.resumed', { number: ticket.number }) });
                } catch (err: unknown) {
                    const msg = err instanceof Error ? err.message : '';
                    await interaction.editReply({ content: msg === 'notOnHold' ? t(locale, 'tickets.notOnHold') : t(locale, 'general.error') });
                }
                break;
            }

            case 'add-user': {
                if (!staff) { await interaction.reply({ content: t(locale, 'tickets.staffOnly'), ephemeral: true }); return; }
                const user = interaction.options.getUser('user', true);
                await interaction.deferReply({ ephemeral: true });
                await addUserToTicket({ client: interaction.client, guild: interaction.guild, ticketId: ticket.id, actorId: member.id, userId: user.id });
                await interaction.editReply({ content: t(locale, 'tickets.userAdded', { userId: user.id, number: ticket.number }) });
                break;
            }

            case 'remove-user': {
                if (!staff) { await interaction.reply({ content: t(locale, 'tickets.staffOnly'), ephemeral: true }); return; }
                const user = interaction.options.getUser('user', true);
                await interaction.deferReply({ ephemeral: true });
                try {
                    await removeUserFromTicket({ client: interaction.client, guild: interaction.guild, ticketId: ticket.id, actorId: member.id, userId: user.id });
                    await interaction.editReply({ content: t(locale, 'tickets.userRemoved', { userId: user.id, number: ticket.number }) });
                } catch (err: unknown) {
                    const msg = err instanceof Error ? err.message : '';
                    await interaction.editReply({ content: msg === 'cannotRemoveAuthor' ? t(locale, 'tickets.cannotRemoveAuthor') : t(locale, 'general.error') });
                }
                break;
            }

            case 'rename': {
                if (!staff) { await interaction.reply({ content: t(locale, 'tickets.staffOnly'), ephemeral: true }); return; }
                const name = interaction.options.getString('name', true).slice(0, 100);
                await interaction.deferReply({ ephemeral: true });
                await (interaction.channel as ThreadChannel).setName(name).catch(() => null);
                await interaction.editReply({ content: t(locale, 'tickets.renamed', { number: ticket.number, name }) });
                break;
            }
        }
    },
};

export default command;
