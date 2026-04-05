import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { fetchGuildChannels, parseChannels } from '@/lib/discord-api';
import { authorizeGuildApiRequest, isGuildApiAuthFailure } from '@/lib/guildApiAuth';

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

        // @ts-ignore
        const config = await prisma.ticketConfig.findUnique({ where: { guildId } });
        // @ts-ignore
        const categories = await prisma.ticketCategory.findMany({
            where: { guildId },
            include: { _count: { select: { tickets: true } } }
        });

        // 1. Calculate active tickets per category
        // @ts-ignore
        const activeCounts = await prisma.ticket.groupBy({
            by: ['categoryId'],
            where: { guildId, status: 'OPEN' },
            _count: { _all: true }
        });

        const activeMap = new Map(activeCounts.map((c: any) => [c.categoryId, c._count._all]));

        const categoriesWithStats = categories.map((cat: any) => ({
            ...cat,
            stats: {
                total: cat._count.tickets,
                active: activeMap.get(cat.id) || 0
            }
        }));

        // Fetch Discord channels for selector
        const rawChannels = await fetchGuildChannels(guildId);
        const channels = parseChannels(rawChannels || []);

        // 2. Global stats based on period
        // @ts-ignore
        const periodTickets = await prisma.ticket.findMany({
            where: {
                guildId,
                createdAt: { gte: startDate }
            },
            select: { status: true, createdAt: true, closedAt: true, rating: true, categoryId: true }
        });

        let open = 0, onHold = 0, closed = 0;
        let totalResolutionTime = 0;
        let resolvedCount = 0;

        const ratings = { positive: 0, neutral: 0, negative: 0, total: 0 };
        const categoryPieData: Record<string, number> = {};

        periodTickets.forEach((t: any) => {
            if (t.status === 'OPEN') open++;
            else if (t.status === 'ON_HOLD') onHold++;
            else if (t.status === 'CLOSED') {
                closed++;
                if (t.closedAt) {
                    totalResolutionTime += (t.closedAt.getTime() - t.createdAt.getTime());
                    resolvedCount++;
                }
            }

            if (t.rating) {
                ratings.total++;
                if (t.rating >= 4) ratings.positive++;
                else if (t.rating === 3) ratings.neutral++;
                else ratings.negative++;
            }

            const catName = categories.find((c: any) => c.id === t.categoryId)?.name || 'Unknown';
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

        periodTickets.forEach((t: any) => {
            const d = t.createdAt;
            const dateStr = `${d.getDate().toString().padStart(2, '0')}.${(d.getMonth() + 1).toString().padStart(2, '0')}`;
            const dayEntry = activityData.find(a => a.date === dateStr);
            if (dayEntry) {
                dayEntry.created++;
            }

            if (t.status === 'CLOSED' && t.closedAt) {
                const cd = t.closedAt;
                const cdateStr = `${cd.getDate().toString().padStart(2, '0')}.${(cd.getMonth() + 1).toString().padStart(2, '0')}`;
                const cdayEntry = activityData.find(a => a.date === cdateStr);
                if (cdayEntry) {
                    cdayEntry.solved++;
                }
            }
        });

        return NextResponse.json({ config, categories: categoriesWithStats, channels, globalStats, activityData });
    } catch (error: any) {
        console.error('Error fetching tickets:', error);
        return NextResponse.json({ error: error?.message || 'Failed to load tickets' }, { status: 500 });
    }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ guildId: string }> }) {
    try {
        const { guildId } = await params;
        const auth = await authorizeGuildApiRequest(request, guildId, { live: true });
        if (isGuildApiAuthFailure(auth)) {
            return auth.response;
        }

        const body = await request.json();
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

        // @ts-ignore
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
    } catch (error: any) {
        return NextResponse.json({ error: error?.message || 'Failed to create category' }, { status: 500 });
    }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ guildId: string }> }) {
    try {
        const { guildId } = await params;
        const auth = await authorizeGuildApiRequest(request, guildId, { live: true });
        if (isGuildApiAuthFailure(auth)) {
            return auth.response;
        }

        const body = await request.json();
        const { enabled, logChannelId } = body;

        // @ts-ignore
        const config = await prisma.ticketConfig.upsert({
            where: { guildId },
            update: { enabled, logChannelId },
            create: { guildId, enabled, logChannelId }
        });

        return NextResponse.json({ config });
    } catch (error: any) {
        return NextResponse.json({ error: error?.message || 'Failed to update config' }, { status: 500 });
    }
}
