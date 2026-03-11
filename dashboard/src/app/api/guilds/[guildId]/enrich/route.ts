import { NextRequest, NextResponse } from 'next/server';

const BOT_API_PORT = process.env.DASHBOARD_API_PORT || '3002';
const BOT_API_URL = process.env.DASHBOARD_API_URL || `http://127.0.0.1:${BOT_API_PORT}`;
const BOT_API_KEY = process.env.DASHBOARD_API_KEY || '';

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ guildId: string }> }
) {
    const { guildId } = await params;

    try {
        const body = await request.json();

        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (BOT_API_KEY) headers['x-dashboard-key'] = BOT_API_KEY;

        const response = await fetch(`${BOT_API_URL}/api/enrich`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                guildId,
                userIds: body.userIds || [],
                channelIds: body.channelIds || []
            })
        });

        if (!response.ok) {
            return NextResponse.json({ ok: false, error: 'Bot API error' }, { status: response.status });
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error('[Enrich API] Error:', error);
        return NextResponse.json({ ok: false, error: 'Bot unavailable' }, { status: 503 });
    }
}
