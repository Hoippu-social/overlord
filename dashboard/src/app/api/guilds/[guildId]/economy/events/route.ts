import '@/lib/bigintJson';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorizeGuildApiRequest, isGuildApiAuthFailure } from '@/lib/guildApiAuth';

export const dynamic = 'force-dynamic';

type PostBody =
    | { kind: 'event-window'; type: 'MULTIPLIER' | 'AIRDROP'; amount?: string; multiplier?: number; channelId?: string; startsAt: string; endsAt: string }
    | { kind: 'lottery'; ticketPrice: string; houseCutBps: number; endsAt: string; channelId?: string }
    | { kind: 'lottery-draw'; lotteryId: number };

export async function POST(request: NextRequest, { params }: { params: Promise<{ guildId: string }> }) {
    try {
        const { guildId } = await params;
        const auth = await authorizeGuildApiRequest(request, guildId, { live: true });
        if (isGuildApiAuthFailure(auth)) return auth.response;

        const body = (await request.json()) as PostBody;

        if (body.kind === 'event-window') {
            await prisma.economyEventWindow.create({
                data: {
                    guildId,
                    type: body.type,
                    multiplier: body.multiplier ?? null,
                    amount: body.amount != null ? BigInt(body.amount) : null,
                    channelId: body.channelId ?? null,
                    startsAt: new Date(body.startsAt),
                    endsAt: new Date(body.endsAt),
                    status: 'SCHEDULED',
                    createdBy: 'dashboard',
                },
            });
            // The bot's EconomyLifecycleService sweep (every ~60s) activates/executes it.
            return NextResponse.json({ ok: true });
        }

        if (body.kind === 'lottery') {
            await prisma.economyLottery.create({
                data: {
                    guildId,
                    ticketPrice: BigInt(body.ticketPrice),
                    houseCutBps: body.houseCutBps,
                    endsAt: new Date(body.endsAt),
                    channelId: body.channelId ?? null,
                    status: 'OPEN',
                    pot: BigInt(0),
                },
            });
            return NextResponse.json({ ok: true });
        }

        if (body.kind === 'lottery-draw') {
            // Bring the end time forward; the bot sweep draws OPEN lotteries whose endsAt has passed.
            await prisma.economyLottery.updateMany({
                where: { id: body.lotteryId, guildId, status: 'OPEN' },
                data: { endsAt: new Date() },
            });
            return NextResponse.json({ ok: true });
        }

        return NextResponse.json({ error: 'Unknown event kind' }, { status: 400 });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to create event';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ guildId: string }> }) {
    try {
        const { guildId } = await params;
        const auth = await authorizeGuildApiRequest(request, guildId, { live: true });
        if (isGuildApiAuthFailure(auth)) return auth.response;

        const body = (await request.json()) as { kind: 'event-window' | 'lottery'; id: number };

        if (body.kind === 'event-window') {
            await prisma.economyEventWindow.updateMany({
                where: { id: body.id, guildId },
                data: { status: 'CANCELLED' },
            });
        } else if (body.kind === 'lottery') {
            await prisma.economyLottery.updateMany({
                where: { id: body.id, guildId, status: 'OPEN' },
                data: { status: 'CANCELLED' },
            });
        } else {
            return NextResponse.json({ error: 'Unknown event kind' }, { status: 400 });
        }

        return NextResponse.json({ ok: true });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to cancel event';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
