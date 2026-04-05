import { NextRequest, NextResponse } from 'next/server';
import { updatePlayerOnLavalink } from '@/lib/lavalink';
import { authorizeGuildApiRequest, isGuildApiAuthFailure } from '@/lib/guildApiAuth';

export const dynamic = 'force-dynamic';

type ControlBody = {
    paused?: boolean;
    volume?: number;
    positionMs?: number;
};

export async function POST(request: NextRequest, { params }: { params: Promise<{ guildId: string }> }) {
    const { guildId } = await params;
    const auth = await authorizeGuildApiRequest(request, guildId, { live: true });
    if (isGuildApiAuthFailure(auth)) {
        return auth.response;
    }
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
