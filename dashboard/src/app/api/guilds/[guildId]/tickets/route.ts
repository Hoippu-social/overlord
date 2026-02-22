import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthToken } from '@/lib/auth';
import { canAccessGuild } from '@/lib/discordAccess';
import { fetchGuildChannels, parseChannels } from '@/lib/discord-api';

export async function GET(request: NextRequest, { params }: { params: Promise<{ guildId: string }> }) {
    try {
        const token = await getAuthToken(request);
        const accessToken = typeof token?.accessToken === 'string' ? token.accessToken : null;
        if (!accessToken) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const { guildId } = await params;
        const allowedGuilds = Array.isArray(token?.allowedGuilds) ? token.allowedGuilds : null;
        const hasAccess = (allowedGuilds?.includes(guildId) ?? false) || await canAccessGuild(accessToken, guildId);
        if (!hasAccess) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const config = await prisma.ticketConfig.findUnique({ where: { guildId } });
        const categories = await prisma.ticketCategory.findMany({
            where: { guildId },
            include: { _count: { select: { tickets: true } } }
        });

        // Calculate active tickets per category
        const activeCounts = await prisma.ticket.groupBy({
            by: ['categoryId'],
            where: { guildId, status: 'OPEN' },
            _count: { _all: true }
        });

        const activeMap = new Map(activeCounts.map(c => [c.categoryId, c._count._all]));

        const categoriesWithStats = categories.map(cat => ({
            ...cat,
            stats: {
                total: cat._count.tickets,
                active: activeMap.get(cat.id) || 0
            }
        }));

        // Fetch Discord channels for selector
        const rawChannels = await fetchGuildChannels(guildId);
        const channels = parseChannels(rawChannels || []);

        return NextResponse.json({ config, categories: categoriesWithStats, channels });
    } catch (error: any) {
        console.error('Error fetching tickets:', error);
        return NextResponse.json({ error: error?.message || 'Failed to load tickets' }, { status: 500 });
    }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ guildId: string }> }) {
    try {
        const token = await getAuthToken(request);
        const accessToken = typeof token?.accessToken === 'string' ? token.accessToken : null;
        if (!accessToken) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const { guildId } = await params;
        const allowedGuilds = Array.isArray(token?.allowedGuilds) ? token.allowedGuilds : null;
        const hasAccess = (allowedGuilds?.includes(guildId) ?? false) || await canAccessGuild(accessToken, guildId);
        if (!hasAccess) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
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
        const token = await getAuthToken(request);
        const accessToken = typeof token?.accessToken === 'string' ? token.accessToken : null;
        if (!accessToken) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const { guildId } = await params;
        const allowedGuilds = Array.isArray(token?.allowedGuilds) ? token.allowedGuilds : null;
        const hasAccess = (allowedGuilds?.includes(guildId) ?? false) || await canAccessGuild(accessToken, guildId);
        if (!hasAccess) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const body = await request.json();
        const { enabled, logChannelId } = body;

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
