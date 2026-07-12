import '@/lib/bigintJson';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorizeGuildApiRequest, isGuildApiAuthFailure } from '@/lib/guildApiAuth';
import type { LedgerType, OverviewData } from '@/lib/economy/types';

export const dynamic = 'force-dynamic';

function periodStart(period: string): Date {
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    switch (period) {
        case '24h': return new Date(now - day);
        case '30d': return new Date(now - 30 * day);
        case '90d': return new Date(now - 90 * day);
        case '7d':
        default: return new Date(now - 7 * day);
    }
}

const ZERO = BigInt(0);
const abs = (v: bigint): bigint => (v < ZERO ? -v : v);

export async function GET(request: NextRequest, { params }: { params: Promise<{ guildId: string }> }) {
    try {
        const { guildId } = await params;
        const auth = await authorizeGuildApiRequest(request, guildId);
        if (isGuildApiAuthFailure(auth)) return auth.response;

        const { searchParams } = new URL(request.url);
        const period = searchParams.get('period') || '7d';
        const start = periodStart(period);

        const [totals, memberCount, grouped, activeEvents, openLotteries] = await Promise.all([
            prisma.economyMember.aggregate({ where: { guildId }, _sum: { wallet: true, bank: true } }),
            prisma.economyMember.count({ where: { guildId } }),
            prisma.economyTransaction.groupBy({
                by: ['type'],
                where: { guildId, createdAt: { gte: start } },
                _sum: { amount: true },
            }),
            prisma.economyEventWindow.count({ where: { guildId, status: 'ACTIVE' } }),
            prisma.economyLottery.count({ where: { guildId, status: 'OPEN' } }),
        ]);

        const totalWallet = totals._sum.wallet ?? ZERO;
        const totalBank = totals._sum.bank ?? ZERO;

        const sources: { type: LedgerType; amount: string }[] = [];
        const sinks: { type: LedgerType; amount: string }[] = [];
        let emissionTotal = ZERO;
        let sinkTotal = ZERO;

        for (const g of grouped) {
            const sum = g._sum.amount ?? ZERO;
            if (sum > ZERO) {
                sources.push({ type: g.type as LedgerType, amount: String(sum) });
                emissionTotal += sum;
            } else if (sum < ZERO) {
                const mag = abs(sum);
                sinks.push({ type: g.type as LedgerType, amount: String(mag) });
                sinkTotal += mag;
            }
        }
        sources.sort((a, b) => (BigInt(b.amount) > BigInt(a.amount) ? 1 : -1));
        sinks.sort((a, b) => (BigInt(b.amount) > BigInt(a.amount) ? 1 : -1));

        // Daily emission vs sink series (oldest first). One bounded scan bucketed in JS.
        const scan = await prisma.economyTransaction.findMany({
            where: { guildId, createdAt: { gte: start } },
            select: { amount: true, createdAt: true },
            orderBy: { id: 'desc' },
            take: 5000,
        });
        const buckets = new Map<string, { emission: bigint; sink: bigint }>();
        for (const t of scan) {
            const key = t.createdAt.toISOString().slice(0, 10);
            const b = buckets.get(key) ?? { emission: ZERO, sink: ZERO };
            if (t.amount > ZERO) b.emission += t.amount;
            else if (t.amount < ZERO) b.sink += abs(t.amount);
            buckets.set(key, b);
        }
        const trend = Array.from(buckets.entries())
            .sort(([a], [b]) => (a < b ? -1 : 1))
            .map(([date, b]) => ({ date, emission: String(b.emission), sink: String(b.sink) }));

        const data: OverviewData = {
            totalWallet: String(totalWallet),
            totalBank: String(totalBank),
            totalSupply: String(totalWallet + totalBank),
            memberCount,
            sources,
            sinks,
            emissionTotal: String(emissionTotal),
            sinkTotal: String(sinkTotal),
            trend,
            activeEventCount: activeEvents + openLotteries,
        };

        return NextResponse.json(data);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to load overview';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
