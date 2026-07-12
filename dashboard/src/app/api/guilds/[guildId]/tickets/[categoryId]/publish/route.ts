import { NextRequest, NextResponse } from 'next/server';
import { authorizeGuildApiRequest, isGuildApiAuthFailure } from '@/lib/guildApiAuth';

const BOT_API_PORT = process.env.DASHBOARD_API_PORT || '3002';
const BOT_API_URL = process.env.DASHBOARD_API_URL || `http://127.0.0.1:${BOT_API_PORT}`;
const BOT_API_KEY = process.env.DASHBOARD_API_KEY || '';

export const dynamic = 'force-dynamic';

function buildHeaders() {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (BOT_API_KEY) headers['x-dashboard-key'] = BOT_API_KEY;
    return headers;
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ guildId: string; categoryId: string }> }
) {
    try {
        const { guildId, categoryId } = await params;
        const auth = await authorizeGuildApiRequest(request, guildId, { live: true });
        if (isGuildApiAuthFailure(auth)) {
            return auth.response;
        }

        const catId = parseInt(categoryId);
        if (isNaN(catId) || catId === -1) {
            return NextResponse.json({ error: 'Invalid category' }, { status: 400 });
        }

        const botRes = await fetch(`${BOT_API_URL}/api/tickets/sync-panel`, {
            method: 'POST',
            headers: buildHeaders(),
            body: JSON.stringify({ guildId, categoryId: catId }),
        });

        const data = await botRes.json() as { ok: boolean; results?: { categoryId: number; state: string; error?: string }[]; error?: string };
        if (!botRes.ok || !data.ok) {
            return NextResponse.json({ error: data.error || 'Failed to sync panel' }, { status: 502 });
        }

        const result = data.results?.[0];
        return NextResponse.json({ ok: true, state: result?.state ?? 'unknown' });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to publish panel';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
