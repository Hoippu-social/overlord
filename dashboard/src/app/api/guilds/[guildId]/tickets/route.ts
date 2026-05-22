import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { fetchGuildChannels, parseChannels } from '@/lib/discord-api';
import { authorizeGuildApiRequest, isGuildApiAuthFailure } from '@/lib/guildApiAuth';
import { readAppealSettings } from '@/lib/appealsConfig';

type TicketConfigRecord = {
    enabled: boolean;
    logChannelId: string | null;
};

type TicketCategoryRecord = {
    id: number;
    guildId: string;
    name: string;
    channelId: string | null;
    saveHistory: boolean;
    mentionAgents: boolean;
    allowUserClose: boolean;
    enableRating: boolean;
    messagePayload: string | null;
    buttonText: string;
    buttonEmoji: string | null;
    buttonStyle: string;
    _count: {
        tickets: number;
    };
};

type ActiveCountRecord = {
    categoryId: number;
    _count: {
        _all: number;
    };
};

type PeriodTicketRecord = {
    status: string;
    createdAt: Date;
    closedAt: Date | null;
    rating: number | null;
    categoryId: number | null;
};

export async function GET(request: NextRequest, { params }: { params: Promise<{ guildId: string }> }) {
    try {
        const { guildId } = await params;
        const auth = await authorizeGuildApiRequest(request, guildId);
        if (isGuildApiAuthFailure(auth)) {
            return auth.response;
        }

        const { searchParams } = new URL(request.url);
        const period = searchParams.get('period') || '7d';
        let days = 7;
        if (period === '24h') days = 1;
        else if (period.endsWith('d')) days = parseInt(period) || 7;

        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        startDate.setHours(0, 0, 0, 0); // Start of day

        // @ts-expect-error Legacy Prisma client in this workspace is behind the live DB schema.
        const config = await prisma.ticketConfig.findUnique({ where: { guildId } }) as TicketConfigRecord | null;
        // @ts-expect-error Legacy Prisma client in this workspace is behind the live DB schema.
        const categories = await prisma.ticketCategory.findMany({
            where: { guildId },
            include: { _count: { select: { tickets: true } } }
        }) as TicketCategoryRecord[];

        // 1. Calculate active tickets per category
        // @ts-expect-error Legacy Prisma client in this workspace is behind the live DB schema.
        const activeCounts = await prisma.ticket.groupBy({
            by: ['categoryId'],
            where: { guildId, status: 'OPEN' },
            _count: { _all: true }
        }) as ActiveCountRecord[];

        const activeMap = new Map(activeCounts.map((count) => [count.categoryId, count._count._all]));

        const categoriesWithStats = categories.map((cat) => ({
            ...cat,
            stats: {
                total: cat._count.tickets,
                active: activeMap.get(cat.id) || 0
            }
        }));

        const appealSettings = await readAppealSettings(guildId);
        const appealPlacementCategory = appealSettings.sharedPlacement.enabled
            ? {
                id: -1,
                name: appealSettings.sharedPlacement.label,
                description: appealSettings.sharedPlacement.description,
                channelId: appealSettings.sharedPlacement.channelId || null,
                stats: { total: 0, active: 0 },
                saveHistory: true,
                mentionAgents: false,
                allowUserClose: false,
                enableRating: false,
                messagePayload: null,
                buttonText: appealSettings.sharedPlacement.label,
                buttonEmoji: appealSettings.sharedPlacement.emoji,
                buttonStyle: 'PRIMARY',
                systemManagedBy: 'appeals',
                systemCategoryKind: 'punishment_appeal',
                sortOrder: appealSettings.sharedPlacement.sortOrder,
            }
            : null;

        const mergedCategories = appealPlacementCategory
            ? [...categoriesWithStats, appealPlacementCategory]
            : categoriesWithStats;

        // Fetch Discord channels for selector
        const rawChannels = await fetchGuildChannels(guildId);
        const channels = parseChannels(rawChannels || []);

        // 2. Global stats based on period
        // @ts-expect-error Legacy Prisma client in this workspace is behind the live DB schema.
        const periodTickets = await prisma.ticket.findMany({
            where: {
                guildId,
                createdAt: { gte: startDate }
            },
            select: { status: true, createdAt: true, closedAt: true, rating: true, categoryId: true }
        }) as PeriodTicketRecord[];

        let open = 0, onHold = 0, closed = 0;
        let totalResolutionTime = 0;
        let resolvedCount = 0;

        const ratings = { positive: 0, neutral: 0, negative: 0, total: 0 };
        const categoryPieData: Record<string, number> = {};

        periodTickets.forEach((ticket) => {
            if (ticket.status === 'OPEN') open++;
            else if (ticket.status === 'ON_HOLD') onHold++;
            else if (ticket.status === 'CLOSED') {
                closed++;
                if (ticket.closedAt) {
                    totalResolutionTime += (ticket.closedAt.getTime() - ticket.createdAt.getTime());
                    resolvedCount++;
                }
            }

            if (ticket.rating) {
                ratings.total++;
                if (ticket.rating >= 4) ratings.positive++;
                else if (ticket.rating === 3) ratings.neutral++;
                else ratings.negative++;
            }

            const catName = categories.find((category) => category.id === ticket.categoryId)?.name || 'Unknown';
            categoryPieData[catName] = (categoryPieData[catName] || 0) + 1;
        });

        const avgResolutionMs = resolvedCount > 0 ? totalResolutionTime / resolvedCount : 0;
        const avgResolutionMins = Math.round(avgResolutionMs / 60000);

        const globalStats = {
            open, onHold, closed,
            total: periodTickets.length,
            avgResolutionMins,
            ratings,
            categoryPieData: Object.entries(categoryPieData).map(([name, value]) => ({ name, value }))
        };

        // 3. Activity Chart Data (grouped by day)
        const activityData = Array.from({ length: days }, (_, i) => {
            const d = new Date(Date.now() - (days - 1 - i) * 24 * 60 * 60 * 1000);
            return {
                date: `${d.getDate().toString().padStart(2, '0')}.${(d.getMonth() + 1).toString().padStart(2, '0')}`,
                created: 0,
                solved: 0
            };
        });

        periodTickets.forEach((ticket) => {
            const d = ticket.createdAt;
            const dateStr = `${d.getDate().toString().padStart(2, '0')}.${(d.getMonth() + 1).toString().padStart(2, '0')}`;
            const dayEntry = activityData.find(a => a.date === dateStr);
            if (dayEntry) {
                dayEntry.created++;
            }

            if (ticket.status === 'CLOSED' && ticket.closedAt) {
                const cd = ticket.closedAt;
                const cdateStr = `${cd.getDate().toString().padStart(2, '0')}.${(cd.getMonth() + 1).toString().padStart(2, '0')}`;
                const cdayEntry = activityData.find(a => a.date === cdateStr);
                if (cdayEntry) {
                    cdayEntry.solved++;
                }
            }
        });

        return NextResponse.json({ config, categories: mergedCategories, channels, globalStats, activityData });
    } catch (error: unknown) {
        console.error('Error fetching tickets:', error);
        const message = error instanceof Error ? error.message : 'Failed to load tickets';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ guildId: string }> }) {
    try {
        const { guildId } = await params;
        const auth = await authorizeGuildApiRequest(request, guildId, { live: true });
        if (isGuildApiAuthFailure(auth)) {
            return auth.response;
        }

        const body = await request.json() as { name?: string };
        const { name } = body;

        if (!name) {
            return NextResponse.json({ error: 'Name is required' }, { status: 400 });
        }

        const defaultPayload = {
            content: "",
            embeds: [{
                title: "Create Ticket",
                description: "Click the button below to create a ticket.",
                color: 5793266
            }]
        };

        // @ts-expect-error Legacy Prisma client in this workspace is behind the live DB schema.
        const category = await prisma.ticketCategory.create({
            data: {
                guildId,
                name,
                buttonStyle: 'PRIMARY',
                buttonText: 'Create Ticket',
                messagePayload: JSON.stringify(defaultPayload),
                saveHistory: true,
                mentionAgents: true,
                allowUserClose: true,
                enableRating: true
            }
        });

        return NextResponse.json({ category });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to create category';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ guildId: string }> }) {
    try {
        const { guildId } = await params;
        const auth = await authorizeGuildApiRequest(request, guildId, { live: true });
        if (isGuildApiAuthFailure(auth)) {
            return auth.response;
        }

        const body = await request.json() as { enabled: boolean; logChannelId: string | null };
        const { enabled, logChannelId } = body;

        // @ts-expect-error Legacy Prisma client in this workspace is behind the live DB schema.
        const config = await prisma.ticketConfig.upsert({
            where: { guildId },
            update: { enabled, logChannelId },
            create: { guildId, enabled, logChannelId }
        });

        return NextResponse.json({ config });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to update config';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
