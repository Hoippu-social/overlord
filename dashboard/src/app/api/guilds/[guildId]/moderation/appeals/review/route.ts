import { NextRequest, NextResponse } from 'next/server';
import { getAuthToken } from '@/lib/auth';
import { authorizeGuildApiRequest, isGuildApiAuthFailure } from '@/lib/guildApiAuth';

const BOT_API_PORT = process.env.DASHBOARD_API_PORT || '3002';
const BOT_API_URL = process.env.DASHBOARD_API_URL || `http://127.0.0.1:${BOT_API_PORT}`;
const BOT_API_KEY = process.env.DASHBOARD_API_KEY || '';
const REVIEW_DECISIONS = new Set(['IN_REVIEW', 'ACCEPTED', 'REJECTED', 'PARDONED']);

export const dynamic = 'force-dynamic';

function buildHeaders() {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (BOT_API_KEY) headers['x-dashboard-key'] = BOT_API_KEY;
    return headers;
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ guildId: string }> }
) {
    try {
        const { guildId } = await params;
        const auth = await authorizeGuildApiRequest(request, guildId, { live: true });
        if (isGuildApiAuthFailure(auth)) {
            return auth.response;
        }
        const token = auth.token;

        const body = (await request.json().catch(() => ({}))) as {
            ticketId?: number;
            decision?: string;
            note?: string;
        };

        const ticketId = Number(body.ticketId);
        const decision = typeof body.decision === 'string' ? body.decision.trim().toUpperCase() : '';
        const note = typeof body.note === 'string' ? body.note : '';
        const reviewerId = typeof token?.sub === 'string' && token.sub.trim().length ? token.sub : 'dashboard-admin';

        if (!Number.isInteger(ticketId) || ticketId < 1 || !REVIEW_DECISIONS.has(decision)) {
            return NextResponse.json({ error: 'Invalid ticketId or decision.' }, { status: 400 });
        }

        const response = await fetch(`${BOT_API_URL}/api/appeals/review`, {
            method: 'POST',
            headers: buildHeaders(),
            body: JSON.stringify({
                guildId,
                ticketId,
                decision,
                note,
                reviewerId,
            }),
        });

        const payload = await response.json().catch(() => null);
        if (!response.ok) {
            return NextResponse.json(
                { error: payload?.error || `Bot API error ${response.status}` },
                { status: response.status }
            );
        }

        return NextResponse.json(payload);
    } catch (error) {
        console.error('Failed to review appeal ticket:', error);
        return NextResponse.json({ error: 'Failed to review appeal ticket.' }, { status: 500 });
    }
}
