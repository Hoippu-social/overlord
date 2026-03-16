import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthToken } from '@/lib/auth';
import { canAccessGuild } from '@/lib/discordAccess';

const DASHBOARD_API_PORT = Number.parseInt(process.env.DASHBOARD_API_PORT || '3002', 10);
const DASHBOARD_API_KEY = process.env.DASHBOARD_API_KEY || '';

type EnrichedUser = {
    id: string;
    name: string;
    username: string;
    tag: string;
    avatar: string | null;
    globalName?: string | null;
};

type CaseResolution = {
    type: string | null;
    actorUserId: string | null;
    reason: string | null;
    resolvedAt: string | null;
};

const parseMetadata = (value: string | null) => {
    if (!value) {
        return null;
    }

    try {
        const parsed = JSON.parse(value);
        return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
        return null;
    }
};

const parseResolution = (metadata: Record<string, unknown> | null): CaseResolution | null => {
    if (!metadata) {
        return null;
    }

    const resolution = metadata.resolution;
    if (!resolution || typeof resolution !== 'object' || Array.isArray(resolution)) {
        return null;
    }

    const parsed = resolution as Record<string, unknown>;
    return {
        type: typeof parsed.type === 'string' ? parsed.type : null,
        actorUserId: typeof parsed.actorUserId === 'string' ? parsed.actorUserId : null,
        reason: typeof parsed.reason === 'string' ? parsed.reason : null,
        resolvedAt: typeof parsed.resolvedAt === 'string' ? parsed.resolvedAt : null,
    };
};

async function fetchEnrichedUsers(guildId: string, userIds: string[]) {
    if (!userIds.length) {
        return new Map<string, EnrichedUser>();
    }

    try {
        const response = await fetch(`http://127.0.0.1:${DASHBOARD_API_PORT}/api/enrich`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(DASHBOARD_API_KEY ? { 'x-dashboard-key': DASHBOARD_API_KEY } : {}),
            },
            body: JSON.stringify({ guildId, userIds, channelIds: [] }),
            cache: 'no-store',
        });

        if (!response.ok) {
            return new Map<string, EnrichedUser>();
        }

        const data = await response.json();
        const users = data?.users && typeof data.users === 'object' ? data.users : {};

        return new Map<string, EnrichedUser>(
            Object.entries(users).filter((entry): entry is [string, EnrichedUser] => Boolean(entry[0]) && Boolean(entry[1])),
        );
    } catch {
        return new Map<string, EnrichedUser>();
    }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ guildId: string }> }) {
    try {
        const token = await getAuthToken(request);
        const accessToken = typeof token?.accessToken === 'string' ? token.accessToken : null;
        if (!accessToken) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { guildId } = await params;
        const allowedGuilds = Array.isArray(token?.allowedGuilds) ? token.allowedGuilds : null;
        const hasAccess = allowedGuilds ? allowedGuilds.includes(guildId) : await canAccessGuild(accessToken, guildId);
        if (!hasAccess) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const targetUserId = request.nextUrl.searchParams.get('targetUserId');
        const actorUserId = request.nextUrl.searchParams.get('actorUserId');
        const actionType = request.nextUrl.searchParams.get('actionType');
        const status = request.nextUrl.searchParams.get('status');
        const source = request.nextUrl.searchParams.get('source');
        const caseNumber = Number(request.nextUrl.searchParams.get('caseNumber') ?? 0);
        const query = request.nextUrl.searchParams.get('q')?.trim();
        const limit = Math.min(Math.max(Number(request.nextUrl.searchParams.get('limit') ?? 25) || 25, 1), 100);

        const cases = await prisma.moderationCase.findMany({
            where: {
                guildId,
                ...(targetUserId ? { targetUserId } : {}),
                ...(actorUserId ? { actorUserId } : {}),
                ...(actionType ? { actionType } : {}),
                ...(status ? { status } : {}),
                ...(source ? { source } : {}),
                ...(Number.isInteger(caseNumber) && caseNumber > 0 ? { caseNumber } : {}),
                ...(query
                    ? {
                        OR: [
                            { targetUserId: { contains: query } },
                            { actorUserId: { contains: query } },
                            { actionType: { contains: query } },
                            { status: { contains: query } },
                            { source: { contains: query } },
                            { reason: { contains: query } },
                        ],
                    }
                    : {}),
            },
            orderBy: [{ createdAt: 'desc' }, { caseNumber: 'desc' }],
            take: limit,
            include: {
                notes: {
                    orderBy: { createdAt: 'desc' },
                    take: 3,
                },
            },
        });
        const normalizedCases = cases.map((row) => {
            const metadata = parseMetadata(row.metadata);
            return {
                row,
                metadata,
                resolution: parseResolution(metadata),
            };
        });

        const relatedIds = Array.from(new Set(normalizedCases.map(({ row }) => row.relatedCaseId).filter((value): value is number => typeof value === 'number')));
        const caseIds = normalizedCases.map(({ row }) => row.id);
        const relatedCases = relatedIds.length
            ? await prisma.moderationCase.findMany({
                where: {
                    id: { in: relatedIds },
                },
                select: {
                    id: true,
                    caseNumber: true,
                    actionType: true,
                    status: true,
                },
            })
            : [];
        const linkedChildCases = caseIds.length
            ? await prisma.moderationCase.findMany({
                where: {
                    relatedCaseId: { in: caseIds },
                },
                select: {
                    id: true,
                    caseNumber: true,
                    actionType: true,
                    status: true,
                    source: true,
                    targetUserId: true,
                    actorUserId: true,
                    createdAt: true,
                    relatedCaseId: true,
                },
                orderBy: [{ createdAt: 'desc' }, { caseNumber: 'desc' }],
            })
            : [];
        const relatedCaseMap = new Map(relatedCases.map((row) => [row.id, row]));
        const linkedChildMap = new Map<number, typeof linkedChildCases>();
        for (const row of linkedChildCases) {
            if (!row.relatedCaseId) continue;
            const existing = linkedChildMap.get(row.relatedCaseId) ?? [];
            existing.push(row);
            linkedChildMap.set(row.relatedCaseId, existing);
        }

        const userIds = Array.from(new Set([
            ...normalizedCases.map(({ row }) => row.targetUserId),
            ...normalizedCases.map(({ row }) => row.actorUserId).filter((value): value is string => Boolean(value)),
            ...normalizedCases.map(({ resolution }) => resolution?.actorUserId).filter((value): value is string => Boolean(value)),
            ...normalizedCases.flatMap(({ row }) => row.notes.map((note) => note.actorUserId)).filter(Boolean),
            ...linkedChildCases.map((row) => row.targetUserId),
            ...linkedChildCases.map((row) => row.actorUserId).filter((value): value is string => Boolean(value)),
        ]));
        const enrichedUsers = await fetchEnrichedUsers(guildId, userIds);

        const summary = {
            total: normalizedCases.length,
            active: normalizedCases.filter(({ row }) => row.status === 'ACTIVE').length,
            warnings: normalizedCases.filter(({ row }) => row.actionType === 'WARN' && row.status === 'ACTIVE').length,
            timed: normalizedCases.filter(({ row }) => row.expiresAt !== null && row.status === 'ACTIVE').length,
        };

        return NextResponse.json({
            summary,
            cases: normalizedCases.map(({ row, metadata, resolution }) => ({
                ...row,
                actorProfile: row.actorUserId ? enrichedUsers.get(row.actorUserId) ?? null : null,
                targetProfile: enrichedUsers.get(row.targetUserId) ?? null,
                metadata,
                resolutionType: resolution?.type ?? null,
                resolvedByUserId: resolution?.actorUserId ?? null,
                resolvedByProfile: resolution?.actorUserId ? enrichedUsers.get(resolution.actorUserId) ?? null : null,
                resolvedAt: resolution?.resolvedAt ?? null,
                resolutionReason: resolution?.reason ?? null,
                relatedCase:
                    row.relatedCaseId && relatedCaseMap.has(row.relatedCaseId)
                        ? relatedCaseMap.get(row.relatedCaseId)
                        : null,
                linkedCases: (linkedChildMap.get(row.id) ?? []).map((linkedCase) => ({
                    ...linkedCase,
                    actorProfile: linkedCase.actorUserId ? enrichedUsers.get(linkedCase.actorUserId) ?? null : null,
                    targetProfile: enrichedUsers.get(linkedCase.targetUserId) ?? null,
                })),
                notes: row.notes.map((note) => ({
                    ...note,
                    actorProfile: enrichedUsers.get(note.actorUserId) ?? null,
                })),
            })),
        });
    } catch (error) {
        console.error('Failed to load moderation cases:', error);
        return NextResponse.json({ error: 'Failed to load moderation cases.' }, { status: 500 });
    }
}
