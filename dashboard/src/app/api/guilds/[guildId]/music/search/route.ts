import { NextRequest, NextResponse } from 'next/server';
import { buildSearchIdentifier, searchLavalink } from '@/lib/lavalink';
import { getAuthToken } from '@/lib/auth';
import { canAccessGuild } from '@/lib/discordAccess';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ guildId: string }> }) {
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

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query')?.trim() || '';
    const platform = searchParams.get('platform') || undefined;

    if (!query) {
        return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    const identifier = buildSearchIdentifier(query, platform || undefined);
    if (!identifier) {
        return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    try {
        const result = await searchLavalink(identifier);
        const tracks = (result.tracks || []).map((track) => ({
            encoded: track.encoded,
            title: track.info?.title || 'Unknown',
            author: track.info?.author || null,
            uri: track.info?.uri || null,
            artworkUrl: track.info?.artworkUrl || null,
            durationMs: track.info?.length ?? track.info?.duration ?? null,
            sourceName: track.info?.sourceName || platform || null,
        }));

        return NextResponse.json({
            loadType: result.loadType,
            playlist: result.playlistInfo?.name || null,
            tracks,
        });
    } catch (error) {
        console.error('Lavalink search error:', error);
        return NextResponse.json({ error: 'Failed to search Lavalink' }, { status: 500 });
    }
}
