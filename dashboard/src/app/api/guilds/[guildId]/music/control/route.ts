import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { updatePlayerOnLavalink } from '@/lib/lavalink';

export const dynamic = 'force-dynamic';

async function verifySession() {
    const session = (await cookies()).get('session');
    return session?.value ? true : false;
}

type ControlBody = {
    paused?: boolean;
    volume?: number;
    positionMs?: number;
};

export async function POST(request: Request, { params }: { params: Promise<{ guildId: string }> }) {
    if (!(await verifySession())) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { guildId } = await params;
    const body = (await request.json().catch(() => ({}))) as ControlBody;

    const patch: any = {};

    if (typeof body.paused === 'boolean') {
        patch.paused = body.paused;
    }
    if (typeof body.volume === 'number' && Number.isFinite(body.volume)) {
        patch.volume = Math.max(0, Math.min(150, Math.round(body.volume)));
    }
    if (typeof body.positionMs === 'number' && Number.isFinite(body.positionMs)) {
        patch.position = Math.max(0, Math.round(body.positionMs));
    }

    if (!Object.keys(patch).length) {
        return NextResponse.json({ error: 'No valid fields provided' }, { status: 400 });
    }

    try {
        const player = await updatePlayerOnLavalink(guildId, patch);
        return NextResponse.json({ ok: true, player });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to update Lavalink player';
        console.error('Lavalink control error:', error);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
