import { NextRequest, NextResponse } from 'next/server';
import { authorizeTicketRequest, isTicketAuthFailure } from '@/lib/ticketAccess';

const BOT_API_PORT = process.env.DASHBOARD_API_PORT || '3002';
const BOT_API_URL = process.env.DASHBOARD_API_URL || `http://127.0.0.1:${BOT_API_PORT}`;
const BOT_API_KEY = process.env.DASHBOARD_API_KEY || '';

export const dynamic = 'force-dynamic';

type TicketActionBody = {
    action: string;
    reason?: string;
    priorityId?: number;
    toUserId?: string;
    note?: string;
    requestId?: number;
};

function buildHeaders() {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (BOT_API_KEY) headers['x-dashboard-key'] = BOT_API_KEY;
    return headers;
}

function resolveActionTarget(action: string) {
    if (action === 'close') return 'close';
    if (action === 'priority') return 'priority';
    if (action === 'transfer') return 'transfer';
    if (action === 'transfer_accept' || action === 'transfer_decline') return 'transfer/resolve';
    if (action === 'note') return 'note';
    return 'action';
}

function resolveRequiredPermission(action: string) {
    if (action === 'priority') return 'tickets.manage' as const;
    if (action === 'transfer' || action === 'transfer_accept' || action === 'transfer_decline') return 'tickets.transfer' as const;
    if (action === 'note') return 'tickets.note' as const;
    if (action === 'claim' || action === 'unclaim') return 'tickets.assign' as const;
    return 'tickets.manage' as const;
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ guildId: string; ticketId: string }> }
) {
    try {
        const { guildId, ticketId } = await params;
        const id = parseInt(ticketId);
        if (isNaN(id)) return NextResponse.json({ error: 'Invalid ticket ID' }, { status: 400 });

        const body = await request.json() as TicketActionBody;
        const auth = await authorizeTicketRequest(request, guildId, resolveRequiredPermission(body.action), { live: true });
        if (isTicketAuthFailure(auth)) return auth.response;

        const endpoint = resolveActionTarget(body.action);
        const payload = {
            guildId,
            ticketId: id,
            ...body,
            actorId: auth.actorId,
            fromUserId: auth.actorId,
            authorId: auth.actorId,
            accept: body.action === 'transfer_accept' ? true : body.action === 'transfer_decline' ? false : undefined,
        };
        const botRes = await fetch(`${BOT_API_URL}/api/tickets/${endpoint}`, {
            method: 'POST',
            headers: buildHeaders(),
            body: JSON.stringify(payload),
        });

        const data = await botRes.json() as { ok: boolean; error?: string };
        if (!botRes.ok || !data.ok) {
            return NextResponse.json({ error: data.error || 'Bot action failed' }, { status: 502 });
        }

        return NextResponse.json({ ok: true });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
