import { NextRequest, NextResponse } from 'next/server';
import { getAuthToken } from '@/lib/auth';
import { canAccessGuild } from '@/lib/discordAccess';

const BOT_API_PORT = process.env.DASHBOARD_API_PORT || '3002';
const BOT_API_URL = process.env.DASHBOARD_API_URL || `http://127.0.0.1:${BOT_API_PORT}`;
const BOT_API_KEY = process.env.DASHBOARD_API_KEY || '';

export const dynamic = 'force-dynamic';

function buildHeaders() {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (BOT_API_KEY) headers['x-dashboard-key'] = BOT_API_KEY;
    return headers;
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ guildId: string }> }
) {
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

    const url = new URL(`${BOT_API_URL}/api/audit/routes`);
    url.searchParams.set('guildId', guildId);

    const res = await fetch(url.toString(), { headers: buildHeaders() });

    if (!res.ok) {
        return NextResponse.json(
            { ok: false, error: `Bot API error ${res.status}` },
            { status: res.status }
        );
    }

    const data = await res.json();
    return NextResponse.json(data);
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ guildId: string }> }
) {
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

    const body = await request.json();

    const res = await fetch(`${BOT_API_URL}/api/audit/routes?guildId=${encodeURIComponent(guildId)}`, {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        return NextResponse.json(
            { ok: false, error: `Bot API error ${res.status}` },
            { status: res.status }
        );
    }

    const data = await res.json();
    return NextResponse.json(data);
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ guildId: string }> }
) {
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

    const raw = await request.text();
    const body = raw ? JSON.parse(raw) : {};
    const tag = typeof body.tag === 'string' ? body.tag : undefined;
    const query = tag ? `?guildId=${encodeURIComponent(guildId)}&tag=${encodeURIComponent(tag)}` : `?guildId=${encodeURIComponent(guildId)}`;

    const res = await fetch(`${BOT_API_URL}/api/audit/routes${query}`, {
        method: 'DELETE',
        headers: buildHeaders(),
        body: !tag ? raw : undefined,
    });

    if (!res.ok) {
        return NextResponse.json(
            { ok: false, error: `Bot API error ${res.status}` },
            { status: res.status }
        );
    }

    const data = await res.json();
    return NextResponse.json(data);
}
