import { NextRequest, NextResponse } from 'next/server';
import { authorizeGuildApiRequest, isGuildApiAuthFailure } from '@/lib/guildApiAuth';

export const dynamic = 'force-dynamic';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ guildId: string }> }
) {
    const { guildId } = await params;
    const auth = await authorizeGuildApiRequest(request, guildId, { live: true });

    if (isGuildApiAuthFailure(auth)) {
        return auth.response;
    }

    return NextResponse.json({ ok: true, access: true });
}
