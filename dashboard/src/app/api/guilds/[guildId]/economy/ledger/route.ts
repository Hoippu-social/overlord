import '@/lib/bigintJson';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorizeGuildApiRequest, isGuildApiAuthFailure } from '@/lib/guildApiAuth';
import type { LedgerPage, LedgerRow, LedgerType } from '@/lib/economy/types';
import { enrichUsers } from '../_shared';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 30;

export async function GET(request: NextRequest, { params }: { params: Promise<{ guildId: string }> }) {
    try {
        const { guildId } = await params;
        const auth = await authorizeGuildApiRequest(request, guildId);
        if (isGuildApiAuthFailure(auth)) return auth.response;

        const { searchParams } = new URL(request.url);
        const cursor = searchParams.get('cursor');
        const type = searchParams.get('type');
        const userId = searchParams.get('userId');

        const where: Record<string, unknown> = { guildId };
        if (type) where.type = type;
        if (userId) where.userId = userId;

        const rows = await prisma.economyTransaction.findMany({
            where,
            orderBy: { id: 'desc' },
            take: PAGE_SIZE,
            ...(cursor ? { cursor: { id: BigInt(cursor) }, skip: 1 } : {}),
        });

        const enriched = await enrichUsers(guildId, rows.map((r) => r.userId).filter((id) => id && id !== 'SYSTEM'));

        const ledgerRows: LedgerRow[] = rows.map((row) => ({
            id: String(row.id),
            userId: row.userId,
            displayName: enriched[row.userId]?.displayName ?? null,
            type: row.type as LedgerType,
            account: row.account as 'WALLET' | 'BANK',
            amount: String(row.amount),
            balanceAfter: String(row.balanceAfter),
            actorId: row.actorId,
            sourceRef: row.sourceRef,
            createdAt: row.createdAt.toISOString(),
        }));

        const nextCursor = rows.length === PAGE_SIZE ? String(rows[rows.length - 1].id) : null;

        const page: LedgerPage = { rows: ledgerRows, nextCursor };
        return NextResponse.json(page);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to load ledger';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
