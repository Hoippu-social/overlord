import { NextRequest, NextResponse } from 'next/server';
import { authorizeGuildApiRequest, isGuildApiAuthFailure } from '@/lib/guildApiAuth';
import { fetchWithTimeout } from '@/lib/requestTimeout';

const BOT_API_PORT = process.env.DASHBOARD_API_PORT || '3002';
const BOT_API_URL = process.env.DASHBOARD_API_URL || `http://127.0.0.1:${BOT_API_PORT}`;
const BOT_API_KEY = process.env.DASHBOARD_API_KEY || '';

export const dynamic = 'force-dynamic';

type SearchUser = {
    id: string;
    name: string;
    username?: string | null;
    globalName?: string | null;
    tag?: string | null;
    avatar?: string | null;
    roleName?: string | null;
    roleColor?: number | string | null;
};

type SearchChannel = {
    id: string;
    name: string;
    type?: string | number | null;
    categoryName?: string | null;
};

const normalizeList = <T>(value: unknown): T[] => (Array.isArray(value) ? value as T[] : []);

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ guildId: string }> },
) {
    const { guildId } = await params;
    const auth = await authorizeGuildApiRequest(request, guildId);
    if (isGuildApiAuthFailure(auth)) {
        return auth.response;
    }

    const query = request.nextUrl.searchParams.get('q')?.trim() || '';
    const limit = Math.min(Math.max(Number(request.nextUrl.searchParams.get('limit') || 8) || 8, 1), 12);

    if (!query) {
        return NextResponse.json({ users: [], channels: [] });
    }

    const url = new URL(`${BOT_API_URL}/api/search`);
    url.searchParams.set('guildId', guildId);
    url.searchParams.set('q', query);
    url.searchParams.set('type', 'all');
    url.searchParams.set('limit', String(limit));

    const headers: Record<string, string> = {};
    if (BOT_API_KEY) {
        headers['x-dashboard-key'] = BOT_API_KEY;
    }

    try {
        const response = await fetchWithTimeout(url, { headers, cache: 'no-store' }, 4500, `Global search (${guildId})`);
        if (!response.ok) {
            return NextResponse.json({ users: [], channels: [] }, { status: response.status });
        }

        const data = await response.json() as { users?: unknown; channels?: unknown; results?: unknown };
        return NextResponse.json({
            users: normalizeList<SearchUser>(data.users),
            channels: normalizeList<SearchChannel>(data.channels),
        });
    } catch (error) {
        console.error('[GlobalSearch] Bot search failed:', error);
        return NextResponse.json({ users: [], channels: [] }, { status: 504 });
    }
}
