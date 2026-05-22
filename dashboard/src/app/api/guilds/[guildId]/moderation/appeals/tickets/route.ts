import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthToken } from '@/lib/auth';
import { canAccessGuild } from '@/lib/discordAccess';

type AppealEventRecord = {
    id: number;
    ticketId: number;
    eventType: string;
    actorUserId: string | null;
    note: string | null;
    payload: string | null;
    createdAt: Date;
};

function parseEventPayload(payload: string | null) {
    if (!payload) return null;
    try {
        return JSON.parse(payload) as Record<string, unknown>;
    } catch {
        return null;
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

        const status = request.nextUrl.searchParams.get('status');
        const moderationActorUserId = request.nextUrl.searchParams.get('moderationActorUserId');
        const limit = Math.min(Math.max(Number(request.nextUrl.searchParams.get('limit') ?? 25) || 25, 1), 100);

        const tickets = await prisma.appealTicket.findMany({
            where: {
                guildId,
                ...(status ? { status } : {}),
                ...(moderationActorUserId
                    ? {
                        moderationCase: {
                            actorUserId: moderationActorUserId,
                        },
                    }
                    : {}),
            },
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            take: limit,
            include: {
                moderationCase: {
                    select: {
                        id: true,
                        caseNumber: true,
                        actionType: true,
                        status: true,
                        targetUserId: true,
                        actorUserId: true,
                    },
                },
            },
        });

        const ticketIds = tickets.map((ticket) => ticket.id);
        let rawEvents: AppealEventRecord[] = [];
        if (ticketIds.length) {
            try {
                rawEvents = await prisma.$queryRawUnsafe<AppealEventRecord[]>(
                    `SELECT "id", "ticketId", "eventType", "actorUserId", "note", "payload", "createdAt"
                     FROM "AppealEvent"
                     WHERE "ticketId" IN (${ticketIds.map(() => '?').join(', ')})
                     ORDER BY "createdAt" DESC, "id" DESC`,
                    ...ticketIds,
                );
            } catch {
                rawEvents = [];
            }
        }
        const eventsByTicketId = new Map<number, AppealEventRecord[]>();
        for (const event of rawEvents) {
            const current = eventsByTicketId.get(event.ticketId) ?? [];
            current.push(event);
            eventsByTicketId.set(event.ticketId, current);
        }
        const ticketsWithEvents = tickets.map((ticket) => ({
            ...ticket,
            events: (eventsByTicketId.get(ticket.id) ?? []).map((event) => ({
                id: event.id,
                ticketId: event.ticketId,
                eventType: event.eventType,
                actorUserId: event.actorUserId,
                note: event.note,
                payload: parseEventPayload(event.payload),
                createdAt: event.createdAt,
            })),
        }));

        return NextResponse.json({
            summary: {
                total: tickets.length,
                open: tickets.filter((ticket) => ticket.status === 'OPEN').length,
                inReview: tickets.filter((ticket) => ticket.status === 'IN_REVIEW').length,
                accepted: tickets.filter((ticket) => ticket.status === 'ACCEPTED' || ticket.status === 'PARDONED').length,
                rejected: tickets.filter((ticket) => ticket.status === 'REJECTED').length,
            },
            tickets: ticketsWithEvents,
        });
    } catch (error) {
        console.error('Failed to load appeal tickets:', error);
        return NextResponse.json({ error: 'Failed to load appeal tickets.' }, { status: 500 });
    }
}
