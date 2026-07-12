import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorizeGuildApiRequest, isGuildApiAuthFailure } from '@/lib/guildApiAuth';
import type { EarnSource } from '@/lib/economy/types';
import { invalidateEconomyCache } from '../_shared';

export const dynamic = 'force-dynamic';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ guildId: string }> }) {
    try {
        const { guildId } = await params;
        const auth = await authorizeGuildApiRequest(request, guildId, { live: true });
        if (isGuildApiAuthFailure(auth)) return auth.response;

        const body = (await request.json()) as { sources: EarnSource[] };
        const sources = Array.isArray(body.sources) ? body.sources : [];

        await prisma.$transaction(
            sources.map((s) =>
                prisma.economyEarnSource.upsert({
                    where: { guildId_source: { guildId, source: s.source } },
                    update: { enabled: s.enabled, settings: JSON.stringify(s.settings ?? {}) },
                    create: { guildId, source: s.source, enabled: s.enabled, settings: JSON.stringify(s.settings ?? {}) },
                })
            )
        );

        await invalidateEconomyCache(guildId);

        return NextResponse.json({ ok: true });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to save earn sources';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
