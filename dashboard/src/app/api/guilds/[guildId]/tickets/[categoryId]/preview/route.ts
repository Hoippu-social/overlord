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
    { params }: { params: Promise<{ guildId: string; categoryId: string }> },
) {
    try {
        const { guildId, categoryId } = await params;
        const auth = await authorizeGuildApiRequest(request, guildId, { live: true });
        if (isGuildApiAuthFailure(auth)) {
            return auth.response;
        }

        const catId = parseInt(categoryId, 10);
        if (!Number.isInteger(catId) || catId === -1) {
            return NextResponse.json({ error: 'Invalid category' }, { status: 400 });
        }

        const body = await request.json() as { messageDesignJson?: string; channelId?: string | null };
        const botRes = await fetch(`${BOT_API_URL}/api/tickets/preview-panel`, {
            method: 'POST',
            headers: buildHeaders(),
            body: JSON.stringify({
                guildId,
                categoryId: catId,
                channelId: body.channelId ?? null,
                messageDesignJson: body.messageDesignJson ?? null,
            }),
        });

        const data = await botRes.json() as { ok: boolean; messageId?: string; channelId?: string; error?: string };
        if (!botRes.ok || !data.ok || !data.messageId || !data.channelId) {
            return NextResponse.json({ error: data.error || 'Failed to send preview' }, { status: 502 });
        }

        return NextResponse.json({ ok: true, messageId: data.messageId, channelId: data.channelId });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to send preview';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
