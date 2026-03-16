import { NextRequest, NextResponse } from 'next/server';
import { statsPrisma } from '@/lib/prisma';
import { requireGuildStatsAccess } from '@/lib/statsAccess';
import { withStatsTelemetry } from '@/lib/statsTelemetry';

export const dynamic = 'force-dynamic';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ guildId: string }> }
) {
    const { guildId } = await params;
    return withStatsTelemetry({ guildId, endpoint: 'overview', method: 'GET' }, async () => {
        const access = await requireGuildStatsAccess(request, guildId);
        if (!access.ok) {
            return access.response;
        }

        try {
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

            const hourlyStats = await statsPrisma.statHourly.findMany({
                where: {
                    guildId,
                    dateHour: { gte: sevenDaysAgo }
                },
                orderBy: { dateHour: 'asc' }
            });

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
        } catch (error) {
            console.error('Failed to fetch stats overview:', error);
            return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
        }
    });
}
