// Typed model for the Discord-first ticket operations workspace.
// These types describe the SaaS control surface the dashboard renders. The
// operational side (inbox, transfers, SLA, audit) is served through the live
// ticket API adapter in `api.ts`.

import type { DiscordChannelRef, DiscordEmojiRef } from '@/lib/economy/types';

export type TicketStatus =
    | 'open'
    | 'waiting_support'
    | 'waiting_user'
    | 'on_hold'
    | 'escalated'
    | 'closed';

export type SlaState = 'healthy' | 'due_soon' | 'overdue' | 'paused';

export type TransferStatus = 'none' | 'pending' | 'confirmed' | 'declined';

export type ThreadBehavior = 'channel' | 'public_thread' | 'private_thread';

export type IntakeFieldType = 'short' | 'paragraph' | 'number' | 'select';

export type PermissionRoleKey = 'support_admin' | 'support_agent' | 'category_owner' | 'viewer';

export type QuickFilterKey =
    | 'open'
    | 'mine'
    | 'unassigned'
    | 'waiting_user'
    | 'waiting_support'
    | 'overdue'
    | 'escalated';

export type InboxSortKey = 'priority' | 'sla' | 'last_activity';

export interface DiscordRoleRef {
    id: string;
    name: string;
    color?: string | number | null;
}

export interface Agent {
    id: string;
    name: string;
    avatar?: string | null;
    roleLabel?: string;
    /** Currently assigned, still-open tickets. */
    activeTickets: number;
    /** Soft capacity used to render load bars. */
    capacity: number;
}

export interface PriorityDef {
    id: string;
    key?: string;
    name: string;
    /** Admin-chosen indicator color (hex). Priorities are never hard-coded in UI. */
    color: string;
    /** Response/resolution target in minutes, drives SLA state. */
    slaMinutes: number;
    /** Canonical duration in seconds; preserves sub-minute SLA targets. */
    slaSeconds: number;
    /** Auto-escalate after N minutes past SLA; null disables. */
    escalateAfterMinutes: number | null;
    /** Canonical escalation target in seconds; null disables escalation. */
    escalateAfterSeconds: number | null;
    /** Roles pinged when a ticket of this priority appears. */
    notifyRoleIds: string[];
    order: number;
    enabled?: boolean;
    isDefault?: boolean;
    /** True for the base templates (Low/Normal/High/Urgent). */
    system: boolean;
    /** Optional automation switches attached to the priority. */
    automation: {
        autoAssign: boolean;
        lockOnResolve: boolean;
        pageOnBreach: boolean;
    };
}

export interface IntakeField {
    id: string;
    label: string;
    type: IntakeFieldType;
    required: boolean;
    options?: string[];
}

export type TicketEntryPresentation = 'button' | 'select' | 'both';
export type TicketButtonStyle = 'PRIMARY' | 'SECONDARY' | 'SUCCESS' | 'DANGER';

export interface TicketEntryPoint {
    id: string;
    sourceId?: number;
    label: string;
    description?: string | null;
    emoji?: string | null;
    style: TicketButtonStyle;
    presentation: TicketEntryPresentation;
    fields: IntakeField[];
}

export interface TicketGhostReply {
    id: string;
    sourceId?: number;
    label: string;
    description?: string | null;
    emoji?: string | null;
    response: string;
}

export interface TicketCategoryDef {
    id: string;
    name: string;
    emoji?: string | null;
    description?: string | null;
    defaultPriorityId: string;
    /** Role/template that owns the queue by default (e.g. Reports → Mod). */
    defaultOwnerRoleId?: string | null;
    discordChannelId?: string | null;
    discordChannelName?: string | null;
    threadBehavior: ThreadBehavior;
    intakeFields: IntakeField[];
    /** User-facing entry controls. Each entry owns its Discord modal fields. */
    entryPoints: TicketEntryPoint[];
    /** FAQ responses delivered ephemerally without opening a ticket. */
    ghostReplies: TicketGhostReply[];
    openCount: number;
    totalCount: number;
    /** Category is published in the shared panel but configured elsewhere. */
    systemManagedBy?: 'appeals' | null;
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
    buttonStyle?: string | null;
    closeAction?: string | null;
    autoDeleteHours?: number | null;
    nameTemplate?: string | null;
    assignedTemplateId?: number | null;
    routingNotifyRoleIds?: string[];
}

export interface TicketRef {
    channelId?: string | null;
    channelName?: string | null;
    threadId?: string | null;
    threadName?: string | null;
    messageId?: string | null;
    url?: string | null;
}

export interface TransferState {
    status: TransferStatus;
    requestId?: number | null;
    fromAgentId?: string | null;
    toAgentId?: string | null;
    requestedAt?: string | null;
    note?: string | null;
}

export type TimelineKind =
    | 'created'
    | 'assigned'
    | 'transfer_requested'
    | 'transfer_confirmed'
    | 'status_changed'
    | 'priority_changed'
    | 'escalated'
    | 'note'
    | 'user_reply'
    | 'support_reply'
    | 'closed';

export interface TimelineEvent {
    id: string;
    at: string;
    kind: TimelineKind;
    actor?: string;
    summary: string;
}

export interface InternalNote {
    id: string;
    at: string;
    author: string;
    body: string;
}

export interface AuditEntry {
    id: string;
    at: string;
    actor: string;
    action: string;
    detail?: string;
}

export interface Ticket {
    id: string;
    code: string;
    subject: string;
    requester: {
        id: string;
        name: string;
        avatar?: string | null;
    };
    categoryId: string;
    priorityId: string;
    status: TicketStatus;
    assigneeId?: string | null;
    transfer: TransferState;
    sla: {
        state: SlaState;
        /** ISO deadline; absent when paused/closed. */
        dueAt?: string | null;
        /** Minutes until (or, when negative, past) the deadline. */
        remainingMinutes?: number;
    };
    createdAt: string;
    lastActivityAt: string;
    ref: TicketRef;
    /** Support hasn't seen the latest user message. */
    unreadForSupport?: boolean;
    tags?: string[];
    timeline: TimelineEvent[];
    notes: InternalNote[];
    audit: AuditEntry[];
}

export interface NotificationRule {
    id: string;
    priorityId: string;
    roleIds: string[];
    channelId?: string | null;
    enabled: boolean;
    events: Array<'created' | 'escalated' | 'overdue' | 'transfer'>;
}

export interface PermissionAssignment {
    role: PermissionRoleKey;
    discordRoleIds: string[];
}

export interface TicketsWorkspaceData {
    currentAgentId: string | null;
    agents: Agent[];
    priorities: PriorityDef[];
    categories: TicketCategoryDef[];
    tickets: Ticket[];
    notificationRules: NotificationRule[];
    permissions: PermissionAssignment[];
    roles: DiscordRoleRef[];
    channels: DiscordChannelRef[];
    serverEmojis: DiscordEmojiRef[];
}
