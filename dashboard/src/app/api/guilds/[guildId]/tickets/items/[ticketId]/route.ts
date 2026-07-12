import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorizeTicketRequest, isTicketAuthFailure } from '@/lib/ticketAccess';

export const dynamic = 'force-dynamic';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ guildId: string; ticketId: string }> }
) {
    try {
        const { guildId, ticketId } = await params;
        const auth = await authorizeTicketRequest(request, guildId, 'tickets.view');
        if (isTicketAuthFailure(auth)) return auth.response;

        const id = parseInt(ticketId);
        if (isNaN(id)) return NextResponse.json({ error: 'Invalid ticket ID' }, { status: 400 });

        const ticket = await prisma.ticket.findUnique({
            where: { id },
            include: {
                category: { select: { id: true, name: true } },
                guild: { select: { name: true } },
                priority: { select: { id: true, key: true, name: true, color: true, sortOrder: true } },
                transferRequests: { orderBy: { requestedAt: 'desc' }, take: 10 },
                internalNotes: { orderBy: { createdAt: 'desc' }, take: 25 },
            },
        });

        if (!ticket || ticket.guildId !== guildId) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }

        const events = await prisma.ticketEvent.findMany({
            where: { ticketId: id },
            orderBy: { createdAt: 'asc' },
        });

        const priorities = await prisma.ticketPriority.findMany({
            where: { guildId, enabled: true },
            orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
        });

        return NextResponse.json({ ticket, events, priorities, actorId: auth.actorId });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to fetch ticket';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
