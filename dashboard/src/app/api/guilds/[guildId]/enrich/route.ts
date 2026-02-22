import { NextRequest, NextResponse } from 'next/server';

const BOT_API_URL = process.env.BOT_API_URL || 'http://127.0.0.1:3002';

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ guildId: string }> }
) {
    const { guildId } = await params;

    try {
        const body = await request.json();

        const response = await fetch(`${BOT_API_URL}/api/enrich`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
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
