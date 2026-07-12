import type {
    Agent,
    DiscordRoleRef,
    IntakeField,
    IntakeFieldType,
    NotificationRule,
    PermissionAssignment,
    PermissionRoleKey,
    PriorityDef,
    SlaState,
    Ticket,
    TicketCategoryDef,
    TicketStatus,
    TicketsWorkspaceData,
    TimelineKind,
    TransferStatus,
} from './types';
import type { DiscordEmojiRef } from '@/lib/economy/types';
import {
    legacyFieldsFromDesign,
    parseTicketPanelMessageDesign,
    serializeTicketPanelMessageDesign,
} from './messageDesign';
import { parseCategoryFlow, serializeCategoryFlow, type RawTicketItem } from './categoryFlow';

type JsonObject = Record<string, unknown>;

type SessionStatus = {
    user: { id: string | null; name: string | null; image: string | null } | null;
    localOnly: boolean;
};

type RawRole = {
    id: string;
    name?: string;
    color?: string | number | null;
    position?: number | string;
};

type RawChannel = {
    id: string;
    name?: string;
    type?: string | number;
    parentId?: string | null;
};

type RawPriority = {
    id: number;
    key: string;
    name: string;
    color: string;
    sortOrder: number;
    enabled?: boolean;
    isDefault?: boolean;
    firstResponseMinutes?: number | null;
    resolutionMinutes?: number | null;
    firstResponseSeconds?: number | null;
    resolutionSeconds?: number | null;
    notifyRoleIds?: string | string[] | null;
    escalationRoleIds?: string | string[] | null;
    forceNotify?: boolean;
    requiresReview?: boolean;
};

type RawRoutingRule = {
    assignedRoleId?: string | null;
    assignedTemplateId?: number | null;
    defaultPriorityId?: number | null;
    notifyRoleIds?: string | string[] | null;
};

type RawForm = {
    id: number;
    label: string;
    type: string;
    required: boolean;
    placeholder?: string | null;
    options?: string[] | string | null;
};

type RawCategory = {
    id: number;
    name: string;
    channelId?: string | null;
    assignedRoleId?: string | null;
    assignedTemplateId?: number | null;
    defaultPriorityId?: number | null;
    saveHistory?: boolean;
    mentionAgents?: boolean;
    allowUserClose?: boolean;
    splitLogs?: boolean;
    enableRating?: boolean;
    agentRoles?: string | null;
    messageText?: string | null;
    messageEmbeds?: string | null;
    messageDesignJson?: string | null;
    buttonText?: string | null;
    buttonEmoji?: string | null;
    buttonStyle?: string | null;
    closeAction?: string | null;
    autoDeleteHours?: number | null;
    nameTemplate?: string | null;
    sortOrder?: number;
    systemManagedBy?: 'appeals' | null;
    systemCategoryKind?: string | null;
    routingRule?: RawRoutingRule | null;
    forms?: RawForm[];
    items?: RawTicketItem[];
    stats?: { total?: number; active?: number };
};

type RawTicket = {
    id: number;
    guildId: string;
    number: number;
    threadId?: string | null;
    categoryId: number;
    category?: { id: number; name: string } | null;
    authorId: string;
    claimedBy?: string | null;
    responsibleUserId?: string | null;
    previousResponsibleUserId?: string | null;
    transferState?: string | null;
    transferRequestedBy?: string | null;
    transferRequestedTo?: string | null;
    transferRequestedAt?: string | null;
    status: string;
    formAnswers?: string | null;
    closedBy?: string | null;
    closeReason?: string | null;
    lastActivityAt?: string | null;
    slaFirstResponseDueAt?: string | null;
    slaResolutionDueAt?: string | null;
    slaState?: string | null;
    tags?: string | string[] | null;
    transcriptToken?: string | null;
    createdAt: string;
    closedAt?: string | null;
    priorityId?: number | null;
    priority?: RawPriority | null;
    transferRequests?: RawTransferRequest[];
    internalNotes?: RawInternalNote[];
};

type RawTransferRequest = {
    id: number;
    fromUserId: string;
    toUserId: string;
    status: string;
    note?: string | null;
    requestedAt: string;
    expiresAt?: string | null;
};

type RawInternalNote = {
    id: number;
    authorId: string;
    body: string;
    createdAt: string;
};

type RawTicketEvent = {
    id: number;
    eventType: string;
    actorUserId?: string | null;
    note?: string | null;
    createdAt: string;
};

type RawNotificationRule = {
    id: number;
    categoryId?: number | null;
    priorityId?: number | null;
    eventType: string;
    targetRoleIds?: string | string[] | null;
    targetChannelId?: string | null;
    enabled?: boolean;
};

type RawAccessProfile = {
    id: number;
    name: string;
    roleIds?: string | string[] | null;
    permissions: string | string[];
    enabled?: boolean;
    sortOrder?: number;
};

type TicketsOverviewResponse = {
    categories?: RawCategory[];
    channels?: RawChannel[];
    priorities?: RawPriority[];
    accessProfiles?: RawAccessProfile[];
    notificationRules?: RawNotificationRule[];
};

type TicketsListResponse = {
    tickets: RawTicket[];
};

type TicketDetailResponse = {
    ticket: RawTicket;
    events: RawTicketEvent[];
    priorities?: RawPriority[];
    actorId?: string;
};

type PermissionResponse = {
    profiles: RawAccessProfile[];
};

const SYSTEM_PRIORITY_KEYS = new Set(['LOW', 'NORMAL', 'HIGH', 'URGENT']);
const WORKSPACE_FETCH_TIMEOUT_MS = 30_000;

const PERMISSION_PRESETS: Record<PermissionRoleKey, string[]> = {
    support_admin: ['tickets.view', 'tickets.reply', 'tickets.manage', 'tickets.assign', 'tickets.transfer', 'tickets.note', 'tickets.config'],
    support_agent: ['tickets.view', 'tickets.reply', 'tickets.assign', 'tickets.transfer', 'tickets.note'],
    category_owner: ['tickets.view', 'tickets.reply', 'tickets.assign', 'tickets.transfer', 'tickets.note'],
    viewer: ['tickets.view'],
};

const ROLE_LABELS: Record<PermissionRoleKey, string> = {
    support_admin: 'Support Admin',
    support_agent: 'Support Agent',
    category_owner: 'Category Owner',
    viewer: 'Viewer',
};

async function fetchJson<T>(url: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers);
    if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), WORKSPACE_FETCH_TIMEOUT_MS);

    let response: Response;
    try {
        response = await fetch(url, {
            ...init,
            headers,
            cache: 'no-store',
            signal: controller.signal,
        });
    } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
            throw new Error(`Request timed out: ${url}`);
        }
        throw error;
    } finally {
        window.clearTimeout(timeout);
    }

    const text = await response.text();
    const data = text ? JSON.parse(text) as JsonObject : {};

    if (!response.ok) {
        const message = typeof data.error === 'string' ? data.error : `Request failed: ${response.status}`;
        throw new Error(message);
    }

    return data as T;
}

function parseJsonArray(value: unknown): string[] {
    if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string');
    if (typeof value !== 'string' || !value.trim()) return [];
    try {
        const parsed = JSON.parse(value) as unknown;
        return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
    } catch {
        return value.split(',').map((item) => item.trim()).filter(Boolean);
    }
}

function toNumber(value: string): number | null {
    const parsed = Number(value);
    return Number.isInteger(parsed) ? parsed : null;
}

function roleColor(color: string | number | null | undefined): string | null {
    if (typeof color === 'number') return `#${color.toString(16).padStart(6, '0')}`;
    if (typeof color === 'string' && color.trim()) return color.startsWith('#') ? color : `#${color}`;
    return null;
}

function mapRole(role: RawRole): DiscordRoleRef {
    return {
        id: role.id,
        name: role.name || role.id,
        color: roleColor(role.color),
    };
}

function mapPriority(priority: RawPriority, index: number): PriorityDef {
    const responseSeconds = priority.firstResponseSeconds ?? (priority.firstResponseMinutes ?? priority.resolutionMinutes ?? 480) * 60;
    const escalationSeconds = priority.resolutionSeconds ?? (priority.resolutionMinutes === null || priority.resolutionMinutes === undefined ? null : priority.resolutionMinutes * 60);
    return {
        id: String(priority.id),
        key: priority.key,
        name: priority.name,
        color: priority.color || '#64748b',
        slaMinutes: Math.ceil(responseSeconds / 60),
        slaSeconds: responseSeconds,
        escalateAfterMinutes: escalationSeconds === null ? null : Math.ceil(escalationSeconds / 60),
        escalateAfterSeconds: escalationSeconds,
        notifyRoleIds: parseJsonArray(priority.notifyRoleIds),
        order: priority.sortOrder ?? index * 10,
        enabled: priority.enabled ?? true,
        isDefault: priority.isDefault ?? false,
        system: SYSTEM_PRIORITY_KEYS.has(priority.key),
        automation: {
            autoAssign: false,
            lockOnResolve: Boolean(priority.requiresReview),
            pageOnBreach: Boolean(priority.forceNotify),
        },
    };
}

function mapFieldType(type: string): IntakeFieldType {
    if (type === 'PARAGRAPH') return 'paragraph';
    if (type === 'NUMBER') return 'number';
    if (type === 'SELECT') return 'select';
    return 'short';
}

function toApiFieldType(type: IntakeFieldType): string {
    if (type === 'paragraph') return 'PARAGRAPH';
    if (type === 'number') return 'NUMBER';
    if (type === 'select') return 'SELECT';
    return 'TEXT';
}

function channelName(channels: RawChannel[], channelId?: string | null): string | null {
    if (!channelId) return null;
    return channels.find((channel) => channel.id === channelId)?.name ?? channelId;
}

function mapCategory(
    category: RawCategory,
    channels: RawChannel[],
    defaultPriorityId: string,
): TicketCategoryDef {
    const routing = category.routingRule ?? null;
    const ownerRoleId = routing?.assignedRoleId ?? category.assignedRoleId ?? null;
    const priorityId = routing?.defaultPriorityId ?? category.defaultPriorityId;
    const forms = Array.isArray(category.forms) ? category.forms : [];
    const messageDesign = parseTicketPanelMessageDesign(category.messageDesignJson, {
        name: category.name,
        messageText: category.messageText ?? null,
        messageEmbeds: category.messageEmbeds ?? null,
        buttonText: category.buttonText ?? null,
        buttonEmoji: category.buttonEmoji ?? null,
        buttonStyle: category.buttonStyle ?? null,
    });
    const legacyFields = legacyFieldsFromDesign(messageDesign);
    const intakeFields = forms.map((field): IntakeField => ({
        id: String(field.id),
        label: field.label,
        type: mapFieldType(field.type),
        required: field.required,
        options: parseJsonArray(field.options),
    }));
    const flow = parseCategoryFlow(category.items, {
        label: legacyFields.buttonText,
        emoji: legacyFields.buttonEmoji,
        style: legacyFields.buttonStyle,
        fields: intakeFields,
    });

    return {
        id: String(category.id),
        name: category.name,
        emoji: category.buttonEmoji ?? '🎫',
        description: legacyFields.messageText ?? category.messageText ?? null,
        defaultPriorityId: priorityId ? String(priorityId) : defaultPriorityId,
        defaultOwnerRoleId: ownerRoleId,
        discordChannelId: category.channelId ?? null,
        discordChannelName: channelName(channels, category.channelId),
        threadBehavior: category.splitLogs ? 'private_thread' : 'channel',
        intakeFields,
        entryPoints: flow.entryPoints,
        ghostReplies: flow.ghostReplies,
        openCount: category.stats?.active ?? 0,
        totalCount: category.stats?.total ?? 0,
        systemManagedBy: category.systemManagedBy ?? null,
        saveHistory: category.saveHistory ?? true,
        mentionAgents: category.mentionAgents ?? true,
        allowUserClose: category.allowUserClose ?? true,
        splitLogs: category.splitLogs ?? false,
        enableRating: category.enableRating ?? true,
        agentRoles: category.agentRoles ?? JSON.stringify(ownerRoleId ? [ownerRoleId] : []),
        messageText: legacyFields.messageText,
        messageEmbeds: legacyFields.messageEmbeds,
        messageDesignJson: serializeTicketPanelMessageDesign(messageDesign),
        buttonText: legacyFields.buttonText,
        buttonStyle: legacyFields.buttonStyle,
        closeAction: category.closeAction ?? 'ARCHIVE',
        autoDeleteHours: category.autoDeleteHours ?? null,
        nameTemplate: category.nameTemplate ?? 'ticket-{number}',
        assignedTemplateId: routing?.assignedTemplateId ?? category.assignedTemplateId ?? null,
        routingNotifyRoleIds: parseJsonArray(routing?.notifyRoleIds),
    };
}

function mapStatus(status: string, slaState?: string | null): TicketStatus {
    if (status === 'CLOSED') return 'closed';
    if (status === 'ON_HOLD') return 'on_hold';
    if (slaState === 'BREACHED') return 'escalated';
    return 'open';
}

function mapSlaState(state?: string | null, status?: string): SlaState {
    if (status === 'CLOSED') return 'paused';
    if (state === 'DUE_SOON') return 'due_soon';
    if (state === 'BREACHED') return 'overdue';
    if (state === 'PAUSED') return 'paused';
    return 'healthy';
}

function remainingMinutes(dueAt?: string | null): number | undefined {
    if (!dueAt) return undefined;
    return Math.round((new Date(dueAt).getTime() - Date.now()) / 60000);
}

function mapTransferStatus(state?: string | null, request?: RawTransferRequest): TransferStatus {
    if (request?.status === 'PENDING' || state === 'PENDING') return 'pending';
    if (request?.status === 'ACCEPTED' || state === 'ACCEPTED') return 'confirmed';
    if (request?.status === 'DECLINED' || state === 'DECLINED') return 'declined';
    return 'none';
}

function eventKind(eventType: string): TimelineKind {
    if (eventType.includes('TRANSFER')) return eventType.includes('CONFIRM') || eventType.includes('ACCEPT') ? 'transfer_confirmed' : 'transfer_requested';
    if (eventType.includes('PRIORITY')) return 'priority_changed';
    if (eventType.includes('ESCAL')) return 'escalated';
    if (eventType.includes('NOTE')) return 'note';
    if (eventType.includes('CLOSED')) return 'closed';
    if (eventType.includes('CLAIM') || eventType.includes('ASSIGN')) return 'assigned';
    return 'status_changed';
}

function eventSummary(event: RawTicketEvent): string {
    return event.note || event.eventType.replaceAll('_', ' ').toLowerCase();
}

function mapTicket(ticket: RawTicket, fallbackPriorityId: string): Ticket {
    const pendingTransfer = ticket.transferRequests?.find((request) => request.status === 'PENDING') ?? ticket.transferRequests?.[0];
    const assigneeId = ticket.responsibleUserId ?? ticket.claimedBy ?? null;
    const dueAt = ticket.slaResolutionDueAt ?? ticket.slaFirstResponseDueAt ?? null;
    const priorityId = ticket.priorityId ? String(ticket.priorityId) : fallbackPriorityId;

    return {
        id: String(ticket.id),
        code: `TCK-${ticket.number}`,
        subject: ticket.category?.name ? `${ticket.category.name} #${ticket.number}` : `Ticket #${ticket.number}`,
        requester: {
            id: ticket.authorId,
            name: ticket.authorId,
        },
        categoryId: String(ticket.categoryId),
        priorityId,
        status: mapStatus(ticket.status, ticket.slaState),
        assigneeId,
        transfer: {
            status: mapTransferStatus(ticket.transferState, pendingTransfer),
            requestId: pendingTransfer?.id ?? null,
            fromAgentId: pendingTransfer?.fromUserId ?? ticket.transferRequestedBy ?? null,
            toAgentId: pendingTransfer?.toUserId ?? ticket.transferRequestedTo ?? null,
            requestedAt: pendingTransfer?.requestedAt ?? ticket.transferRequestedAt ?? null,
            note: pendingTransfer?.note ?? null,
        },
        sla: {
            state: mapSlaState(ticket.slaState, ticket.status),
            dueAt,
            remainingMinutes: remainingMinutes(dueAt),
        },
        createdAt: ticket.createdAt,
        lastActivityAt: ticket.lastActivityAt ?? ticket.createdAt,
        ref: {
            threadId: ticket.threadId ?? null,
            threadName: ticket.threadId ? `ticket-${ticket.number}` : null,
            url: ticket.threadId ? `https://discord.com/channels/${ticket.guildId}/${ticket.threadId}` : null,
        },
        unreadForSupport: false,
        tags: parseJsonArray(ticket.tags),
        timeline: [],
        notes: (ticket.internalNotes ?? []).map((note) => ({
            id: String(note.id),
            at: note.createdAt,
            author: note.authorId,
            body: note.body,
        })),
        audit: [],
    };
}

function hydrateTicketDetail(ticket: RawTicket, events: RawTicketEvent[], fallbackPriorityId: string): Ticket {
    const mapped = mapTicket(ticket, fallbackPriorityId);
    const timeline = events.map((event) => ({
        id: String(event.id),
        at: event.createdAt,
        kind: eventKind(event.eventType),
        actor: event.actorUserId ?? undefined,
        summary: eventSummary(event),
    }));
    return {
        ...mapped,
        timeline,
        audit: events.map((event) => ({
            id: String(event.id),
            at: event.createdAt,
            actor: event.actorUserId ?? 'system',
            action: event.eventType,
            detail: event.note ?? undefined,
        })),
    };
}

function mapNotificationEvent(eventType: string): NotificationRule['events'][number] {
    if (eventType === 'PRIORITY_CHANGED') return 'escalated';
    if (eventType === 'SLA_BREACHED') return 'overdue';
    if (eventType === 'TRANSFER_REQUESTED') return 'transfer';
    return 'created';
}

function toApiNotificationEvent(event: NotificationRule['events'][number]): string {
    if (event === 'escalated') return 'PRIORITY_CHANGED';
    if (event === 'overdue') return 'SLA_BREACHED';
    if (event === 'transfer') return 'TRANSFER_REQUESTED';
    return 'CREATED';
}

function mapNotifications(rules: RawNotificationRule[], fallbackPriorityId: string): NotificationRule[] {
    return rules.map((rule) => ({
        id: String(rule.id),
        priorityId: rule.priorityId ? String(rule.priorityId) : fallbackPriorityId,
        roleIds: parseJsonArray(rule.targetRoleIds),
        channelId: rule.targetChannelId ?? null,
        enabled: rule.enabled ?? true,
        events: [mapNotificationEvent(rule.eventType)],
    }));
}

function classifyProfile(profile: RawAccessProfile): PermissionRoleKey {
    const name = profile.name.toLowerCase();
    const permissions = parseJsonArray(profile.permissions);
    if (name.includes('admin') || permissions.includes('tickets.config') || permissions.includes('*')) return 'support_admin';
    if (name.includes('owner')) return 'category_owner';
    if (name.includes('viewer') || (permissions.length === 1 && permissions.includes('tickets.view'))) return 'viewer';
    return 'support_agent';
}

function mapPermissions(profiles: RawAccessProfile[]): PermissionAssignment[] {
    const byRole = new Map<PermissionRoleKey, Set<string>>([
        ['support_admin', new Set()],
        ['support_agent', new Set()],
        ['category_owner', new Set()],
        ['viewer', new Set()],
    ]);

    for (const profile of profiles) {
        const role = classifyProfile(profile);
        const roleIds = parseJsonArray(profile.roleIds);
        const bucket = byRole.get(role);
        roleIds.forEach((id) => bucket?.add(id));
    }

    return [...byRole.entries()].map(([role, ids]) => ({
        role,
        discordRoleIds: [...ids],
    }));
}

function buildAgents(tickets: Ticket[], currentAgentId: string | null, currentAgentName: string | null): Agent[] {
    const ids = new Set<string>();
    if (currentAgentId) ids.add(currentAgentId);
    for (const ticket of tickets) {
        if (ticket.assigneeId) ids.add(ticket.assigneeId);
        if (ticket.transfer.fromAgentId) ids.add(ticket.transfer.fromAgentId);
        if (ticket.transfer.toAgentId) ids.add(ticket.transfer.toAgentId);
    }

    return [...ids].map((id) => ({
        id,
        name: id === currentAgentId ? (currentAgentName || id) : id,
        roleLabel: id === currentAgentId ? 'Current user' : undefined,
        activeTickets: tickets.filter((ticket) => ticket.assigneeId === id && ticket.status !== 'closed').length,
        capacity: 12,
    }));
}

function defaultPriorityId(priorities: PriorityDef[]): string {
    return priorities.find((priority) => priority.isDefault)?.id ?? priorities[0]?.id ?? '0';
}

async function loadCategoryDetails(guildId: string, categories: RawCategory[]): Promise<RawCategory[]> {
    return Promise.all(categories.map(async (category) => {
        if (category.id < 0 || category.systemManagedBy) return category;
        try {
            const detail = await fetchJson<{ category: RawCategory }>(`/api/guilds/${guildId}/tickets/${category.id}`);
            return { ...category, ...detail.category, stats: category.stats, routingRule: detail.category.routingRule ?? category.routingRule };
        } catch {
            return category;
        }
    }));
}

export async function loadTicketsWorkspace(guildId: string): Promise<TicketsWorkspaceData> {
    const [overview, list, rolesResponse, session, emojisResponse] = await Promise.all([
        fetchJson<TicketsOverviewResponse>(`/api/guilds/${guildId}/tickets`),
        fetchJson<TicketsListResponse>(`/api/guilds/${guildId}/tickets/list?limit=50`).catch((error) => {
            console.warn('Ticket inbox is temporarily unavailable; loading configuration without it.', error);
            return { tickets: [], total: 0, page: 1, limit: 50 };
        }),
        fetchJson<RawRole[]>(`/api/guilds/${guildId}/roles`).catch(() => []),
        fetchJson<SessionStatus>('/api/session-status').catch(() => ({ user: null, localOnly: false })),
        fetchJson<{ emojis: DiscordEmojiRef[] }>(`/api/guilds/${guildId}/emojis`).catch(() => ({ emojis: [] })),
    ]);

    const roles = rolesResponse.map(mapRole);
    const priorities = (overview.priorities ?? []).map(mapPriority).sort((left, right) => left.order - right.order);
    const fallbackPriorityId = defaultPriorityId(priorities);
    const categoryDetails = await loadCategoryDetails(guildId, overview.categories ?? []);
    const categories = categoryDetails.map((category) => mapCategory(category, overview.channels ?? [], fallbackPriorityId));
    const channels = (overview.channels ?? []).map((channel) => ({
        id: channel.id,
        name: channel.name || channel.id,
        type: channel.type,
        parentId: channel.parentId ?? null,
    }));
    const tickets = list.tickets.map((ticket) => mapTicket(ticket, fallbackPriorityId));
    const currentAgentId = session.user?.id ?? (session.localOnly ? 'dashboard-admin' : null);

    return {
        currentAgentId,
        agents: buildAgents(tickets, currentAgentId, session.user?.name ?? null),
        priorities,
        categories,
        tickets,
        notificationRules: mapNotifications(overview.notificationRules ?? [], fallbackPriorityId),
        permissions: mapPermissions(overview.accessProfiles ?? []),
        roles,
        channels,
        serverEmojis: emojisResponse.emojis,
    };
}

export async function loadTicketDetail(guildId: string, ticketId: string, fallbackPriorityId: string): Promise<Ticket> {
    const detail = await fetchJson<TicketDetailResponse>(`/api/guilds/${guildId}/tickets/items/${ticketId}`);
    return hydrateTicketDetail(detail.ticket, detail.events, fallbackPriorityId);
}

export async function runTicketAction(guildId: string, ticketId: string, body: JsonObject): Promise<void> {
    await fetchJson<{ ok: true }>(`/api/guilds/${guildId}/tickets/items/${ticketId}/action`, {
        method: 'POST',
        body: JSON.stringify(body),
    });
}

export async function sendTicketPanelPreview(
    guildId: string,
    categoryId: string,
    body: { messageDesignJson: string; channelId?: string | null },
): Promise<{ ok: true; messageId: string; channelId: string }> {
    return fetchJson<{ ok: true; messageId: string; channelId: string }>(`/api/guilds/${guildId}/tickets/${categoryId}/preview`, {
        method: 'POST',
        body: JSON.stringify(body),
    });
}

export async function saveTicketPriorities(guildId: string, priorities: PriorityDef[]): Promise<void> {
    const hasDefault = priorities.some((priority) => priority.isDefault);
    await fetchJson<{ priorities: RawPriority[] }>(`/api/guilds/${guildId}/tickets/priorities`, {
        method: 'PUT',
        body: JSON.stringify({
            priorities: priorities.map((priority, index) => ({
                id: toNumber(priority.id) ?? undefined,
                key: (priority.key || priority.name || `CUSTOM_${index + 1}`).trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_'),
                name: priority.name,
                color: priority.color,
                sortOrder: priority.order ?? index * 10,
                enabled: priority.enabled ?? true,
                isDefault: priority.isDefault ?? (!hasDefault && index === 0),
                firstResponseMinutes: priority.slaMinutes,
                resolutionMinutes: priority.escalateAfterMinutes,
                firstResponseSeconds: priority.slaSeconds,
                resolutionSeconds: priority.escalateAfterSeconds,
                notifyRoleIds: priority.notifyRoleIds,
                forceNotify: priority.automation.pageOnBreach,
                requiresReview: priority.automation.lockOnResolve,
            })),
        }),
    });
}

function categoryPayload(category: TicketCategoryDef, priorityFallback: string) {
    const ownerRoles = category.defaultOwnerRoleId ? [category.defaultOwnerRoleId] : parseJsonArray(category.agentRoles);
    const messageDesign = parseTicketPanelMessageDesign(category.messageDesignJson, {
        name: category.name,
        messageText: category.messageText ?? category.description ?? null,
        messageEmbeds: category.messageEmbeds ?? null,
        buttonText: category.buttonText ?? null,
        buttonEmoji: category.emoji ?? null,
        buttonStyle: category.buttonStyle ?? null,
    });
    const legacyFields = legacyFieldsFromDesign(messageDesign);

    return {
        name: category.name,
        channelId: category.discordChannelId ?? null,
        saveHistory: category.saveHistory ?? true,
        mentionAgents: category.mentionAgents ?? true,
        allowUserClose: category.allowUserClose ?? true,
        splitLogs: category.threadBehavior !== 'channel' || Boolean(category.splitLogs),
        enableRating: category.enableRating ?? true,
        agentRoles: JSON.stringify(ownerRoles),
        messageText: legacyFields.messageText,
        messageEmbeds: legacyFields.messageEmbeds,
        messageDesignJson: serializeTicketPanelMessageDesign(messageDesign),
        buttonText: legacyFields.buttonText,
        buttonEmoji: legacyFields.buttonEmoji,
        buttonStyle: legacyFields.buttonStyle,
        closeAction: category.closeAction ?? 'ARCHIVE',
        autoDeleteHours: category.autoDeleteHours ?? null,
        nameTemplate: category.nameTemplate ?? 'ticket-{number}',
        assignedRoleId: category.defaultOwnerRoleId ?? null,
        assignedTemplateId: category.assignedTemplateId ?? null,
        defaultPriorityId: toNumber(category.defaultPriorityId) ?? toNumber(priorityFallback),
        routingNotifyRoleIds: category.routingNotifyRoleIds ?? [],
        forms: (category.entryPoints[0]?.fields ?? category.intakeFields).slice(0, 5).map((field) => ({
            label: field.label,
            type: toApiFieldType(field.type),
            required: field.required,
            placeholder: null,
        })),
        items: serializeCategoryFlow(category.entryPoints, category.ghostReplies),
    };
}

export async function saveTicketCategories(guildId: string, next: TicketCategoryDef[], previous: TicketCategoryDef[], priorityFallback: string): Promise<void> {
    const nextIds = new Set(next.map((category) => toNumber(category.id)).filter((id): id is number => id !== null));
    const removedIds = previous
        .filter((category) => !category.systemManagedBy)
        .map((category) => toNumber(category.id))
        .filter((id): id is number => id !== null && !nextIds.has(id));

    await Promise.all(removedIds.map((id) => fetchJson<{ success: true }>(`/api/guilds/${guildId}/tickets/${id}`, { method: 'DELETE' })));

    for (const category of next) {
        if (category.systemManagedBy) continue;
        const existingId = toNumber(category.id);
        let id = existingId;
        if (!id) {
            const created = await fetchJson<{ category: { id: number } }>(`/api/guilds/${guildId}/tickets`, {
                method: 'POST',
                body: JSON.stringify({ name: category.name }),
            });
            id = created.category.id;
        }
        await fetchJson<{ success: true }>(`/api/guilds/${guildId}/tickets/${id}`, {
            method: 'PUT',
            body: JSON.stringify(categoryPayload(category, priorityFallback)),
        });
    }
}

export async function saveTicketNotifications(guildId: string, rules: NotificationRule[]): Promise<void> {
    await fetchJson<{ rules: RawNotificationRule[] }>(`/api/guilds/${guildId}/tickets/notifications`, {
        method: 'PUT',
        body: JSON.stringify({
            rules: rules.flatMap((rule) => rule.events.map((event) => ({
                id: toNumber(rule.id) ?? undefined,
                priorityId: toNumber(rule.priorityId),
                targetRoleIds: rule.roleIds,
                targetChannelId: rule.channelId ?? null,
                eventType: toApiNotificationEvent(event),
                enabled: rule.enabled,
            }))),
        }),
    });
}

export async function saveTicketPermissions(guildId: string, permissions: PermissionAssignment[]): Promise<void> {
    await fetchJson<PermissionResponse>(`/api/guilds/${guildId}/tickets/permissions`, {
        method: 'PUT',
        body: JSON.stringify({
            profiles: permissions.map((assignment, index) => ({
                name: ROLE_LABELS[assignment.role],
                roleIds: assignment.discordRoleIds,
                permissions: PERMISSION_PRESETS[assignment.role],
                dashboardHomeOnly: false,
                enabled: true,
                sortOrder: index * 10,
            })),
        }),
    });
}
