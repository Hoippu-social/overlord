import type {
    Agent,
    PriorityDef,
    QuickFilterKey,
    Ticket,
    TicketCategoryDef,
    TicketsWorkspaceData,
} from './types';

export const OPEN_STATUSES: Ticket['status'][] = ['open', 'waiting_support', 'waiting_user', 'on_hold', 'escalated'];

export function isOpen(ticket: Ticket): boolean {
    return ticket.status !== 'closed';
}

export function matchesQuickFilter(ticket: Ticket, filter: QuickFilterKey, currentAgentId?: string | null): boolean {
    switch (filter) {
        case 'open':
            return isOpen(ticket);
        case 'mine':
            return Boolean(currentAgentId) && ticket.assigneeId === currentAgentId && isOpen(ticket);
        case 'unassigned':
            return !ticket.assigneeId && isOpen(ticket);
        case 'waiting_user':
            return ticket.status === 'waiting_user';
        case 'waiting_support':
            return ticket.status === 'waiting_support';
        case 'overdue':
            return ticket.sla.state === 'overdue';
        case 'escalated':
            return ticket.status === 'escalated';
        default:
            return true;
    }
}

export function lookups(data: TicketsWorkspaceData) {
    return {
        priorityById: new Map<string, PriorityDef>(data.priorities.map((p) => [p.id, p])),
        categoryById: new Map<string, TicketCategoryDef>(data.categories.map((c) => [c.id, c])),
        agentById: new Map<string, Agent>(data.agents.map((a) => [a.id, a])),
        roleById: new Map(data.roles.map((r) => [r.id, r])),
    };
}

export interface OverviewMetrics {
    openNow: number;
    escalated: number;
    overdue: number;
    unassigned: number;
    withinSla: number;
    breached: number;
    slaHealthPct: number;
    byCategory: Array<{ category: TicketCategoryDef; count: number }>;
    byPriority: Array<{ priority: PriorityDef; count: number }>;
    load: Array<{ agent: Agent; count: number }>;
    pendingTransfers: Ticket[];
}

export function computeOverview(data: TicketsWorkspaceData): OverviewMetrics {
    const open = data.tickets.filter(isOpen);
    const { priorityById, categoryById, agentById } = lookups(data);

    const overdue = open.filter((t) => t.sla.state === 'overdue').length;
    const trackedSla = open.filter((t) => t.sla.state !== 'paused');
    const breached = trackedSla.filter((t) => t.sla.state === 'overdue').length;
    const withinSla = trackedSla.length - breached;
    const slaHealthPct = trackedSla.length > 0 ? Math.round((withinSla / trackedSla.length) * 100) : 100;

    const byCategory = data.categories
        .map((category) => ({ category, count: open.filter((t) => t.categoryId === category.id).length }))
        .sort((a, b) => b.count - a.count);

    const byPriority = [...data.priorities]
        .sort((a, b) => b.order - a.order)
        .map((priority) => ({ priority, count: open.filter((t) => t.priorityId === priority.id).length }));

    const load = data.agents
        .map((agent) => ({ agent, count: open.filter((t) => t.assigneeId === agent.id).length }))
        .sort((a, b) => b.count - a.count);

    // Keep referenced maps meaningful for callers that reuse this module.
    void priorityById;
    void categoryById;
    void agentById;

    return {
        openNow: open.length,
        escalated: open.filter((t) => t.status === 'escalated').length,
        overdue,
        unassigned: open.filter((t) => !t.assigneeId).length,
        withinSla,
        breached,
        slaHealthPct,
        byCategory,
        byPriority,
        load,
        pendingTransfers: data.tickets.filter((t) => t.transfer.status === 'pending'),
    };
}
