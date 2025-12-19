import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getPlayerFromLavalink } from '@/lib/lavalink';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

async function verifySession() {
    const session = (await cookies()).get('session');
    return session?.value ? true : false;
}

export async function GET(_req: Request, { params }: { params: Promise<{ guildId: string }> }) {
    if (!(await verifySession())) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { guildId } = await params;

    try {
        const player = await getPlayerFromLavalink(guildId);
        if (player?.track) {
            const info = player.track.info || {};
            const nowPlaying = {
                title: info.title || 'Unknown',
                author: info.author || null,
                uri: info.uri || null,
                artworkUrl: info.artworkUrl || null,
                durationMs: info.length ?? info.duration ?? null,
                positionMs: player.state?.position ?? player.state?.time ?? info.position ?? null,
                volume: typeof player.volume === 'number' ? player.volume : null,
                paused: !!player.paused,
                sourceName: info.sourceName || null,
            };

            return NextResponse.json({ nowPlaying, sessionId: player.sessionId });
        }
    } catch (error) {
        console.error('Failed to fetch Lavalink now playing:', error);
    }

    // Fallback to persisted state, so UI is not empty if Lavalink is unreachable
    try {
        const persisted = await prisma.musicNowPlaying.findUnique({ where: { guildId } });
        if (persisted) {
            return NextResponse.json({ nowPlaying: persisted, source: 'fallback' });
        }
    } catch (e) {
        console.error('Failed to load fallback now playing:', e);
    }

    return NextResponse.json({ nowPlaying: null });
}
