import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelType,
    Client,
    EmbedBuilder,
    Guild,
    GuildMember,
    TextChannel,
    ThreadAutoArchiveDuration,
    ThreadChannel,
} from 'discord.js';
import crypto from 'crypto';
import { prisma } from '../utils/database';
import logger from '../utils/logger';
import { generateTranscriptBeforeClose } from './TicketTranscriptService';
import { applyTicketRouting, notifyTicketEvent } from './TicketSaasService';
import { EconomyService } from './EconomyService';

// ─── Types ────────────────────────────────────────────────────────────────────

export type TicketRow = {
    id: number;
    guildId: string;
    number: number;
    threadId: string;
    categoryId: number;
    itemId: number | null;
    authorId: string;
    claimedBy: string | null;
    priorityId: number | null;
    assignedRoleId: string | null;
    assignedTemplateId: number | null;
    responsibleUserId: string | null;
    previousResponsibleUserId: string | null;
    transferState: string;
    transferRequestedBy: string | null;
    transferRequestedTo: string | null;
    transferRequestedAt: Date | null;
    transferResolvedAt: Date | null;
    status: string;
    formAnswers: string | null;
    participants: string | null;
    closedBy: string | null;
    closeReason: string | null;
    lastActivityAt: Date;
    firstResponseAt: Date | null;
    lastStaffResponseAt: Date | null;
    slaFirstResponseDueAt: Date | null;
    slaResolutionDueAt: Date | null;
    slaState: string;
    tags: string | null;
    source: string;
    transcript: string | null;
    transcriptToken: string | null;
    deleteAfterAt: Date | null;
    rating: number | null;
    createdAt: Date;
    closedAt: Date | null;
};

export type FormAnswer = { label: string; answer: string };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseJsonArray<T>(raw: string | null | undefined): T[] {
    if (!raw) return [];
    try { return JSON.parse(raw) as T[]; } catch { return []; }
}

function renderNameTemplate(template: string, vars: { number: number; user: string }): string {
    return template
        .replace('{number}', String(vars.number))
        .replace('{user}', vars.user)
        .slice(0, 100);
}

function isThread(channel: unknown): channel is ThreadChannel {
    return Boolean(
        channel &&
        typeof channel === 'object' &&
        'isThread' in channel &&
        typeof (channel as { isThread?: () => boolean }).isThread === 'function' &&
        (channel as { isThread: () => boolean }).isThread()
    );
}

function isTextChannel(channel: unknown): channel is TextChannel {
    return (
        channel !== null &&
        typeof channel === 'object' &&
        'type' in channel &&
        (channel as { type?: ChannelType }).type === ChannelType.GuildText
    );
}

async function fetchThread(client: Client, guildId: string, threadId: string): Promise<ThreadChannel | null> {
    const guild = client.guilds.cache.get(guildId) ?? await client.guilds.fetch(guildId).catch(() => null);
    if (!guild) return null;
    const ch = await guild.channels.fetch(threadId).catch(() => null);
    return isThread(ch) ? ch : null;
}

async function resolveAgentRoles(guild: Guild, agentRoles: string | null, itemAgentRoles: string | null): Promise<string[]> {
    const ids = new Set([...parseJsonArray<string>(agentRoles), ...parseJsonArray<string>(itemAgentRoles)]);
    return [...ids].filter((id) => guild.roles.cache.has(id));
}

export function isStaff(member: GuildMember, agentRoleIds: string[]): boolean {
    if (member.permissions.has('Administrator')) return true;
    if (member.permissions.has('ManageThreads')) return true;
    return agentRoleIds.some((id) => member.roles.cache.has(id));
}

// ─── In-memory creation lock (per guild:user) ─────────────────────────────────

const creationLocks = new Set<string>();

// ─── Ticket events ────────────────────────────────────────────────────────────

export async function appendTicketEvent(options: {
    guildId: string;
    ticketId: number;
    eventType: string;
    actorUserId?: string | null;
    note?: string | null;
    payload?: Record<string, unknown> | null;
}): Promise<void> {
    await prisma.ticketEvent.create({
        data: {
            guildId: options.guildId,
            ticketId: options.ticketId,
            eventType: options.eventType,
            actorUserId: options.actorUserId ?? null,
            note: options.note ?? null,
            payload: options.payload ? JSON.stringify(options.payload) : null,
        },
    });
}

// ─── Limits & guards ──────────────────────────────────────────────────────────

export async function checkCreateAllowed(
    guildId: string,
    userId: string,
    categoryId: number,
): Promise<{ ok: true } | { ok: false; reason: string }> {
    const config = await prisma.ticketConfig.findUnique({ where: { guildId } });
    if (!config?.enabled) return { ok: false, reason: 'disabled' };

    // Blacklist
    const blacklist = parseJsonArray<{ userId: string }>(config.blacklist);
    if (blacklist.some((entry) => entry.userId === userId)) {
        return { ok: false, reason: 'blacklisted' };
    }

    // Max open
    const openCount = await prisma.ticket.count({
        where: { guildId, authorId: userId, status: { in: ['OPEN', 'ON_HOLD'] } },
    });
    if (openCount >= config.maxOpenPerUser) {
        return { ok: false, reason: 'limitReached' };
    }

    // Cooldown (seconds)
    if (config.cooldownSeconds > 0) {
        const latest = await prisma.ticket.findFirst({
            where: { guildId, authorId: userId },
            orderBy: { createdAt: 'desc' },
        });
        if (latest) {
            const elapsed = (Date.now() - latest.createdAt.getTime()) / 1000;
            if (elapsed < config.cooldownSeconds) {
                const remaining = Math.ceil(config.cooldownSeconds - elapsed);
                return { ok: false, reason: `cooldown:${remaining}` };
            }
        }
    }

    return { ok: true };
}

// ─── Core create ─────────────────────────────────────────────────────────────

export async function createTicket(options: {
    client: Client;
    guild: Guild;
    authorId: string;
    categoryId: number;
    itemId?: number | null;
    formAnswers?: FormAnswer[];
}): Promise<{ ticket: TicketRow; thread: ThreadChannel }> {
    const { client, guild, authorId, categoryId, itemId, formAnswers } = options;
    const lockKey = `${guild.id}:${authorId}`;

    if (creationLocks.has(lockKey)) {
        throw new Error('creationInProgress');
    }
    creationLocks.add(lockKey);

    try {
        const category = await prisma.ticketCategory.findFirst({
            where: { id: categoryId, guildId: guild.id },
            include: { items: true, forms: { orderBy: { order: 'asc' } } },
        });
        if (!category || !category.channelId) {
            throw new Error('categoryNotFound');
        }

        const item = itemId ? category.items.find((i) => i.id === itemId) ?? null : null;

        // Allocate ticket number in a transaction
        let ticket!: TicketRow;
        await prisma.$transaction(async (tx) => {
            const config = await tx.ticketConfig.upsert({
                where: { guildId: guild.id },
                update: { nextTicketNumber: { increment: 1 } },
                create: { guildId: guild.id, enabled: true, nextTicketNumber: 2 },
            });

            ticket = await tx.ticket.create({
                data: {
                    guildId: guild.id,
                    number: config.nextTicketNumber - 1,
                    threadId: 'pending',
                    categoryId,
                    itemId: itemId ?? null,
                    authorId,
                    status: 'OPEN',
                    formAnswers: formAnswers?.length ? JSON.stringify(formAnswers) : null,
                },
            }) as unknown as TicketRow;
        });

        // Create the private thread in the panel channel
        const panelChannel = await guild.channels.fetch(category.channelId).catch(() => null);
        if (!panelChannel || !isTextChannel(panelChannel)) {
            await prisma.ticket.delete({ where: { id: ticket.id } }).catch(() => null);
            throw new Error('panelChannelNotFound');
        }

        const author = await guild.members.fetch(authorId).catch(() => null);
        const threadName = renderNameTemplate(category.nameTemplate || 'ticket-{number}', {
            number: ticket.number,
            user: author?.user.username ?? authorId,
        });

        const thread = await panelChannel.threads.create({
            name: threadName,
            type: ChannelType.PrivateThread,
            autoArchiveDuration: ThreadAutoArchiveDuration.OneWeek,
            invitable: false,
        });

        // Update the ticket row with the real threadId
        await prisma.ticket.update({ where: { id: ticket.id }, data: { threadId: thread.id } });
        const routed = await applyTicketRouting(ticket.id);
        ticket = { ...ticket, ...routed, threadId: thread.id } as unknown as TicketRow;

        await appendTicketEvent({
            guildId: guild.id,
            ticketId: ticket.id,
            eventType: 'CREATED',
            actorUserId: authorId,
        });

        // Add the author to the thread (bot is added by sending)
        await thread.members.add(authorId).catch(() => null);

        // Build agent role pings (pulls role members into the private thread)
        const agentRoleIds = await resolveAgentRoles(guild, category.agentRoles, item?.agentRoles ?? null);
        const mentionLine = [
            category.mentionAgents && agentRoleIds.length ? agentRoleIds.map((id) => `<@&${id}>`).join(' ') : '',
            `<@${authorId}>`,
        ].filter(Boolean).join(' ');

        // Build root embed
        const rootEmbed = new EmbedBuilder()
            .setColor(0x5865f2)
            .setTitle(`Ticket #${ticket.number}`)
            .addFields(
                { name: 'Category', value: category.name, inline: true },
                { name: 'Author', value: `<@${authorId}>`, inline: true },
                ...(ticket.assignedRoleId ? [{ name: 'Assigned Team', value: `<@&${ticket.assignedRoleId}>`, inline: true }] : []),
                ...(item ? [{ name: 'Department', value: item.label, inline: true }] : []),
            );

        if (formAnswers?.length) {
            for (const ans of formAnswers) {
                rootEmbed.addFields({ name: ans.label, value: ans.answer.slice(0, 1024) || '—', inline: false });
            }
        }

        // Control buttons
        const controlRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
            ...[
                new ButtonBuilder()
                    .setCustomId(`tk_close:${ticket.id}`)
                    .setLabel('Close')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId(`tk_claim:${ticket.id}`)
                    .setLabel('Claim')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId(`tk_hold:${ticket.id}`)
                    .setLabel('Hold')
                    .setStyle(ButtonStyle.Secondary),
            ],
        );

        await thread.send({
            content: mentionLine || undefined,
            embeds: [rootEmbed],
            components: [controlRow],
        });

        // Quick-reply item
        if (item?.type === 'REPLY' && item.replyContent) {
            await thread.send(item.replyContent).catch(() => null);
        }

        // Log to logChannelId
        await postTicketLog(client, guild.id, 'CREATED', ticket, category.name, authorId).catch(() => null);
        await notifyTicketEvent(client, guild, ticket.id, 'CREATED').catch(() => null);

        return { ticket, thread };
    } finally {
        creationLocks.delete(lockKey);
    }
}

// ─── Log helper ───────────────────────────────────────────────────────────────

async function postTicketLog(
    client: Client,
    guildId: string,
    action: string,
    ticket: TicketRow,
    categoryName: string,
    actorId: string,
    extra?: { reason?: string; transcriptToken?: string | null },
): Promise<void> {
    const config = await prisma.ticketConfig.findUnique({ where: { guildId } });
    if (!config?.logChannelId) return;

    const guild = client.guilds.cache.get(guildId) ?? await client.guilds.fetch(guildId).catch(() => null);
    if (!guild) return;

    const logChannel = await guild.channels.fetch(config.logChannelId).catch(() => null);
    if (!logChannel || !isTextChannel(logChannel)) return;

    const dashboardUrl = process.env.DASHBOARD_URL || process.env.NEXTAUTH_URL || '';
    const transcriptLink = extra?.transcriptToken && dashboardUrl
        ? `[View transcript](${dashboardUrl}/transcripts/${extra.transcriptToken})`
        : null;

    const colorMap: Record<string, number> = {
        CREATED: 0x57f287,
        CLOSED: 0xed4245,
        CLAIMED: 0x5865f2,
        ON_HOLD: 0xfee75c,
        REOPENED: 0x57f287,
    };

    const embed = new EmbedBuilder()
        .setColor(colorMap[action] ?? 0x99aab5)
        .setTitle(`Ticket #${ticket.number} — ${action}`)
        .addFields(
            { name: 'Category', value: categoryName, inline: true },
            { name: 'Author', value: `<@${ticket.authorId}>`, inline: true },
            { name: 'Actor', value: `<@${actorId}>`, inline: true },
            ...(extra?.reason ? [{ name: 'Reason', value: extra.reason.slice(0, 512), inline: false }] : []),
            ...(transcriptLink ? [{ name: 'Transcript', value: transcriptLink, inline: false }] : []),
        )
        .setTimestamp();

    const components = action === 'CLOSED' ? [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId(`tk_reopen:${ticket.id}`)
                .setLabel('Reopen')
                .setStyle(ButtonStyle.Secondary),
        ),
    ] : [];

    await logChannel.send({ embeds: [embed], components }).catch(() => null);
}

// ─── Close ────────────────────────────────────────────────────────────────────

export async function closeTicket(options: {
    client: Client;
    guild: Guild;
    ticketId: number;
    actorId: string;
    reason?: string | null;
    transcript?: string | null;
}): Promise<TicketRow> {
    const { client, guild, ticketId, actorId, reason, transcript } = options;

    // Guard against double-close
    const existing = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!existing || existing.guildId !== guild.id) throw new Error('ticketNotFound');
    if (existing.status === 'CLOSED') throw new Error('alreadyClosed');

    const transcriptToken = crypto.randomBytes(18).toString('base64url');

    const category = await prisma.ticketCategory.findUnique({ where: { id: existing.categoryId } });

    // Generate transcript while thread still exists
    const dashboardUrl = process.env.DASHBOARD_URL || process.env.NEXTAUTH_URL || '';
    const generatedTranscript = transcript ?? await generateTranscriptBeforeClose(client, ticketId, dashboardUrl || undefined).catch(() => null);

    let deleteAfterAt: Date | null = null;
    if (category?.closeAction === 'ARCHIVE' && category.autoDeleteHours) {
        deleteAfterAt = new Date(Date.now() + category.autoDeleteHours * 60 * 60 * 1000);
    }

    const updated = await prisma.ticket.update({
        where: { id: ticketId },
        data: {
            status: 'CLOSED',
            closedAt: new Date(),
            closedBy: actorId,
            closeReason: reason ?? null,
            transcript: generatedTranscript ?? null,
            transcriptToken,
            deleteAfterAt,
        },
    }) as unknown as TicketRow;

    await appendTicketEvent({
        guildId: guild.id,
        ticketId,
        eventType: 'CLOSED',
        actorUserId: actorId,
        note: reason ?? null,
    });

    // Thread teardown
    const thread = await fetchThread(client, guild.id, existing.threadId);
    if (thread) {
        const closeNotice = new EmbedBuilder()
            .setColor(0xed4245)
            .setDescription(`Ticket closed by <@${actorId}>${reason ? `\n**Reason:** ${reason}` : ''}`);
        await thread.send({ embeds: [closeNotice] }).catch(() => null);

        if (category?.closeAction === 'DELETE') {
            await thread.delete().catch(() => null);
        } else {
            await thread.setLocked(true).catch(() => null);
            await thread.setArchived(true).catch(() => null);
        }
    }

    // Log
    await postTicketLog(client, guild.id, 'CLOSED', updated, category?.name ?? 'Unknown', actorId, {
        reason: reason ?? undefined,
        transcriptToken,
    }).catch(() => null);

    // Rating DM
    if (category?.enableRating) {
        sendRatingDm(client, updated).catch(() => null);
    }

    return updated;
}

async function sendRatingDm(client: Client, ticket: TicketRow): Promise<void> {
    const user = await client.users.fetch(ticket.authorId).catch(() => null);
    if (!user) return;

    const ratingRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        ...([1, 2, 3, 4, 5].map((n) =>
            new ButtonBuilder()
                .setCustomId(`tk_rate:${ticket.id}:${n}`)
                .setLabel(n === 1 ? '⭐' : n === 2 ? '⭐⭐' : n === 3 ? '⭐⭐⭐' : n === 4 ? '⭐⭐⭐⭐' : '⭐⭐⭐⭐⭐')
                .setStyle(ButtonStyle.Secondary)
        )),
    );

    const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(`Rate your support experience`)
        .setDescription(`How was ticket #${ticket.number}? Your feedback helps us improve.`);

    await user.send({ embeds: [embed], components: [ratingRow] }).catch(() => null);
}

// ─── Reopen ───────────────────────────────────────────────────────────────────

export async function reopenTicket(options: {
    client: Client;
    guild: Guild;
    ticketId: number;
    actorId: string;
}): Promise<TicketRow> {
    const { client, guild, ticketId, actorId } = options;

    const existing = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!existing || existing.guildId !== guild.id) throw new Error('ticketNotFound');
    if (existing.status !== 'CLOSED') throw new Error('notClosed');

    const category = await prisma.ticketCategory.findUnique({ where: { id: existing.categoryId } });

    let thread = await fetchThread(client, guild.id, existing.threadId);
    let newThreadId = existing.threadId;

    if (category?.closeAction !== 'DELETE' && thread?.archived) {
        // Unarchive the existing thread
        await thread.setArchived(false).catch(() => null);
        await thread.setLocked(false).catch(() => null);
    } else {
        // Thread was deleted — create a new one
        const author = await guild.members.fetch(existing.authorId).catch(() => null);
        const panelChannel = category?.channelId
            ? await guild.channels.fetch(category.channelId).catch(() => null)
            : null;

        if (panelChannel && isTextChannel(panelChannel)) {
            const threadName = renderNameTemplate(category?.nameTemplate || 'ticket-{number}', {
                number: existing.number,
                user: author?.user.username ?? existing.authorId,
            });
            const newThread = await panelChannel.threads.create({
                name: threadName,
                type: ChannelType.PrivateThread,
                autoArchiveDuration: ThreadAutoArchiveDuration.OneWeek,
                invitable: false,
            });
            await newThread.members.add(existing.authorId).catch(() => null);
            newThreadId = newThread.id;
            thread = newThread;
        }
    }

    const updated = await prisma.ticket.update({
        where: { id: ticketId },
        data: {
            status: 'OPEN',
            closedAt: null,
            closedBy: null,
            deleteAfterAt: null,
            threadId: newThreadId,
        },
    }) as unknown as TicketRow;

    await appendTicketEvent({ guildId: guild.id, ticketId, eventType: 'REOPENED', actorUserId: actorId });

    if (thread) {
        await thread.send({ content: `Ticket reopened by <@${actorId}>` }).catch(() => null);
    }

    await postTicketLog(client, guild.id, 'REOPENED', updated, category?.name ?? 'Unknown', actorId).catch(() => null);

    return updated;
}

// ─── Claim / Unclaim ──────────────────────────────────────────────────────────

export async function claimTicket(options: {
    client: Client;
    guild: Guild;
    ticketId: number;
    actorId: string;
}): Promise<TicketRow> {
    const { client, guild, ticketId, actorId } = options;
    const existing = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!existing || existing.guildId !== guild.id) throw new Error('ticketNotFound');
    if (existing.status === 'CLOSED') throw new Error('alreadyClosed');

    const updated = await prisma.ticket.update({
        where: { id: ticketId },
        data: { claimedBy: actorId, responsibleUserId: actorId },
    }) as unknown as TicketRow;

    await appendTicketEvent({ guildId: guild.id, ticketId, eventType: 'CLAIMED', actorUserId: actorId });

    const thread = await fetchThread(client, guild.id, existing.threadId);
    if (thread) {
        await thread.send({ content: `Claimed by <@${actorId}>` }).catch(() => null);
    }

    return updated;
}

export async function unclaimTicket(options: {
    client: Client;
    guild: Guild;
    ticketId: number;
    actorId: string;
}): Promise<TicketRow> {
    const { client, guild, ticketId, actorId } = options;
    const existing = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!existing || existing.guildId !== guild.id) throw new Error('ticketNotFound');
    if (existing.status === 'CLOSED') throw new Error('alreadyClosed');

    const updated = await prisma.ticket.update({
        where: { id: ticketId },
        data: { claimedBy: null, responsibleUserId: null },
    }) as unknown as TicketRow;

    await appendTicketEvent({ guildId: guild.id, ticketId, eventType: 'UNCLAIMED', actorUserId: actorId });

    const thread = await fetchThread(client, guild.id, existing.threadId);
    if (thread) {
        await thread.send({ content: `Unclaimed by <@${actorId}>` }).catch(() => null);
    }

    return updated;
}

// ─── Hold / Resume ────────────────────────────────────────────────────────────

export async function setTicketOnHold(options: {
    client: Client;
    guild: Guild;
    ticketId: number;
    actorId: string;
}): Promise<TicketRow> {
    const { client, guild, ticketId, actorId } = options;
    const existing = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!existing || existing.guildId !== guild.id) throw new Error('ticketNotFound');
    if (existing.status === 'CLOSED') throw new Error('alreadyClosed');

    const updated = await prisma.ticket.update({
        where: { id: ticketId },
        data: { status: 'ON_HOLD' },
    }) as unknown as TicketRow;

    await appendTicketEvent({ guildId: guild.id, ticketId, eventType: 'ON_HOLD', actorUserId: actorId });

    const thread = await fetchThread(client, guild.id, existing.threadId);
    if (thread) {
        await thread.send({ content: `Ticket put on hold by <@${actorId}>` }).catch(() => null);
    }

    return updated;
}

export async function resumeTicket(options: {
    client: Client;
    guild: Guild;
    ticketId: number;
    actorId: string;
}): Promise<TicketRow> {
    const { client, guild, ticketId, actorId } = options;
    const existing = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!existing || existing.guildId !== guild.id) throw new Error('ticketNotFound');
    if (existing.status !== 'ON_HOLD') throw new Error('notOnHold');

    const updated = await prisma.ticket.update({
        where: { id: ticketId },
        data: { status: 'OPEN' },
    }) as unknown as TicketRow;

    await appendTicketEvent({ guildId: guild.id, ticketId, eventType: 'RESUMED', actorUserId: actorId });

    const thread = await fetchThread(client, guild.id, existing.threadId);
    if (thread) {
        await thread.send({ content: `Ticket resumed by <@${actorId}>` }).catch(() => null);
    }

    return updated;
}

// ─── Add / Remove user ────────────────────────────────────────────────────────

export async function addUserToTicket(options: {
    client: Client;
    guild: Guild;
    ticketId: number;
    actorId: string;
    userId: string;
}): Promise<void> {
    const { client, guild, ticketId, actorId, userId } = options;
    const existing = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!existing || existing.guildId !== guild.id) throw new Error('ticketNotFound');
    if (existing.status === 'CLOSED') throw new Error('alreadyClosed');

    const participants = parseJsonArray<string>(existing.participants);
    if (!participants.includes(userId)) participants.push(userId);

    await prisma.ticket.update({
        where: { id: ticketId },
        data: { participants: JSON.stringify(participants) },
    });

    await appendTicketEvent({ guildId: guild.id, ticketId, eventType: 'USER_ADDED', actorUserId: actorId, payload: { userId } });

    const thread = await fetchThread(client, guild.id, existing.threadId);
    if (thread) {
        await thread.members.add(userId).catch(() => null);
        await thread.send({ content: `<@${userId}> added to this ticket by <@${actorId}>` }).catch(() => null);
    }
}

export async function removeUserFromTicket(options: {
    client: Client;
    guild: Guild;
    ticketId: number;
    actorId: string;
    userId: string;
}): Promise<void> {
    const { client, guild, ticketId, actorId, userId } = options;
    const existing = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!existing || existing.guildId !== guild.id) throw new Error('ticketNotFound');
    if (existing.status === 'CLOSED') throw new Error('alreadyClosed');
    if (userId === existing.authorId) throw new Error('cannotRemoveAuthor');

    const participants = parseJsonArray<string>(existing.participants).filter((id) => id !== userId);

    await prisma.ticket.update({
        where: { id: ticketId },
        data: { participants: JSON.stringify(participants) },
    });

    await appendTicketEvent({ guildId: guild.id, ticketId, eventType: 'USER_REMOVED', actorUserId: actorId, payload: { userId } });

    const thread = await fetchThread(client, guild.id, existing.threadId);
    if (thread) {
        await thread.members.remove(userId).catch(() => null);
        await thread.send({ content: `<@${userId}> removed from this ticket by <@${actorId}>` }).catch(() => null);
    }
}

// ─── Rating ───────────────────────────────────────────────────────────────────

export async function submitRating(options: {
    ticketId: number;
    userId: string;
    rating: number;
}): Promise<void> {
    const { ticketId, userId, rating } = options;
    const existing = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!existing) throw new Error('ticketNotFound');
    if (existing.authorId !== userId) throw new Error('notAuthor');
    if (existing.rating !== null) throw new Error('alreadyRated');
    if (existing.status !== 'CLOSED') throw new Error('notClosed');

    await prisma.ticket.update({ where: { id: ticketId }, data: { rating } });
    await appendTicketEvent({ guildId: existing.guildId, ticketId, eventType: 'RATED', actorUserId: userId, payload: { rating } });

    // Economy integration: reward the agent who handled the ticket for a good rating.
    const agentId = existing.responsibleUserId ?? existing.claimedBy;
    if (agentId) {
        applyTicketBonus(existing.guildId, agentId, rating, ticketId).catch((err) =>
            logger.error('[Economy] Failed to apply ticket rating bonus', err)
        );
    }
}

async function applyTicketBonus(guildId: string, agentId: string, rating: number, ticketId: number): Promise<void> {
    if (!(await EconomyService.isSourceEnabled(guildId, 'TICKET_BONUS'))) return;

    const row = await prisma.economyEarnSource.findUnique({
        where: { guildId_source: { guildId, source: 'TICKET_BONUS' } },
    });
    let minRating = 4;
    let amount = 0;
    if (row?.settings) {
        try {
            const parsed = JSON.parse(row.settings);
            if (Number.isFinite(parsed.minRating)) minRating = parsed.minRating;
            if (Number.isFinite(parsed.amount)) amount = parsed.amount;
        } catch {
            // fall through with defaults
        }
    }

    if (rating < minRating || amount <= 0) return;

    await EconomyService.credit({
        guildId,
        userId: agentId,
        account: 'WALLET',
        amount: BigInt(amount),
        type: 'TICKET_BONUS',
        sourceRef: `ticket:${ticketId}`,
        idempotencyKey: `ticket_bonus:${guildId}:${ticketId}`,
    });
}

// ─── Lookup helpers ───────────────────────────────────────────────────────────

export async function findTicketByThread(threadId: string): Promise<TicketRow | null> {
    return prisma.ticket.findUnique({ where: { threadId } }) as Promise<TicketRow | null>;
}

export async function addToBlacklist(guildId: string, userId: string, reason: string, addedBy: string): Promise<void> {
    const config = await prisma.ticketConfig.findUnique({ where: { guildId } });
    const list = parseJsonArray<{ userId: string; reason: string; addedBy: string; addedAt: string }>(config?.blacklist ?? null);
    if (!list.find((e) => e.userId === userId)) {
        list.push({ userId, reason, addedBy, addedAt: new Date().toISOString() });
    }
    await prisma.ticketConfig.upsert({
        where: { guildId },
        update: { blacklist: JSON.stringify(list) },
        create: { guildId, enabled: false, blacklist: JSON.stringify(list) },
    });
}

export async function removeFromBlacklist(guildId: string, userId: string): Promise<void> {
    const config = await prisma.ticketConfig.findUnique({ where: { guildId } });
    const list = parseJsonArray<{ userId: string }>(config?.blacklist ?? null).filter((e) => e.userId !== userId);
    await prisma.ticketConfig.update({ where: { guildId }, data: { blacklist: JSON.stringify(list) } });
}
