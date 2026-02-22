import { NextRequest, NextResponse } from 'next/server';
import { statsPrisma } from '@/lib/prisma';
import { getAuthToken } from '@/lib/auth';
import { canAccessGuild } from '@/lib/discordAccess';

export const dynamic = 'force-dynamic';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ guildId: string }> }
) {
    const token = await getAuthToken(request);
    const accessToken = typeof token?.accessToken === 'string' ? token.accessToken : null;

    if (!accessToken) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { guildId } = await params;

        // Administrative Bypass or Permission Check
        let hasAccess = false;
        if ((token as any)?.role === 'admin') {
            hasAccess = true;
        } else {
            const allowedGuilds = Array.isArray(token?.allowedGuilds) ? token.allowedGuilds : null;
            hasAccess = (allowedGuilds?.includes(guildId) ?? false) || await canAccessGuild(accessToken, guildId);
        }

        if (!hasAccess) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // Fetch last 7 days of hourly stats
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const hourlyStats = await statsPrisma.statHourly.findMany({
            where: {
                guildId,
                dateHour: { gte: sevenDaysAgo }
            },
            orderBy: { dateHour: 'asc' }
        });

        // Fetch Top Members (Messages) for the last 30 days
        const topMembers = await statsPrisma.statTopMember.findMany({
            where: {
                guildId,
                category: 'MESSAGES',
                period: '30D'
            },
            take: 10,
            orderBy: { value: 'desc' }
        });

        return NextResponse.json({
            hourly: hourlyStats,
            topMembers: topMembers
        });
    } catch (error: any) {
        console.error('Failed to fetch stats overview:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
