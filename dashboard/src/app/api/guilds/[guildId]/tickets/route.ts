import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { fetchGuildChannels, parseChannels } from '@/lib/discord-api';
import { authorizeGuildApiRequest, isGuildApiAuthFailure } from '@/lib/guildApiAuth';
import { readAppealSettings } from '@/lib/appealsConfig';

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
        startDate.setHours(0, 0, 0, 0);

        const [
            config,
            categories,
            priorities,
            accessProfiles,
            notificationRules,
            activeCounts,
            appealSettings,
            rawChannels,
            periodTickets,
        ] = await Promise.all([
            prisma.ticketConfig.findUnique({ where: { guildId } }),
            prisma.ticketCategory.findMany({
                where: { guildId },
                include: {
                    routingRule: true,
                    _count: { select: { tickets: true } },
                },
            }),
            prisma.ticketPriority.findMany({ where: { guildId }, orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] }),
            prisma.ticketAccessProfile.findMany({ where: { guildId }, orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] }),
            prisma.ticketNotificationRule.findMany({ where: { guildId }, orderBy: { id: 'asc' } }),
            prisma.ticket.groupBy({
                by: ['categoryId'],
                where: { guildId, status: { in: ['OPEN', 'ON_HOLD'] } },
                _count: { _all: true },
            }),
            readAppealSettings(guildId),
            fetchGuildChannels(guildId).catch((error) => {
                console.warn('Ticket workspace: Discord channels are temporarily unavailable', error);
                return [];
            }),
            prisma.ticket.findMany({
                where: { guildId, createdAt: { gte: startDate } },
                select: { status: true, createdAt: true, closedAt: true, rating: true, categoryId: true },
            }),
        ]);

        const activeMap = new Map(activeCounts.map((c) => [c.categoryId, c._count._all]));

        const categoriesWithStats = categories.map((cat) => ({
            ...cat,
            stats: {
                total: cat._count.tickets,
                active: activeMap.get(cat.id) || 0
            }
        }));

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
                messageText: appealSettings.sharedPlacement.description,
                messageEmbeds: JSON.stringify([]),
                messageDesignJson: null,
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

        const channels = parseChannels(rawChannels || []).text;

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

            const catName = categories.find((c) => c.id === ticket.categoryId)?.name || 'Unknown';
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
            if (dayEntry) dayEntry.created++;

            if (ticket.status === 'CLOSED' && ticket.closedAt) {
                const cd = ticket.closedAt;
                const cdateStr = `${cd.getDate().toString().padStart(2, '0')}.${(cd.getMonth() + 1).toString().padStart(2, '0')}`;
                const cdayEntry = activityData.find(a => a.date === cdateStr);
                if (cdayEntry) cdayEntry.solved++;
            }
        });

        return NextResponse.json({
            config,
            categories: mergedCategories,
            channels,
            priorities,
            accessProfiles,
            notificationRules,
            globalStats,
            activityData,
        });
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

        const defaultEmbeds = JSON.stringify([{
            title: 'Create Ticket',
            description: 'Click the button below to create a ticket.',
            color: 5793266
        }]);
        const defaultDesignJson = JSON.stringify({
            version: 1,
            mode: 'classic_embed',
            opener: { label: 'Create Ticket', emoji: null, style: 'PRIMARY' },
            content: '',
            embeds: JSON.parse(defaultEmbeds),
        });

        const category = await prisma.ticketCategory.create({
            data: {
                guildId,
                name,
                defaultPriorityId: await prisma.ticketPriority.findFirst({
                    where: { guildId, isDefault: true, enabled: true },
                    select: { id: true },
                }).then((priority) => priority?.id ?? null),
                buttonStyle: 'PRIMARY',
                buttonText: 'Create Ticket',
                messageText: null,
                messageEmbeds: defaultEmbeds,
                messageDesignJson: defaultDesignJson,
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

        const body = await request.json() as {
            enabled: boolean;
            logChannelId: string | null;
            maxOpenPerUser?: number;
            cooldownSeconds?: number;
            transcriptRetentionDays?: number;
        };

        const config = await prisma.ticketConfig.upsert({
            where: { guildId },
            update: {
                enabled: body.enabled,
                logChannelId: body.logChannelId,
                ...(body.maxOpenPerUser !== undefined && { maxOpenPerUser: body.maxOpenPerUser }),
                ...(body.cooldownSeconds !== undefined && { cooldownSeconds: body.cooldownSeconds }),
                ...(body.transcriptRetentionDays !== undefined && { transcriptRetentionDays: body.transcriptRetentionDays }),
            },
            create: {
                guildId,
                enabled: body.enabled,
                logChannelId: body.logChannelId,
                maxOpenPerUser: body.maxOpenPerUser ?? 1,
                cooldownSeconds: body.cooldownSeconds ?? 60,
                transcriptRetentionDays: body.transcriptRetentionDays ?? 90,
            }
        });

        return NextResponse.json({ config });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to update config';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
