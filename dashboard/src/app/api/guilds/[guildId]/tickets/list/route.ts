import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorizeTicketRequest, isTicketAuthFailure } from '@/lib/ticketAccess';

export const dynamic = 'force-dynamic';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ guildId: string }> }
) {
    try {
        const { guildId } = await params;
        const auth = await authorizeTicketRequest(request, guildId, 'tickets.view');
        if (isTicketAuthFailure(auth)) return auth.response;

        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status') ?? undefined;
        const categoryId = searchParams.get('categoryId') ? parseInt(searchParams.get('categoryId')!) : undefined;
        const priorityId = searchParams.get('priorityId') ? parseInt(searchParams.get('priorityId')!) : undefined;
        const responsibleUserId = searchParams.get('responsibleUserId') || undefined;
        const transferState = searchParams.get('transferState') || undefined;
        const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
        const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '20')));

        const where = {
            guildId,
            ...(status ? { status } : {}),
            ...(categoryId ? { categoryId } : {}),
            ...(priorityId ? { priorityId } : {}),
            ...(responsibleUserId ? { responsibleUserId } : {}),
            ...(transferState ? { transferState } : {}),
        };

        const [tickets, total] = await Promise.all([
            prisma.ticket.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
                include: {
                    category: { select: { id: true, name: true } },
                    priority: { select: { id: true, key: true, name: true, color: true, sortOrder: true } },
                    transferRequests: {
                        where: { status: 'PENDING' },
                        orderBy: { requestedAt: 'desc' },
                        take: 1,
                    },
                },
            }),
            prisma.ticket.count({ where }),
        ]);

        return NextResponse.json({ tickets, total, page, limit });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to fetch tickets';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
