import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorizeTicketRequest, isTicketAuthFailure } from '@/lib/ticketAccess';

export const dynamic = 'force-dynamic';

const DEFAULT_PRIORITIES = [
    { key: 'LOW', name: 'Low', color: '#64748b', sortOrder: 10, firstResponseMinutes: 1440, resolutionMinutes: 10080 },
    { key: 'NORMAL', name: 'Normal', color: '#22c55e', sortOrder: 20, firstResponseMinutes: 480, resolutionMinutes: 2880, isDefault: true },
    { key: 'HIGH', name: 'High', color: '#f59e0b', sortOrder: 30, firstResponseMinutes: 120, resolutionMinutes: 720 },
    { key: 'URGENT', name: 'Urgent', color: '#ef4444', sortOrder: 40, firstResponseMinutes: 30, resolutionMinutes: 240, forceNotify: true },
];

type PriorityInput = {
    id?: number;
    key: string;
    name: string;
    color?: string;
    sortOrder?: number;
    enabled?: boolean;
    isDefault?: boolean;
    firstResponseMinutes?: number | null;
    resolutionMinutes?: number | null;
    firstResponseSeconds?: number | null;
    resolutionSeconds?: number | null;
    notifyRoleIds?: string[] | string | null;
    escalationRoleIds?: string[] | string | null;
    forceNotify?: boolean;
    requiresReview?: boolean;
};

function normalizeJsonArray(value: unknown) {
    if (Array.isArray(value)) return JSON.stringify(value.filter((item) => typeof item === 'string'));
    if (typeof value === 'string') {
        try {
            const parsed = JSON.parse(value);
            return JSON.stringify(Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : []);
        } catch {
            return JSON.stringify(value.split(',').map((item) => item.trim()).filter(Boolean));
        }
    }
    return JSON.stringify([]);
}

async function ensurePriorities(guildId: string) {
    const existing = await prisma.ticketPriority.findMany({ where: { guildId }, orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] });
    if (existing.length > 0) return existing;

    await prisma.ticketPriority.createMany({
        data: DEFAULT_PRIORITIES.map((priority) => ({
            guildId,
            key: priority.key,
            name: priority.name,
            color: priority.color,
            sortOrder: priority.sortOrder,
            firstResponseMinutes: priority.firstResponseMinutes,
            resolutionMinutes: priority.resolutionMinutes,
            forceNotify: Boolean(priority.forceNotify),
            isDefault: Boolean(priority.isDefault),
        })),
        skipDuplicates: true,
    });

    return prisma.ticketPriority.findMany({ where: { guildId }, orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] });
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ guildId: string }> }) {
    try {
        const { guildId } = await params;
        const auth = await authorizeTicketRequest(request, guildId, 'tickets.view');
        if (isTicketAuthFailure(auth)) return auth.response;

        const priorities = await ensurePriorities(guildId);
        return NextResponse.json({ priorities });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to fetch priorities';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ guildId: string }> }) {
    try {
        const { guildId } = await params;
        const auth = await authorizeTicketRequest(request, guildId, 'tickets.config', { live: true });
        if (isTicketAuthFailure(auth)) return auth.response;

        const body = await request.json() as { priorities?: PriorityInput[] };
        const priorities = Array.isArray(body.priorities) ? body.priorities : [];
        if (!priorities.length) {
            return NextResponse.json({ error: 'At least one priority is required' }, { status: 400 });
        }

        const defaultCount = priorities.filter((priority) => priority.isDefault).length;
        if (defaultCount !== 1) {
            return NextResponse.json({ error: 'Exactly one default priority is required' }, { status: 400 });
        }

        const saved = [];
        for (const [index, priority] of priorities.entries()) {
            const data = {
                guildId,
                key: priority.key.trim().toUpperCase(),
                name: priority.name.trim(),
                color: priority.color ?? '#64748b',
                sortOrder: priority.sortOrder ?? (index + 1) * 10,
                enabled: priority.enabled ?? true,
                isDefault: priority.isDefault ?? false,
                firstResponseMinutes: priority.firstResponseMinutes ?? null,
                resolutionMinutes: priority.resolutionMinutes ?? null,
                firstResponseSeconds: priority.firstResponseSeconds ?? (priority.firstResponseMinutes === null || priority.firstResponseMinutes === undefined ? null : priority.firstResponseMinutes * 60),
                resolutionSeconds: priority.resolutionSeconds ?? (priority.resolutionMinutes === null || priority.resolutionMinutes === undefined ? null : priority.resolutionMinutes * 60),
                notifyRoleIds: normalizeJsonArray(priority.notifyRoleIds),
                escalationRoleIds: normalizeJsonArray(priority.escalationRoleIds),
                forceNotify: priority.forceNotify ?? false,
                requiresReview: priority.requiresReview ?? false,
            };

            if (!data.key || !data.name) {
                return NextResponse.json({ error: 'Priority key and name are required' }, { status: 400 });
            }

            saved.push(await prisma.ticketPriority.upsert({
                where: { guildId_key: { guildId, key: data.key } },
                update: data,
                create: data,
            }));
        }

        return NextResponse.json({ priorities: saved });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to save priorities';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
