import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthToken } from '@/lib/auth';
import { canAccessGuild } from '@/lib/discordAccess';

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
        const limit = Math.min(Math.max(Number(request.nextUrl.searchParams.get('limit') ?? 25) || 25, 1), 100);

        const tickets = await prisma.appealTicket.findMany({
            where: {
                guildId,
                ...(status ? { status } : {}),
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
                    },
                },
            },
        });

        return NextResponse.json({
            summary: {
                total: tickets.length,
                open: tickets.filter((ticket) => ticket.status === 'OPEN').length,
                inReview: tickets.filter((ticket) => ticket.status === 'IN_REVIEW').length,
                accepted: tickets.filter((ticket) => ticket.status === 'ACCEPTED' || ticket.status === 'PARDONED').length,
                rejected: tickets.filter((ticket) => ticket.status === 'REJECTED').length,
            },
            tickets,
        });
    } catch (error) {
        console.error('Failed to load appeal tickets:', error);
        return NextResponse.json({ error: 'Failed to load appeal tickets.' }, { status: 500 });
    }
}
