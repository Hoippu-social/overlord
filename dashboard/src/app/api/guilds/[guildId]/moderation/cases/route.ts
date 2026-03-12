import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthToken } from '@/lib/auth';
import { canAccessGuild } from '@/lib/discordAccess';

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
        const relatedIds = Array.from(new Set(cases.map((row) => row.relatedCaseId).filter((value): value is number => typeof value === 'number')));
        const caseIds = cases.map((row) => row.id);
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

        const summary = {
            total: cases.length,
            active: cases.filter((row) => row.status === 'ACTIVE').length,
            warnings: cases.filter((row) => row.actionType === 'WARN' && row.status === 'ACTIVE').length,
            timed: cases.filter((row) => row.expiresAt !== null && row.status === 'ACTIVE').length,
        };

        return NextResponse.json({
            summary,
            cases: cases.map((row) => ({
                ...row,
                metadata: parseMetadata(row.metadata),
                relatedCase:
                    row.relatedCaseId && relatedCaseMap.has(row.relatedCaseId)
                        ? relatedCaseMap.get(row.relatedCaseId)
                        : null,
                linkedCases: linkedChildMap.get(row.id) ?? [],
            })),
        });
    } catch (error) {
        console.error('Failed to load moderation cases:', error);
        return NextResponse.json({ error: 'Failed to load moderation cases.' }, { status: 500 });
    }
}
