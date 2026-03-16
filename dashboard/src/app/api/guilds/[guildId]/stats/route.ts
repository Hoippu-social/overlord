import { NextRequest, NextResponse } from 'next/server';
import { isStatsPostgres, prisma, statsPrisma } from '@/lib/prisma';
import { requireGuildStatsAccess } from '@/lib/statsAccess';
import { withStatsTelemetry } from '@/lib/statsTelemetry';
import {
    buildVoiceWhereClause,
    formatStatsBucketLabel,
    getStatsHourOfDay,
    getStatsPeriodKey,
    getStatsStartDate,
    getVoiceSessionDurationSeconds,
    mergeBucketSeries,
    normalizeStatsPeriod,
} from '@/lib/stats';

const BOT_API_URL = process.env.BOT_API_URL || 'http://127.0.0.1:3002';

// Patch BigInt serialization for JSON
(BigInt.prototype as any).toJSON = function () {
    return this.toString();
};

const isMissingTableError = (error: unknown) => {
    const err = error as { code?: string; message?: string };
    if (err?.code === 'P2021') return true;
    const message = err?.message || '';
    return message.includes('no such table') || message.includes('does not exist');
};

// Helper to enrich top data with user/channel info from bot
async function enrichTopData(
    guildId: string,
    topChannels: any[],
    topMembers: any[],
    category: 'MESSAGES' | 'VOICE'
) {
    try {
        const userIds = topMembers.map(m => m.userId);
        const channelIds = topChannels.map(c => c.channelId);

        const enrichResponse = await fetch(`${BOT_API_URL}/api/enrich`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ guildId, userIds, channelIds })
        });

        if (!enrichResponse.ok) {
            console.warn('[Stats API] Failed to enrich data');
            return { topChannels, topMembers };
        }

        const enrichData = await enrichResponse.json();
        const { users, channels } = enrichData;

        // Enrich channels
        const enrichedChannels = topChannels.map(c => {
            const info = channels?.[c.channelId];
            return {
                ...c,
                id: c.channelId,
                name: info?.name || c.channelId,
                discordUrl: `https://discord.com/channels/${guildId}/${c.channelId}`
            };
        });

        // Enrich members
        const enrichedMembers = topMembers.map(m => {
            const info = users?.[m.userId];
            return {
                ...m,
                id: m.userId,
                name: info?.name || m.userId,
                avatar: info?.avatar || null
            };
        });

        return { topChannels: enrichedChannels, topMembers: enrichedMembers };
    } catch (error) {
        console.error('[Stats API] Enrich error:', error);
        return { topChannels, topMembers };
    }
}

// Merge raw data from stats.db and development.db to avoid missing recent data
async function getMergedMessages(guildId: string, startDate: Date) {
    return statsPrisma.statMessage.findMany({ where: { guildId, createdAt: { gte: startDate } } });
}

async function getMergedVoice(guildId: string, startDate: Date) {
    return statsPrisma.statVoiceState.findMany({
        where: { guildId, ...buildVoiceWhereClause(startDate) }
    });
}

async function getGuildStatsTimezone(guildId: string): Promise<string> {
    try {
        const state = await statsPrisma.statsAggregationState.findUnique({
            where: { guildId },
            select: { timezone: true },
        });
        if (state?.timezone) {
            return state.timezone;
        }
    } catch (error) {
        if (!isMissingTableError(error)) {
            throw error;
        }
    }

    const settings = await prisma.botSettings.findUnique({
        where: { guildId },
        select: { timezone: true },
    });
    return settings?.timezone || 'UTC';
}

async function getMessagesSummaryFromReadModels(guildId: string, startDate: Date) {
    try {
        const [topChannelsRaw, topMembersRaw, distinctChannelsObj, distinctMembersObj, totalObj] = await Promise.all([
            statsPrisma.statChannelDaily.groupBy({
                by: ['channelId'],
                where: { guildId, date: { gte: startDate } },
                _sum: { messages: true },
                orderBy: { _sum: { messages: 'desc' } },
                take: 20,
            }),
            statsPrisma.statMemberDaily.groupBy({
                by: ['userId'],
                where: { guildId, date: { gte: startDate } },
                _sum: { messages: true },
                orderBy: { _sum: { messages: 'desc' } },
                take: 20,
            }),
            statsPrisma.$queryRaw<{ count: number }[]>`
                SELECT COUNT(DISTINCT "channelId") as count
                FROM "StatChannelDaily"
                WHERE "guildId" = ${guildId}
                  AND "date" >= ${startDate}
                  AND "messages" > 0
            `,
            statsPrisma.$queryRaw<{ count: number }[]>`
                SELECT COUNT(DISTINCT "userId") as count
                FROM "StatMemberDaily"
                WHERE "guildId" = ${guildId}
                  AND "date" >= ${startDate}
                  AND "messages" > 0
            `,
            statsPrisma.statChannelDaily.aggregate({
                where: { guildId, date: { gte: startDate } },
                _sum: { messages: true },
            }),
        ]);

        return {
            topChannels: topChannelsRaw.map((row) => ({
                channelId: row.channelId,
                value: row._sum.messages || 0,
            })),
            topMembers: topMembersRaw.map((row) => ({
                userId: row.userId,
                value: row._sum.messages || 0,
            })),
            uniqueChannels: Number(distinctChannelsObj[0]?.count || 0),
            uniqueUsers: Number(distinctMembersObj[0]?.count || 0),
            totalValue: totalObj._sum.messages || 0,
        };
    } catch (error) {
        if (isMissingTableError(error)) {
            return null;
        }
        throw error;
    }
}

async function getVoiceSummaryFromReadModels(guildId: string, startDate: Date) {
    try {
        const [topChannelsRaw, topMembersRaw, distinctChannelsObj, distinctMembersObj, totalObj] = await Promise.all([
            statsPrisma.statChannelDaily.groupBy({
                by: ['channelId'],
                where: { guildId, date: { gte: startDate } },
                _sum: { voiceSeconds: true },
                orderBy: { _sum: { voiceSeconds: 'desc' } },
                take: 20,
            }),
            statsPrisma.statMemberDaily.groupBy({
                by: ['userId'],
                where: { guildId, date: { gte: startDate } },
                _sum: { voiceSeconds: true },
                orderBy: { _sum: { voiceSeconds: 'desc' } },
                take: 20,
            }),
            statsPrisma.$queryRaw<{ count: number }[]>`
                SELECT COUNT(DISTINCT "channelId") as count
                FROM "StatChannelDaily"
                WHERE "guildId" = ${guildId}
                  AND "date" >= ${startDate}
                  AND "voiceSeconds" > 0
            `,
            statsPrisma.$queryRaw<{ count: number }[]>`
                SELECT COUNT(DISTINCT "userId") as count
                FROM "StatMemberDaily"
                WHERE "guildId" = ${guildId}
                  AND "date" >= ${startDate}
                  AND "voiceSeconds" > 0
            `,
            statsPrisma.statChannelDaily.aggregate({
                where: { guildId, date: { gte: startDate } },
                _sum: { voiceSeconds: true },
            }),
        ]);

        return {
            topChannels: topChannelsRaw.map((row) => ({
                channelId: row.channelId,
                value: row._sum.voiceSeconds || 0,
            })),
            topMembers: topMembersRaw.map((row) => ({
                userId: row.userId,
                value: row._sum.voiceSeconds || 0,
            })),
            uniqueChannels: Number(distinctChannelsObj[0]?.count || 0),
            uniqueUsers: Number(distinctMembersObj[0]?.count || 0),
            totalValue: totalObj._sum.voiceSeconds || 0,
        };
    } catch (error) {
        if (isMissingTableError(error)) {
            return null;
        }
        throw error;
    }
}

// Calculate total for "Others" category
async function getTotalValue(
    guildId: string,
    category: 'MESSAGES' | 'VOICE',
    startDate: Date
): Promise<{ totalChannels: number; totalMembers: number }> {
    const daily = await statsPrisma.statDaily.findMany({
        where: { guildId, date: { gte: startDate } },
        select: { messages: true, voiceSeconds: true }
    });

    if (category === 'MESSAGES') {
        const total = daily.reduce((sum, d) => sum + d.messages, 0);
        return { totalChannels: total, totalMembers: total };
    } else {
        const totalSeconds = daily.reduce((sum, d) => sum + d.voiceSeconds, 0);
        return { totalChannels: totalSeconds, totalMembers: totalSeconds };
    }
}

function calculateMedian(values: number[]): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function enrichWithMedian(data: any[], valueKey: string) {
    // If short period (<= 8 days), use global median flat line
    if (data.length <= 8) {
        const values = data.map(d => d[valueKey]);
        const median = calculateMedian(values);
        return data.map(d => ({ ...d, weeklyMedian: median }));
    }

    // For longer periods, calculate median per 7-day chunk and assign to the middle point
    // This allows smooth interpolation between weekly medians
    const enriched = [...data];
    for (let i = 0; i < data.length; i += 7) {
        const chunk = data.slice(i, i + 7);
        if (chunk.length < 1) continue;
        const values = chunk.map(d => d[valueKey]);
        const median = calculateMedian(values);

        // Assign to middle
        const midIndex = i + Math.floor(chunk.length / 2);
        enriched[midIndex] = { ...enriched[midIndex], weeklyMedian: median };
    }
    return enriched;
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ guildId: string }> }
) {
    const { guildId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type') || 'overview';
    const period = normalizeStatsPeriod(searchParams.get('period') || '7d');
    return withStatsTelemetry({ guildId, endpoint: `stats:${type}`, method: 'GET', period }, async () => {
        const access = await requireGuildStatsAccess(request, guildId);
        if (!access.ok) {
            return access.response;
        }

        const isHourly = period === '24h';
        const now = new Date();
        const startDate = getStatsStartDate(period, now);

        try {
            const timezone = await getGuildStatsTimezone(guildId);
            let responseData: any = {};
            const debugInfo = {
                url: process.env.DATABASE_URL,
                startDate: startDate.toISOString(),
                guildId,
                period,
                type,
                timezone,
            };
            responseData._debug = debugInfo;

        // 1. Overview Data
        if (type === 'overview') {
            let activityData: any[] = [];
            let totalMessages = 0;
            let totalVoiceSeconds = 0;

            if (isHourly) {
                const hourlyStats = await statsPrisma.statHourly.findMany({
                    where: { guildId, dateHour: { gte: startDate } },
                    orderBy: { dateHour: 'asc' }
                });
                totalMessages = hourlyStats.reduce((sum, h) => sum + h.messages, 0);
                totalVoiceSeconds = hourlyStats.reduce((sum, h) => sum + h.voiceSeconds, 0);
                activityData = hourlyStats.map(h => ({
                    date: formatStatsBucketLabel(h.dateHour, period, timezone),
                    messages: h.messages,
                    voice: Math.floor(h.voiceSeconds / 60)
                }));
            } else {
                try {
                    const dailyRows = await statsPrisma.statChannelDaily.groupBy({
                        by: ['date'],
                        where: { guildId, date: { gte: startDate } },
                        _sum: { messages: true, voiceSeconds: true },
                        orderBy: { date: 'asc' },
                    });

                    totalMessages = dailyRows.reduce((sum, row) => sum + (row._sum.messages || 0), 0);
                    totalVoiceSeconds = dailyRows.reduce((sum, row) => sum + (row._sum.voiceSeconds || 0), 0);
                    activityData = dailyRows.map((row) => ({
                        date: formatStatsBucketLabel(row.date, period, timezone),
                        messages: row._sum.messages || 0,
                        voice: Math.floor((row._sum.voiceSeconds || 0) / 60),
                    }));
                } catch (error) {
                    if (!isMissingTableError(error)) {
                        throw error;
                    }

                    const dailyStats = await statsPrisma.statDaily.findMany({
                        where: { guildId, date: { gte: startDate } },
                        orderBy: { date: 'asc' }
                    });

                    const merged = mergeBucketSeries(
                        dailyStats,
                        (row) => row.date,
                        (row) => ({
                            messages: row.messages,
                            voiceSeconds: row.voiceSeconds,
                        }),
                        period,
                        timezone
                    );

                    totalMessages = dailyStats.reduce((sum, d) => sum + d.messages, 0);
                    totalVoiceSeconds = dailyStats.reduce((sum, d) => sum + d.voiceSeconds, 0);
                    activityData = merged.map((row) => ({
                        date: row.date,
                        messages: Number(row.messages || 0),
                        voice: Math.floor(Number(row.voiceSeconds || 0) / 60),
                    }));
                }
            }

            // Always fetch daily member deltas (they are not available in hourly rows)
            const dailyForMembers = await statsPrisma.statDaily.findMany({
                where: { guildId, date: { gte: startDate } },
                select: { newMembers: true, leftMembers: true }
            });
            const joinedMembers = dailyForMembers.reduce((sum, d) => sum + d.newMembers, 0);
            const leftMembers = dailyForMembers.reduce((sum, d) => sum + d.leftMembers, 0);
            const memberChange = joinedMembers - leftMembers;

            responseData = {
                cards: { totalMessages, totalVoiceSeconds, memberChange },
                activityData
            };
        }

        // 2. Messages Data
        else if (type === 'messages') {
            // Line Chart
            let lineChart: any[] = [];
            if (isHourly) {
                const hourly = await statsPrisma.statHourly.findMany({
                    where: { guildId, dateHour: { gte: startDate } },
                    orderBy: { dateHour: 'asc' }
                });
                lineChart = hourly.map(h => ({ date: formatStatsBucketLabel(h.dateHour, period, timezone), messages: h.messages }));
            } else {
                try {
                    const dailyRows = await statsPrisma.statChannelDaily.groupBy({
                        by: ['date'],
                        where: { guildId, date: { gte: startDate } },
                        _sum: { messages: true },
                        orderBy: { date: 'asc' },
                    });
                    lineChart = dailyRows.map((row) => ({
                        date: formatStatsBucketLabel(row.date, period, timezone),
                        messages: row._sum.messages || 0,
                    }));
                } catch (error) {
                    if (!isMissingTableError(error)) {
                        throw error;
                    }

                    const daily = await statsPrisma.statDaily.findMany({
                        where: { guildId, date: { gte: startDate } },
                        orderBy: { date: 'asc' },
                        select: { date: true, messages: true }
                    });

                    lineChart = mergeBucketSeries(
                        daily,
                        (row) => row.date,
                        (row) => ({ messages: row.messages }),
                        period,
                        timezone
                    );
                }
            }

            if (!isHourly && lineChart.length > 0) {
                lineChart = enrichWithMedian(lineChart, 'messages');
            }

            // Heatmap (Hourly)
            const hourlyStats = await statsPrisma.statHourly.findMany({
                where: {
                    guildId,
                    dateHour: { gte: period === '24h' ? startDate : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
                }
            });

            // NEW LOGIC: Use pre-calculated tops for better performance and historical accuracy (for periods > 24H)
            let topChannels: { channelId: string, value: number }[] = [];
            let topMembers: { userId: string, value: number }[] = [];
            let uniqueUsers = 0;
            let uniqueChannels = 0;
            let totalMessagesValue = 0;

            let messagesSummaryAvailable = false;
            if (!isHourly) {
                const summary = await getMessagesSummaryFromReadModels(guildId, startDate);
                if (summary) {
                    messagesSummaryAvailable = true;
                    topChannels = summary.topChannels;
                    topMembers = summary.topMembers;
                    uniqueUsers = summary.uniqueUsers;
                    uniqueChannels = summary.uniqueChannels;
                    totalMessagesValue = summary.totalValue;
                }
            }

            if (isHourly || (!messagesSummaryAvailable && topChannels.length === 0 && topMembers.length === 0 && uniqueUsers === 0 && uniqueChannels === 0 && totalMessagesValue === 0)) {
                const periodKey = getStatsPeriodKey(period);
                const validPeriods = ['24H', '3D', '7D', '14D', '30D', '90D', '180D', 'ALL'];
                const usePreCalc = validPeriods.includes(periodKey) && periodKey !== '24H';

                if (usePreCalc) {
                    const [topChRaw, topMemRaw] = await Promise.all([
                        statsPrisma.statTopChannel.findMany({ where: { guildId, period: periodKey, category: 'MESSAGES' }, orderBy: { value: 'desc' }, take: 20 }),
                        statsPrisma.statTopMember.findMany({ where: { guildId, period: periodKey, category: 'MESSAGES' }, orderBy: { value: 'desc' }, take: 20 })
                    ]);
                    topChannels = topChRaw.map(t => ({ channelId: t.channelId, value: t.value }));
                    topMembers = topMemRaw.map(t => ({ userId: t.userId, value: t.value }));

                    const [distinctChannelsObj, distinctMembersObj] = await Promise.all([
                        statsPrisma.$queryRaw<{count: number}[]>`
                            SELECT COUNT(DISTINCT "channelId") as count
                            FROM "StatMessage"
                            WHERE "guildId" = ${guildId}
                              AND "createdAt" >= ${startDate}
                        `,
                        statsPrisma.$queryRaw<{count: number}[]>`
                            SELECT COUNT(DISTINCT "authorId") as count
                            FROM "StatMessage"
                            WHERE "guildId" = ${guildId}
                              AND "createdAt" >= ${startDate}
                        `
                    ]);
                    uniqueUsers = Number(distinctMembersObj[0]?.count || 0);
                    uniqueChannels = Number(distinctChannelsObj[0]?.count || 0);
                } else {
                    const allMsgs = await getMergedMessages(guildId, startDate);
                    const channelCountMap = new Map<string, number>();
                    const memberCountMap = new Map<string, number>();
                    for (const m of allMsgs) {
                        channelCountMap.set(m.channelId, (channelCountMap.get(m.channelId) || 0) + 1);
                        memberCountMap.set(m.authorId, (memberCountMap.get(m.authorId) || 0) + 1);
                    }
                    topChannels = Array.from(channelCountMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 20).map(([id, v]) => ({ channelId: id, value: v }));
                    topMembers = Array.from(memberCountMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 20).map(([id, v]) => ({ userId: id, value: v }));
                    uniqueUsers = memberCountMap.size;
                    uniqueChannels = channelCountMap.size;
                }

                const totals = await getTotalValue(guildId, 'MESSAGES', startDate);
                totalMessagesValue = totals.totalChannels;
            } else {
                // no-op, read-model summary already filled
            }


            // Enrich with Discord names/avatars
            const enriched = await enrichTopData(guildId, topChannels, topMembers, 'MESSAGES');

            responseData = {
                lineChart,
                heatmap: hourlyStats.map(h => ({ date: h.dateHour, count: h.messages })),
                topChannels: enriched.topChannels,
                topMembers: enriched.topMembers,
                totalChannelValue: totalMessagesValue,
                totalMemberValue: totalMessagesValue,
                uniqueUsers,
                uniqueChannels
            };
        }

        // 3. Voice Data
        else if (type === 'voice') {
            let areaChart: any[] = [];
            if (isHourly) {
                const hourly = await statsPrisma.statHourly.findMany({
                    where: { guildId, dateHour: { gte: startDate } },
                    orderBy: { dateHour: 'asc' }
                });
                areaChart = hourly.map(h => ({ date: formatStatsBucketLabel(h.dateHour, period, timezone), voice: Math.floor(h.voiceSeconds / 60) }));
            } else {
                try {
                    const dailyRows = await statsPrisma.statChannelDaily.groupBy({
                        by: ['date'],
                        where: { guildId, date: { gte: startDate } },
                        _sum: { voiceSeconds: true },
                        orderBy: { date: 'asc' },
                    });
                    areaChart = dailyRows.map((row) => ({
                        date: formatStatsBucketLabel(row.date, period, timezone),
                        voice: Math.floor((row._sum.voiceSeconds || 0) / 60),
                    }));
                } catch (error) {
                    if (!isMissingTableError(error)) {
                        throw error;
                    }

                    const daily = await statsPrisma.statDaily.findMany({
                        where: { guildId, date: { gte: startDate } },
                        orderBy: { date: 'asc' },
                        select: { date: true, voiceSeconds: true }
                    });

                    areaChart = mergeBucketSeries(
                        daily,
                        (row) => row.date,
                        (row) => ({ voiceSeconds: row.voiceSeconds }),
                        period,
                        timezone
                    ).map((row) => ({
                        date: row.date,
                        voice: Math.floor(Number(row.voiceSeconds || 0) / 60),
                    }));
                }
            }

            if (!isHourly && areaChart.length > 0) {
                areaChart = enrichWithMedian(areaChart, 'voice');
            }

            let topChannels: { channelId: string, value: number }[] = [];
            let topMembers: { userId: string, value: number }[] = [];
            let uniqueUsers = 0;
            let uniqueChannels = 0;
            let totalVoiceValue = 0;

            let voiceSummaryAvailable = false;
            if (!isHourly) {
                const summary = await getVoiceSummaryFromReadModels(guildId, startDate);
                if (summary) {
                    voiceSummaryAvailable = true;
                    topChannels = summary.topChannels;
                    topMembers = summary.topMembers;
                    uniqueUsers = summary.uniqueUsers;
                    uniqueChannels = summary.uniqueChannels;
                    totalVoiceValue = summary.totalValue;
                }
            }

            if (isHourly || (!voiceSummaryAvailable && topChannels.length === 0 && topMembers.length === 0 && uniqueUsers === 0 && uniqueChannels === 0 && totalVoiceValue === 0)) {
                const periodKey = period.toUpperCase();
                const validPeriods = ['24H', '3D', '7D', '14D', '30D', '90D', '180D', 'ALL'];
                const usePreCalc = validPeriods.includes(periodKey) && periodKey !== '24H';

                if (usePreCalc) {
                    const [topChRaw, topMemRaw] = await Promise.all([
                        statsPrisma.statTopChannel.findMany({ where: { guildId, period: periodKey, category: 'VOICE' }, orderBy: { value: 'desc' }, take: 20 }),
                        statsPrisma.statTopMember.findMany({ where: { guildId, period: periodKey, category: 'VOICE' }, orderBy: { value: 'desc' }, take: 20 })
                    ]);
                    topChannels = topChRaw.map(t => ({ channelId: t.channelId, value: t.value }));
                    topMembers = topMemRaw.map(t => ({ userId: t.userId, value: t.value }));

                    const [distinctVChObj, distinctVMemObj] = await Promise.all([
                        statsPrisma.$queryRaw<{count: number}[]>`
                            SELECT COUNT(DISTINCT "channelId") as count
                            FROM "StatVoiceState"
                            WHERE "guildId" = ${guildId}
                              AND ("leftAt" >= ${startDate} OR ("leftAt" IS NULL AND "joinedAt" >= ${startDate}))
                        `,
                        statsPrisma.$queryRaw<{count: number}[]>`
                            SELECT COUNT(DISTINCT "userId") as count
                            FROM "StatVoiceState"
                            WHERE "guildId" = ${guildId}
                              AND ("leftAt" >= ${startDate} OR ("leftAt" IS NULL AND "joinedAt" >= ${startDate}))
                        `
                    ]);
                    uniqueUsers = Number(distinctVMemObj[0]?.count || 0);
                    uniqueChannels = Number(distinctVChObj[0]?.count || 0);
                } else {
                    const allVoice = await getMergedVoice(guildId, startDate);
                    const vcDurMap = new Map<string, number>();
                    const vmDurMap = new Map<string, number>();
                    for (const v of allVoice) {
                        const dur = getVoiceSessionDurationSeconds(v, now);
                        vcDurMap.set(v.channelId, (vcDurMap.get(v.channelId) || 0) + dur);
                        vmDurMap.set(v.userId, (vmDurMap.get(v.userId) || 0) + dur);
                    }
                    topChannels = Array.from(vcDurMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 20).map(([id, v]) => ({ channelId: id, value: v }));
                    topMembers = Array.from(vmDurMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 20).map(([id, v]) => ({ userId: id, value: v }));
                    uniqueUsers = vmDurMap.size;
                    uniqueChannels = vcDurMap.size;
                }

                const totals = await getTotalValue(guildId, 'VOICE', startDate);
                totalVoiceValue = totals.totalChannels;
            } else {
                // no-op, read-model summary already filled
            }

            // Peak hour estimation
            const hourlyStats = await statsPrisma.statHourly.findMany({
                where: { guildId, dateHour: { gte: startDate } }
            });
            const hourlyTotals = new Array(24).fill(0);
            for (const h of hourlyStats) {
                const hour = getStatsHourOfDay(h.dateHour, timezone);
                hourlyTotals[hour] += h.voiceSeconds;
            }
            const peakHourIndex = hourlyTotals.indexOf(Math.max(...hourlyTotals));
            const peakHour = `${peakHourIndex.toString().padStart(2, '0')}:00`;

            // Average session: compute via SQL directly to avoid loading all sessions in Node JS
            const avgRes = isStatsPostgres
                ? await statsPrisma.$queryRaw<any[]>`
                    SELECT AVG(
                        COALESCE(
                            "duration",
                            CAST(EXTRACT(EPOCH FROM (COALESCE("leftAt", NOW()) - "joinedAt")) AS INTEGER)
                        )
                    ) as avg
                    FROM "StatVoiceState"
                    WHERE "guildId" = ${guildId}
                      AND ("leftAt" >= ${startDate} OR ("leftAt" IS NULL AND "joinedAt" >= ${startDate}))
                `
                : await statsPrisma.$queryRaw<any[]>`
                    SELECT AVG(
                        COALESCE(
                            duration,
                            CAST(strftime('%s', COALESCE(leftAt, datetime('now'))) - strftime('%s', joinedAt) AS INTEGER)
                        )
                    ) as avg
                    FROM "StatVoiceState"
                    WHERE "guildId" = ${guildId}
                      AND ("leftAt" >= ${startDate} OR ("leftAt" IS NULL AND "joinedAt" >= ${startDate}))
                `;
            let avgSession = Math.floor(Number(avgRes[0]?.avg || 0));


            // Enrich with Discord names/avatars
            const enriched = await enrichTopData(guildId, topChannels, topMembers, 'VOICE');
            responseData = {
                areaChart,
                heatmap: hourlyStats.map(h => ({ date: h.dateHour, voice: h.voiceSeconds })),
                topChannels: enriched.topChannels,
                topMembers: enriched.topMembers,
                totalChannelValue: totalVoiceValue,
                totalMemberValue: totalVoiceValue,
                avgSession,
                peakHour,
                uniqueUsers,
                uniqueChannels
            };
        }

        // 4. Members Data
        else if (type === 'members') {
            const dailyStatsRaw = await statsPrisma.statDaily.findMany({
                where: { guildId, date: { gte: startDate } },
                orderBy: { date: 'asc' },
                select: { date: true, newMembers: true, leftMembers: true }
            });

            const dailyStats = mergeBucketSeries(
                dailyStatsRaw,
                (row) => row.date,
                (row) => ({
                    newMembers: row.newMembers,
                    leftMembers: row.leftMembers,
                }),
                period,
                timezone
            ).map((row) => ({
                label: row.date,
                newMembers: Number(row.newMembers || 0),
                leftMembers: Number(row.leftMembers || 0),
            }));

            // Get total member count from main Guild table (most accurate real-time value)
            const guildRecord = await prisma.guild.findUnique({ where: { id: guildId }, select: { memberCount: true } });
            const currentTotal = guildRecord?.memberCount || 0;

            const joined = dailyStats.reduce((sum, d) => sum + d.newMembers, 0);
            const left = dailyStats.reduce((sum, d) => sum + d.leftMembers, 0);

            let runningTotal = currentTotal;
            const reversedStats = [...dailyStats].reverse();
            const growthData: { date: string; count: number }[] = [];
            for (const d of reversedStats) {
                const label = d.label;
                growthData.unshift({ date: label, count: runningTotal });
                runningTotal = Math.max(0, runningTotal - d.newMembers + d.leftMembers);
            }

            // The value of runningTotal here is the member count *before* this period started
            const initialCount = runningTotal;

            const calcRatio = (val: number, base: number) => {
                if (base === 0) return val > 0 ? 100 : 0;
                return Math.round((val / base) * 1000) / 10;
            };

            const joinedTrend = calcRatio(joined, initialCount);
            const leftTrend = calcRatio(left, initialCount);
            const netChange = joined - left;
            const netTrend = calcRatio(netChange, initialCount);

            responseData = {
                growthChart: growthData,
                joinLeaveChart: dailyStats.map(d => {
                    return {
                        date: d.label,
                        joined: d.newMembers,
                        left: d.leftMembers
                    };
                }),
                stats: {
                    total: currentTotal,
                    new: joined,
                    left,
                    joinedTrend,
                    leftTrend,
                    netTrend
                }
            };
        }

        // 5. Activities Data
        else if (type === 'activities') {
            const activities = await statsPrisma.statActivity.findMany({
                where: {
                    guildId,
                    startTime: { gte: startDate }
                }
            });

            const activityMap = new Map<string, number>();

            for (const act of activities) {
                let duration = act.duration || 0;
                if (!duration && !act.endTime) {
                    // Active now
                    duration = Math.floor((Date.now() - act.startTime.getTime()) / 1000);
                }
                activityMap.set(act.name, (activityMap.get(act.name) || 0) + duration);
            }

            const sortedActivities = [...activityMap.entries()]
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10)
                .map(([name, value]) => ({
                    name,
                    seconds: value,
                    hours: Math.floor(value / 3600),
                    minutes: Math.floor((value % 3600) / 60)
                }));

            responseData = {
                topActivities: sortedActivities
            };
        }



            return NextResponse.json(responseData);

        } catch (error) {
            console.error('[API_STATS_ERROR]', error);
            return NextResponse.json({ error: 'Failed to fetch statistics' }, { status: 500 });
        }
    });
}
