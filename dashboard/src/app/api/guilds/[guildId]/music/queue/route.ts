import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
const BOT_API_PORT = process.env.DASHBOARD_API_PORT || '3002';
const BOT_API_URL = process.env.DASHBOARD_API_URL || `http://127.0.0.1:${BOT_API_PORT}`;
const BOT_API_KEY = process.env.DASHBOARD_API_KEY || '';

export const dynamic = 'force-dynamic';

async function verifySession() {
    const session = (await cookies()).get('session');
    return session?.value ? true : false;
}

export async function GET(_request: Request, { params }: { params: Promise<{ guildId: string }> }) {
    if (!(await verifySession())) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { guildId } = await params;

    try {
        const res = await fetch(`${BOT_API_URL}/api/queue?guildId=${encodeURIComponent(guildId)}`, {
            headers: {
                ...(BOT_API_KEY ? { 'x-dashboard-key': BOT_API_KEY } : {}),
            },
        });

        const text = await res.text();
        if (!res.ok) {
            return NextResponse.json({ error: text || 'Failed to load queue' }, { status: res.status });
        }

        const payload = text ? JSON.parse(text) : {};
        return NextResponse.json(payload);
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to load queue';
        console.error('Failed to load queue via bot API:', error);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function POST(request: Request, { params }: { params: Promise<{ guildId: string }> }) {
    if (!(await verifySession())) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { guildId } = await params;
    const body = await request.json().catch(() => ({}));
    const encodedTrack = typeof body.encodedTrack === 'string' ? body.encodedTrack : '';
    const action = typeof body.action === 'string' ? body.action : '';

    if (!encodedTrack && !action) {
        return NextResponse.json({ error: 'encodedTrack or action is required' }, { status: 400 });
    }

    try {
        const res = await fetch(`${BOT_API_URL}/api/queue`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(BOT_API_KEY ? { 'x-dashboard-key': BOT_API_KEY } : {}),
            },
            body: JSON.stringify({ ...body, guildId, encodedTrack, action }),
        });

        const text = await res.text();
        if (!res.ok) {
            return NextResponse.json({ error: text || 'Failed to queue track' }, { status: res.status });
        }

        const payload = text ? JSON.parse(text) : {};
        return NextResponse.json(payload);
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to queue track';
        console.error('Failed to queue track via bot API:', error);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
