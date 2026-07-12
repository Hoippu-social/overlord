import '@/lib/bigintJson';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorizeGuildApiRequest, isGuildApiAuthFailure } from '@/lib/guildApiAuth';
import type { WalletsPage, WalletRow } from '@/lib/economy/types';
import { botPost, enrichUsers } from '../_shared';

export const dynamic = 'force-dynamic';

function resolveActorId(token: unknown): string {
    if (token && typeof token === 'object') {
        const t = token as Record<string, unknown>;
        if (typeof t.sub === 'string') return t.sub;
        if (typeof t.userId === 'string') return t.userId;
        if (typeof t.id === 'string') return t.id;
    }
    return 'dashboard';
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ guildId: string }> }) {
    try {
        const { guildId } = await params;
        const auth = await authorizeGuildApiRequest(request, guildId);
        if (isGuildApiAuthFailure(auth)) return auth.response;

        const { searchParams } = new URL(request.url);
        const page = Math.max(1, parseInt(searchParams.get('page') || '1') || 1);
        const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '25') || 25));
        const search = (searchParams.get('search') || '').trim();

        const where = {
            guildId,
            ...(search ? { userId: { contains: search } } : {}),
        };

        const [total, rows] = await Promise.all([
            prisma.economyMember.count({ where }),
            prisma.economyMember.findMany({
                where,
                orderBy: { wallet: 'desc' },
                skip: (page - 1) * pageSize,
                take: pageSize,
            }),
        ]);

        const enriched = await enrichUsers(guildId, rows.map((r) => r.userId));

        const mapped: WalletRow[] = rows.map((row) => ({
            userId: row.userId,
            displayName: enriched[row.userId]?.displayName ?? null,
            avatar: enriched[row.userId]?.avatar ?? null,
            wallet: String(row.wallet),
            bank: String(row.bank),
            totalEarned: String(row.totalEarned),
            totalSpent: String(row.totalSpent),
            dailyStreak: row.dailyStreak,
            blacklisted: row.blacklistedAt != null,
            blacklistReason: row.blacklistReason,
            topRoleId: null,
        }));

        const result: WalletsPage = { rows: mapped, total, page, pageSize };
        return NextResponse.json(result);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to load wallets';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ guildId: string }> }) {
    try {
        const { guildId } = await params;
        const auth = await authorizeGuildApiRequest(request, guildId, { live: true });
        if (isGuildApiAuthFailure(auth)) return auth.response;

        const body = (await request.json()) as {
            userId: string;
            account: 'WALLET' | 'BANK';
            amount: string;
            reason?: string;
            mode: 'grant' | 'deduct';
        };

        const actorId = resolveActorId(auth.token);
        const result = await botPost('/api/economy/grant', {
            guildId,
            userId: body.userId,
            account: body.account,
            amount: body.amount,
            reason: body.reason,
            mode: body.mode,
            actorId,
        });

        if (!result.ok) {
            return NextResponse.json({ error: result.error || 'Grant failed' }, { status: 502 });
        }
        return NextResponse.json({ ok: true });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to adjust balance';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ guildId: string }> }) {
    try {
        const { guildId } = await params;
        const auth = await authorizeGuildApiRequest(request, guildId, { live: true });
        if (isGuildApiAuthFailure(auth)) return auth.response;

        const body = (await request.json()) as { userId: string; blacklisted: boolean; reason?: string };
        const actorId = resolveActorId(auth.token);

        await prisma.economyMember.upsert({
            where: { guildId_userId: { guildId, userId: body.userId } },
            update: {
                blacklistedAt: body.blacklisted ? new Date() : null,
                blacklistReason: body.blacklisted ? body.reason ?? null : null,
                blacklistedBy: body.blacklisted ? actorId : null,
            },
            create: {
                guildId,
                userId: body.userId,
                blacklistedAt: body.blacklisted ? new Date() : null,
                blacklistReason: body.blacklisted ? body.reason ?? null : null,
                blacklistedBy: body.blacklisted ? actorId : null,
            },
        });

        return NextResponse.json({ ok: true });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to update blacklist';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
