import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthToken } from '@/lib/auth';
import { canAccessGuild } from '@/lib/discordAccess';

const parseCategories = (value: string | null) => {
    if (!value) return [];

    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
};

export async function GET(request: NextRequest, { params }: { params: Promise<{ guildId: string }> }) {
    try {
        const token = await getAuthToken(request);
        const accessToken = typeof token?.accessToken === 'string' ? token.accessToken : null;
        if (!accessToken) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { guildId } = await params;
        const allowedGuilds = Array.isArray(token?.allowedGuilds) ? token.allowedGuilds : null;
        const hasAccess = allowedGuilds ? allowedGuilds.includes(guildId) : await canAccessGuild(accessToken, guildId);
        if (!hasAccess) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const status = request.nextUrl.searchParams.get('status');
        const limit = Math.min(Math.max(Number(request.nextUrl.searchParams.get('limit') ?? 25) || 25, 1), 100);

        const incidents = await prisma.aiModerationIncident.findMany({
            where: {
                guildId,
                ...(status ? { status } : {}),
            },
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            take: limit,
        });

        return NextResponse.json({
            summary: {
                total: incidents.length,
                open: incidents.filter((item) => item.status === 'OPEN').length,
                falsePositive: incidents.filter((item) => item.status === 'FALSE_POSITIVE').length,
                confirmed: incidents.filter((item) => item.status.startsWith('CONFIRMED')).length,
            },
            incidents: incidents.map((incident) => ({
                ...incident,
                categories: parseCategories(incident.categories),
            })),
        });
    } catch (error) {
        console.error('Failed to load AI moderation incidents:', error);
        return NextResponse.json({ error: 'Failed to load AI moderation incidents.' }, { status: 500 });
    }
}
