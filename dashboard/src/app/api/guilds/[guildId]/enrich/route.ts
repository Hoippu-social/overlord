import { NextRequest, NextResponse } from 'next/server';
import { getAuthToken } from '@/lib/auth';
import { canAccessGuild } from '@/lib/discordAccess';
import { fetchWithTimeout } from '@/lib/requestTimeout';

const BOT_API_PORT = process.env.DASHBOARD_API_PORT || '3002';
const BOT_API_URL = process.env.DASHBOARD_API_URL || `http://127.0.0.1:${BOT_API_PORT}`;
const BOT_API_KEY = process.env.DASHBOARD_API_KEY || '';

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ guildId: string }> }
) {
    const { guildId } = await params;
    const token = await getAuthToken(request);
    const accessToken = typeof token?.accessToken === 'string' ? token.accessToken : null;

    if (!accessToken) {
        return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const allowedGuilds = Array.isArray(token?.allowedGuilds) ? token.allowedGuilds : null;
    const hasAccess = allowedGuilds ? allowedGuilds.includes(guildId) : await canAccessGuild(accessToken, guildId);
    if (!hasAccess) {
        return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    }

    try {
        const body = await request.json();

        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (BOT_API_KEY) headers['x-dashboard-key'] = BOT_API_KEY;

        const response = await fetchWithTimeout(`${BOT_API_URL}/api/enrich`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                guildId,
                userIds: body.userIds || [],
                channelIds: body.channelIds || []
            })
        }, 4000, `Guild enrich (${guildId})`);

        if (!response.ok) {
            return NextResponse.json({ ok: false, error: 'Bot API error' }, { status: response.status });
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error('[Enrich API] Error:', error);
        return NextResponse.json({ ok: false, error: 'Bot unavailable' }, { status: 504 });
    }
}
