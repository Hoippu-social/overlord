import { NextRequest, NextResponse } from 'next/server';
import { getAuthToken } from '@/lib/auth';
import { canAccessGuild } from '@/lib/discordAccess';

const BOT_API_PORT = process.env.DASHBOARD_API_PORT || '3002';
const BOT_API_URL = process.env.DASHBOARD_API_URL || `http://127.0.0.1:${BOT_API_PORT}`;
const BOT_API_KEY = process.env.DASHBOARD_API_KEY || '';

export const dynamic = 'force-dynamic';

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

    const url = new URL(`${BOT_API_URL}/api/audit/events`);
    url.searchParams.set('guildId', guildId);

    // Proxy optional filters
    const search = new URL(request.url).searchParams;
    const tag = search.get('tag');
    const limit = search.get('limit');
    const beforeId = search.get('beforeId');

    if (tag) url.searchParams.set('tag', tag);
    if (limit) url.searchParams.set('limit', limit);
    if (beforeId) url.searchParams.set('beforeId', beforeId);

    const headers: Record<string, string> = {};
    if (BOT_API_KEY) headers['x-dashboard-key'] = BOT_API_KEY;

    const res = await fetch(url.toString(), { headers });

    if (!res.ok) {
        return NextResponse.json(
            { ok: false, error: `Bot API error ${res.status}` },
            { status: res.status }
        );
    }

    const data = await res.json();
    return NextResponse.json(data);
}
