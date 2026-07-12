import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    Client,
    Guild,
    GuildMember,
    TextBasedChannel,
} from 'discord.js';
import { prisma } from '../utils/database';

export const DEFAULT_TICKET_PRIORITIES = [
    { key: 'LOW', name: 'Low', color: '#64748b', sortOrder: 10, firstResponseMinutes: 1440, resolutionMinutes: 10080 },
    { key: 'NORMAL', name: 'Normal', color: '#22c55e', sortOrder: 20, firstResponseMinutes: 480, resolutionMinutes: 2880 },
    { key: 'HIGH', name: 'High', color: '#f59e0b', sortOrder: 30, firstResponseMinutes: 120, resolutionMinutes: 720 },
    { key: 'URGENT', name: 'Urgent', color: '#ef4444', sortOrder: 40, firstResponseMinutes: 30, resolutionMinutes: 240, forceNotify: true },
] as const;

const TRANSFER_TTL_HOURS = 24;

function priorityDurationMs(priority: { firstResponseMinutes?: number | null; resolutionMinutes?: number | null; firstResponseSeconds?: number | null; resolutionSeconds?: number | null }, field: 'firstResponse' | 'resolution') {
    const seconds = field === 'firstResponse'
        ? priority.firstResponseSeconds ?? (priority.firstResponseMinutes ?? 0) * 60
        : priority.resolutionSeconds ?? (priority.resolutionMinutes ?? 0) * 60;
    return seconds > 0 ? seconds * 1_000 : null;
}

async function appendSaasTicketEvent(options: {
    guildId: string;
    ticketId: number;
    eventType: string;
    actorUserId?: string | null;
    note?: string | null;
    payload?: Record<string, unknown> | null;
}) {
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

function parseJsonArray(raw: string | null | undefined): string[] {
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
    } catch {
        return [];
    }
}

function unique(values: string[]) {
    return [...new Set(values.filter(Boolean))];
}

export async function ensureTicketPriorities(guildId: string) {
    const existing = await prisma.ticketPriority.findMany({ where: { guildId }, orderBy: { sortOrder: 'asc' } });
    if (existing.length > 0) return existing;

    await prisma.ticketPriority.createMany({
        data: DEFAULT_TICKET_PRIORITIES.map((priority) => ({
            guildId,
            key: priority.key,
            name: priority.name,
            color: priority.color,
            sortOrder: priority.sortOrder,
            firstResponseMinutes: priority.firstResponseMinutes,
            resolutionMinutes: priority.resolutionMinutes,
            forceNotify: 'forceNotify' in priority ? Boolean(priority.forceNotify) : false,
            isDefault: priority.key === 'NORMAL',
        })),
        skipDuplicates: true,
    });

    return prisma.ticketPriority.findMany({ where: { guildId }, orderBy: { sortOrder: 'asc' } });
}

export async function getDefaultTicketPriority(guildId: string, preferredPriorityId?: number | null) {
    const priorities = await ensureTicketPriorities(guildId);
    if (preferredPriorityId) {
        const preferred = priorities.find((priority) => priority.id === preferredPriorityId && priority.enabled);
        if (preferred) return preferred;
    }
    return priorities.find((priority) => priority.isDefault && priority.enabled)
        ?? priorities.find((priority) => priority.key === 'NORMAL' && priority.enabled)
        ?? priorities.find((priority) => priority.enabled)
        ?? priorities[0];
}

export async function resolveTicketRouting(guildId: string, categoryId: number) {
    const [category, routing] = await Promise.all([
        prisma.ticketCategory.findFirst({ where: { id: categoryId, guildId } }),
        prisma.ticketCategoryRoutingRule.findUnique({ where: { categoryId } }),
    ]);
    const priority = await getDefaultTicketPriority(guildId, routing?.defaultPriorityId ?? category?.defaultPriorityId ?? null);

    return {
        assignedRoleId: routing?.assignedRoleId ?? category?.assignedRoleId ?? null,
        assignedTemplateId: routing?.assignedTemplateId ?? category?.assignedTemplateId ?? null,
        priorityId: priority?.id ?? null,
        priority,
        notifyRoleIds: unique([
            ...parseJsonArray(priority?.notifyRoleIds),
            ...parseJsonArray(routing?.notifyRoleIds),
        ]),
    };
}

export async function applyTicketRouting(ticketId: number) {
    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new Error('ticketNotFound');
    const routing = await resolveTicketRouting(ticket.guildId, ticket.categoryId);

    const updated = await prisma.ticket.update({
        where: { id: ticketId },
        data: {
            assignedRoleId: routing.assignedRoleId,
            assignedTemplateId: routing.assignedTemplateId,
            priorityId: routing.priorityId,
            slaFirstResponseDueAt: routing.priority ? (() => { const duration = priorityDurationMs(routing.priority, 'firstResponse'); return duration ? new Date(Date.now() + duration) : null; })() : null,
            slaResolutionDueAt: routing.priority ? (() => { const duration = priorityDurationMs(routing.priority, 'resolution'); return duration ? new Date(Date.now() + duration) : null; })() : null,
        },
    });

    await appendSaasTicketEvent({
        guildId: ticket.guildId,
        ticketId,
        eventType: 'ROUTED',
        payload: {
            assignedRoleId: routing.assignedRoleId,
            assignedTemplateId: routing.assignedTemplateId,
            priorityId: routing.priorityId,
        },
    });

    return updated;
}

export async function setTicketPriority(options: {
    ticketId: number;
    guildId: string;
    actorId: string;
    priorityId: number;
}) {
    const priority = await prisma.ticketPriority.findFirst({
        where: { id: options.priorityId, guildId: options.guildId, enabled: true },
    });
    if (!priority) throw new Error('priorityNotFound');

    const ticket = await prisma.ticket.findFirst({ where: { id: options.ticketId, guildId: options.guildId } });
    if (!ticket) throw new Error('ticketNotFound');

    const updated = await prisma.ticket.update({
        where: { id: options.ticketId },
        data: {
            priorityId: priority.id,
            slaFirstResponseDueAt: ticket.firstResponseAt
                ? ticket.slaFirstResponseDueAt
                : (() => { const duration = priorityDurationMs(priority, 'firstResponse'); return duration ? new Date(Date.now() + duration) : null; })(),
            slaResolutionDueAt: (() => { const duration = priorityDurationMs(priority, 'resolution'); return duration ? new Date(Date.now() + duration) : null; })(),
        },
    });

    await appendSaasTicketEvent({
        guildId: options.guildId,
        ticketId: options.ticketId,
        eventType: 'PRIORITY_CHANGED',
        actorUserId: options.actorId,
        payload: { priorityId: priority.id, priorityKey: priority.key, priorityName: priority.name },
    });

    return updated;
}

export async function createTransferRequest(options: {
    ticketId: number;
    guildId: string;
    fromUserId: string;
    toUserId: string;
    note?: string | null;
}) {
    const ticket = await prisma.ticket.findFirst({ where: { id: options.ticketId, guildId: options.guildId } });
    if (!ticket) throw new Error('ticketNotFound');
    if (ticket.status === 'CLOSED') throw new Error('alreadyClosed');

    await prisma.ticketTransferRequest.updateMany({
        where: { ticketId: ticket.id, status: 'PENDING' },
        data: { status: 'EXPIRED', resolvedAt: new Date() },
    });

    const request = await prisma.ticketTransferRequest.create({
        data: {
            guildId: options.guildId,
            ticketId: ticket.id,
            fromUserId: options.fromUserId,
            toUserId: options.toUserId,
            note: options.note ?? null,
            expiresAt: new Date(Date.now() + TRANSFER_TTL_HOURS * 60 * 60 * 1000),
        },
    });

    await prisma.ticket.update({
        where: { id: ticket.id },
        data: {
            transferState: 'PENDING',
            transferRequestedBy: options.fromUserId,
            transferRequestedTo: options.toUserId,
            transferRequestedAt: request.requestedAt,
            transferResolvedAt: null,
        },
    });

    await appendSaasTicketEvent({
        guildId: options.guildId,
        ticketId: ticket.id,
        eventType: 'TRANSFER_REQUESTED',
        actorUserId: options.fromUserId,
        payload: { transferRequestId: request.id, toUserId: options.toUserId },
    });

    return request;
}

function isThreadMemberManageable(channel: unknown): channel is {
    members: {
        add: (userId: string) => Promise<unknown>;
        remove: (userId: string) => Promise<unknown>;
    };
    send: (payload: unknown) => Promise<unknown>;
} {
    return Boolean(channel && typeof channel === 'object' && 'members' in channel && 'send' in channel);
}

export async function postTransferRequestPrompt(guild: Guild, ticketId: number, requestId: number) {
    const request = await prisma.ticketTransferRequest.findUnique({ where: { id: requestId } });
    const ticket = await prisma.ticket.findFirst({ where: { id: ticketId, guildId: guild.id } });
    if (!request || !ticket) return;

    const channel = await guild.channels.fetch(ticket.threadId).catch(() => null);
    if (!isThreadMemberManageable(channel)) return;

    await channel.members.add(request.toUserId).catch(() => null);
    await channel.send({
        content: `<@${request.toUserId}> transfer request for ticket #${ticket.number}.`,
        components: [
            new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                    .setCustomId(`tk_transfer_accept:${ticket.id}:${request.id}`)
                    .setLabel('Accept')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId(`tk_transfer_decline:${ticket.id}:${request.id}`)
                    .setLabel('Decline')
                    .setStyle(ButtonStyle.Secondary),
            ),
        ],
        allowedMentions: { users: [request.toUserId] },
    }).catch(() => null);
}

export async function applyTransferThreadAccess(guild: Guild, ticketId: number, fromUserId: string, toUserId: string) {
    const ticket = await prisma.ticket.findFirst({ where: { id: ticketId, guildId: guild.id } });
    if (!ticket) return;

    const channel = await guild.channels.fetch(ticket.threadId).catch(() => null);
    if (!isThreadMemberManageable(channel)) return;

    await channel.members.add(toUserId).catch(() => null);
    if (fromUserId !== toUserId) {
        await channel.members.remove(fromUserId).catch(() => null);
    }
}

export async function resolveTransferRequest(options: {
    ticketId: number;
    guildId: string;
    requestId: number;
    actorId: string;
    accept: boolean;
}) {
    const request = await prisma.ticketTransferRequest.findFirst({
        where: { id: options.requestId, ticketId: options.ticketId, guildId: options.guildId },
    });
    if (!request) throw new Error('transferNotFound');
    if (request.status !== 'PENDING') throw new Error('transferNotPending');
    if (request.toUserId !== options.actorId) throw new Error('transferWrongRecipient');

    const status = options.accept ? 'ACCEPTED' : 'DECLINED';
    await prisma.ticketTransferRequest.update({
        where: { id: request.id },
        data: { status, resolvedAt: new Date() },
    });

    const updated = await prisma.ticket.update({
        where: { id: options.ticketId },
        data: options.accept
            ? {
                previousResponsibleUserId: request.fromUserId,
                responsibleUserId: request.toUserId,
                claimedBy: request.toUserId,
                transferState: 'ACCEPTED',
                transferResolvedAt: new Date(),
            }
            : {
                transferState: 'DECLINED',
                transferResolvedAt: new Date(),
            },
    });

    await appendSaasTicketEvent({
        guildId: options.guildId,
        ticketId: options.ticketId,
        eventType: options.accept ? 'TRANSFER_ACCEPTED' : 'TRANSFER_DECLINED',
        actorUserId: options.actorId,
        payload: { transferRequestId: request.id, fromUserId: request.fromUserId },
    });

    return updated;
}

export async function addTicketInternalNote(options: {
    guildId: string;
    ticketId: number;
    authorId: string;
    body: string;
}) {
    const note = await prisma.ticketInternalNote.create({
        data: {
            guildId: options.guildId,
            ticketId: options.ticketId,
            authorId: options.authorId,
            body: options.body,
        },
    });
    await appendSaasTicketEvent({
        guildId: options.guildId,
        ticketId: options.ticketId,
        eventType: 'NOTE',
        actorUserId: options.authorId,
    });
    return note;
}

function isTextSendable(channel: unknown): channel is TextBasedChannel & { send: (payload: unknown) => Promise<unknown> } {
    return Boolean(channel && typeof channel === 'object' && 'isTextBased' in channel && typeof (channel as { isTextBased?: () => boolean }).isTextBased === 'function' && (channel as { isTextBased: () => boolean }).isTextBased());
}

export async function notifyTicketEvent(client: Client, guild: Guild, ticketId: number, eventType: string) {
    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId }, include: { category: true } });
    if (!ticket) return;
    const rules = await prisma.ticketNotificationRule.findMany({
        where: {
            guildId: guild.id,
            enabled: true,
            eventType,
            OR: [
                { categoryId: null },
                { categoryId: ticket.categoryId },
            ],
        },
    });
    if (!rules.length && !ticket.priorityId) return;

    const priority = ticket.priorityId ? await prisma.ticketPriority.findUnique({ where: { id: ticket.priorityId } }) : null;
    const roleIds = unique([
        ...parseJsonArray(priority?.notifyRoleIds),
        ...rules.flatMap((rule) => parseJsonArray(rule.targetRoleIds)),
    ]);
    const content = roleIds.map((id) => `<@&${id}>`).join(' ');
    if (!content) return;

    const channelId = rules.find((rule) => rule.targetChannelId)?.targetChannelId ?? ticket.category.channelId;
    if (!channelId) return;
    const channel = await guild.channels.fetch(channelId).catch(() => null);
    if (!isTextSendable(channel)) return;
    await channel.send({
        content,
        allowedMentions: { roles: roleIds },
        components: [
            new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                    .setCustomId(`tk_claim:${ticket.id}`)
                    .setLabel('Claim ticket')
                    .setStyle(ButtonStyle.Primary),
            ),
        ],
    }).catch(() => null);
}

export function memberHasTicketAdminAccess(member: GuildMember) {
    return member.guild.ownerId === member.id || member.permissions.has('Administrator') || member.permissions.has('ManageGuild');
}
