import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { buildSearchIdentifier, searchLavalink } from '@/lib/lavalink';

export const dynamic = 'force-dynamic';

async function verifySession() {
    const session = (await cookies()).get('session');
    return session?.value ? true : false;
}

export async function GET(request: Request, { params }: { params: Promise<{ guildId: string }> }) {
    if (!(await verifySession())) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Await params to satisfy Next.js route signature (guildId is not used directly here)
    await params;

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
