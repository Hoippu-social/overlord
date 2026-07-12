import '@/lib/bigintJson';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorizeGuildApiRequest, isGuildApiAuthFailure } from '@/lib/guildApiAuth';
import type { SeasonResultRow } from '@/lib/economy/types';
import { botPost, enrichUsers } from '../_shared';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ guildId: string }> }) {
    try {
        const { guildId } = await params;
        const auth = await authorizeGuildApiRequest(request, guildId);
        if (isGuildApiAuthFailure(auth)) return auth.response;

        const { searchParams } = new URL(request.url);
        const seasonParam = searchParams.get('season');

        let seasonId: number | null = null;
        if (seasonParam != null) {
            const season = await prisma.economySeason.findUnique({
                where: { guildId_number: { guildId, number: Number(seasonParam) } },
            });
            seasonId = season?.id ?? null;
        } else {
            const season = await prisma.economySeason.findFirst({
                where: { guildId, status: 'ARCHIVED' },
                orderBy: { number: 'desc' },
            });
            seasonId = season?.id ?? null;
        }

        if (seasonId === null) {
            return NextResponse.json({ results: [] });
        }

        const rows = await prisma.economySeasonResult.findMany({
            where: { seasonId },
            orderBy: { rank: 'asc' },
            take: 100,
        });

        const enriched = await enrichUsers(guildId, rows.map((r) => r.userId));

        const results: SeasonResultRow[] = rows.map((row) => ({
            userId: row.userId,
            rank: row.rank,
            finalWallet: String(row.finalWallet),
            finalBank: String(row.finalBank),
            totalEarned: String(row.totalEarned),
            displayName: enriched[row.userId]?.displayName ?? null,
        }));

        return NextResponse.json({ results });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to load hall of fame';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ guildId: string }> }) {
    try {
        const { guildId } = await params;
        const auth = await authorizeGuildApiRequest(request, guildId, { live: true });
        if (isGuildApiAuthFailure(auth)) return auth.response;

        const body = (await request.json()) as { action: string; resetBalances?: boolean };
        if (body.action !== 'end') {
            return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
        }

        // Season end moves money and grants roles → must run in the bot process via the bridge.
        const result = await botPost('/api/economy/season-end', {
            guildId,
            resetBalances: !!body.resetBalances,
        });
        if (!result.ok) {
            return NextResponse.json({ error: result.error || 'Bot action failed' }, { status: 502 });
        }

        return NextResponse.json({ ok: true });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to end season';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
