import { NextRequest, NextResponse } from 'next/server';
import { authorizeGuildApiRequest, isGuildApiAuthFailure } from '@/lib/guildApiAuth';
import { loadEmojis } from '../economy/_shared';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ guildId: string }> }) {
    const { guildId } = await params;
    const auth = await authorizeGuildApiRequest(request, guildId);
    if (isGuildApiAuthFailure(auth)) return auth.response;

    return NextResponse.json({ emojis: await loadEmojis(guildId) });
}
