import { NextRequest, NextResponse } from 'next/server';
import { prisma, statsPrisma } from '@/lib/prisma';

const BOT_API_URL = process.env.BOT_API_URL || 'http://127.0.0.1:3002';

// Patch BigInt serialization for JSON
(BigInt.prototype as any).toJSON = function () {
    return this.toString();
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
    const [a, b] = await Promise.all([
        statsPrisma.statMessage.findMany({ where: { guildId, createdAt: { gte: startDate } } }),
        prisma.statMessage.findMany({ where: { guildId, createdAt: { gte: startDate } } }),
    ]);
    const map = new Map<number, any>();
    for (const m of a) map.set(m.id, m);
    for (const m of b) map.set(m.id, m);
    return Array.from(map.values());
}

async function getMergedVoice(guildId: string, startDate: Date) {
    const [a, b] = await Promise.all([
        statsPrisma.statVoiceState.findMany({
            where: { guildId, OR: [{ leftAt: { gte: startDate } }, { leftAt: null, joinedAt: { gte: startDate } }] }
        }),
        prisma.statVoiceState.findMany({
            where: { guildId, OR: [{ leftAt: { gte: startDate } }, { leftAt: null, joinedAt: { gte: startDate } }] }
        }),
    ]);
    const map = new Map<number, any>();
    for (const v of a) map.set(v.id, v);
    for (const v of b) map.set(v.id, v);
    return Array.from(map.values());
}

// Calculate total for "Others" category
async function getTotalValue(
    guildId: string,
    category: 'MESSAGES' | 'VOICE',
    startDate: Date
): Promise<{ totalChannels: number; totalMembers: number }> {
    if (category === 'MESSAGES') {
        const msgs = await getMergedMessages(guildId, startDate);
        const channels = new Set(msgs.map(m => m.channelId)).size;
        const members = new Set(msgs.map((m: any) => m.authorId)).size;
        return { totalChannels: channels, totalMembers: msgs.length };
    } else {
        const voice = await getMergedVoice(guildId, startDate);
        const channelTotals = new Map<string, number>();
        const memberTotals = new Map<string, number>();
        for (const v of voice) {
            const dur = v.duration || (v.leftAt ? Math.floor((v.leftAt.getTime() - v.joinedAt.getTime()) / 1000) : 0);
            channelTotals.set(v.channelId, (channelTotals.get(v.channelId) || 0) + dur);
            memberTotals.set(v.userId, (memberTotals.get(v.userId) || 0) + dur);
        }
        return {
            totalChannels: Array.from(channelTotals.values()).reduce((s, v) => s + v, 0),
            totalMembers: Array.from(memberTotals.values()).reduce((s, v) => s + v, 0)
        };
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

    console.log('[API-DEBUG] Request:', { guildId, type, url: process.env.DATABASE_URL });

    const period = searchParams.get('period') || '7d';
    const isHourly = period === '24h';

    const fmt = (d: Date) => {
        const dd = d.getDate().toString().padStart(2, '0');
        const mm = (d.getMonth() + 1).toString().padStart(2, '0');
        const yyyy = d.getFullYear();

        if (period === '24h') return d.toISOString().substring(11, 16);
        return `${dd}.${mm}.${yyyy}`;
    };

    // Calculate Date Range
    const now = new Date();
    const startDate = new Date();

    switch (period) {
        case '24h': startDate.setDate(now.getDate() - 1); break;
        case '3d': startDate.setDate(now.getDate() - 3); break;
        case '7d': startDate.setDate(now.getDate() - 7); break;
        case '14d': startDate.setDate(now.getDate() - 14); break;
        case '30d': startDate.setDate(now.getDate() - 30); break;
        case '90d': startDate.setDate(now.getDate() - 90); break;
        case '365d': startDate.setFullYear(now.getFullYear() - 1); break;
        case 'all': startDate.setFullYear(2000); break; // far past
        default: startDate.setDate(now.getDate() - 7); break;
    }

    try {
        let responseData: any = {};
        const debugInfo = {
            url: process.env.DATABASE_URL,
            startDate: startDate.toISOString(),
            guildId,
            period,
            type
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
                    date: fmt(h.dateHour),
                    messages: h.messages,
                    voice: Math.floor(h.voiceSeconds / 60)
                }));
            } else {
                const dailyStats = await statsPrisma.statDaily.findMany({
                    where: { guildId, date: { gte: startDate } },
                    orderBy: { date: 'asc' }
                });

                // Group by formatted date to avoid duplicates from different timezone buckets or sync overlap
                const grouped = new Map<string, any>();
                for (const d of dailyStats) {
                    const label = fmt(d.date);
                    if (grouped.has(label)) {
                        const existing = grouped.get(label);
                        existing.messages += d.messages;
                        existing.voiceSeconds += d.voiceSeconds;
                    } else {
                        grouped.set(label, { ...d, label });
                    }
                }

                totalMessages = dailyStats.reduce((sum, d) => sum + d.messages, 0);
                totalVoiceSeconds = dailyStats.reduce((sum, d) => sum + d.voiceSeconds, 0);
                activityData = Array.from(grouped.values()).map(d => ({
                    date: d.label,
                    messages: d.messages,
                    voice: Math.floor(d.voiceSeconds / 60) // minutes
                }));
            }

            // Always fetch daily for newMembers (as it's not in hourly)
            const dailyForMembers = await statsPrisma.statDaily.findMany({
                where: { guildId, date: { gte: startDate } },
                select: { newMembers: true }
            });
            const newMembers = dailyForMembers.reduce((sum, d) => sum + d.newMembers, 0);

            responseData = {
                cards: { totalMessages, totalVoiceSeconds, newMembers },
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
                lineChart = hourly.map(h => ({ date: fmt(h.dateHour), messages: h.messages }));
            } else {
                const daily = await statsPrisma.statDaily.findMany({
                    where: { guildId, date: { gte: startDate } },
                    orderBy: { date: 'asc' },
                    select: { date: true, messages: true }
                });

                const grouped = new Map<string, any>();
                for (const d of daily) {
                    const label = fmt(d.date);
                    if (grouped.has(label)) {
                        grouped.get(label).messages += d.messages;
                    } else {
                        grouped.set(label, { messages: d.messages, date: label });
                    }
                }
                lineChart = Array.from(grouped.values());
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

            // Top Channels
            const topChannelsRaw = await statsPrisma.statMessage.groupBy({
                by: ['channelId'],
                where: { guildId, createdAt: { gte: startDate } },
                _count: { id: true },
                orderBy: { _count: { id: 'desc' } },
                take: 10
            });
            // Top Channels + Members + Unique (merged from both DBs)
            const allMsgs = await getMergedMessages(guildId, startDate);

            const channelCountMap = new Map<string, number>();
            const memberCountMap = new Map<string, number>();
            for (const m of allMsgs) {
                channelCountMap.set(m.channelId, (channelCountMap.get(m.channelId) || 0) + 1);
                memberCountMap.set(m.authorId, (memberCountMap.get(m.authorId) || 0) + 1);
            }

            const topChannels = Array.from(channelCountMap.entries())
                .sort((a, b) => b[1] - a[1]).slice(0, 10)
                .map(([channelId, value]) => ({ channelId, value }));
            const topMembers = Array.from(memberCountMap.entries())
                .sort((a, b) => b[1] - a[1]).slice(0, 10)
                .map(([userId, value]) => ({ userId, value }));

            // Enrich with Discord names/avatars
            const enriched = await enrichTopData(guildId, topChannels, topMembers, 'MESSAGES');
            const totals = await getTotalValue(guildId, 'MESSAGES', startDate);

            responseData = {
                lineChart,
                heatmap: hourlyStats.map(h => ({ date: h.dateHour, count: h.messages })),
                topChannels: enriched.topChannels,
                topMembers: enriched.topMembers,
                totalChannelValue: totals.totalChannels,
                totalMemberValue: totals.totalMembers,
                uniqueUsers: memberCountMap.size,
                uniqueChannels: channelCountMap.size
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
                areaChart = hourly.map(h => ({ date: fmt(h.dateHour), voice: Math.floor(h.voiceSeconds / 60) }));
            } else {
                const daily = await statsPrisma.statDaily.findMany({
                    where: { guildId, date: { gte: startDate } },
                    orderBy: { date: 'asc' },
                    select: { date: true, voiceSeconds: true }
                });

                const grouped = new Map<string, any>();
                for (const d of daily) {
                    const label = fmt(d.date);
                    if (grouped.has(label)) {
                        grouped.get(label).voiceSeconds += d.voiceSeconds;
                    } else {
                        grouped.set(label, { voiceSeconds: d.voiceSeconds, date: label });
                    }
                }
                areaChart = Array.from(grouped.values()).map(d => ({
                    date: d.date,
                    voice: Math.floor(d.voiceSeconds / 60)
                }));
            }

            if (!isHourly && areaChart.length > 0) {
                areaChart = enrichWithMedian(areaChart, 'voice');
            }

            // Top Channels + Members + Unique (merged from both DBs)
            const allVoice = await getMergedVoice(guildId, startDate);

            const vcDurMap = new Map<string, number>();
            const vmDurMap = new Map<string, number>();
            for (const v of allVoice) {
                const dur = v.duration || (v.leftAt ? Math.floor((v.leftAt.getTime() - v.joinedAt.getTime()) / 1000) : 0);
                vcDurMap.set(v.channelId, (vcDurMap.get(v.channelId) || 0) + dur);
                vmDurMap.set(v.userId, (vmDurMap.get(v.userId) || 0) + dur);
            }

            const topChannels = Array.from(vcDurMap.entries())
                .sort((a, b) => b[1] - a[1]).slice(0, 10)
                .map(([channelId, value]) => ({ channelId, value }));
            const topMembers = Array.from(vmDurMap.entries())
                .sort((a, b) => b[1] - a[1]).slice(0, 10)
                .map(([userId, value]) => ({ userId, value }));

            // Calculate average session duration from merged voice data
            // Calculate average session duration
            const rawSessions = allVoice
                .filter(v => v.duration && v.duration > 0)
                .sort((a: any, b: any) => a.joinedAt.getTime() - b.joinedAt.getTime());

            // Reconstruct sessions from checkpoints
            let mergedSessionsCount = 0;
            let totalDurationReconstructed = 0;
            const userSessions = new Map<string, any[]>();

            for (const s of rawSessions) {
                if (!userSessions.has(s.userId)) userSessions.set(s.userId, []);
                userSessions.get(s.userId)!.push(s);
            }

            for (const sessions of userSessions.values()) {
                if (sessions.length === 0) continue;

                let currentStart = sessions[0].joinedAt.getTime();
                let currentEnd = currentStart + (sessions[0].duration || 0) * 1000;

                for (let i = 1; i < sessions.length; i++) {
                    const s = sessions[i];
                    const start = s.joinedAt.getTime();
                    const end = start + (s.duration || 0) * 1000;

                    // Merge if gap is less than 5 seconds (accounting for checkpoint jitter)
                    if (start <= currentEnd + 5000) {
                        if (end > currentEnd) currentEnd = end;
                    } else {
                        // End current session
                        mergedSessionsCount++;
                        totalDurationReconstructed += (currentEnd - currentStart) / 1000;

                        // Start new
                        currentStart = start;
                        currentEnd = end;
                    }
                }
                // Add last session
                mergedSessionsCount++;
                totalDurationReconstructed += (currentEnd - currentStart) / 1000;
            }

            const avgSession = mergedSessionsCount > 0 ? Math.floor(totalDurationReconstructed / mergedSessionsCount) : 0;

            // Calculate peak hour from hourly stats
            const hourlyStats = await statsPrisma.statHourly.findMany({
                where: { guildId, dateHour: { gte: startDate } }
            });
            const hourlyTotals = new Array(24).fill(0);
            for (const h of hourlyStats) {
                const hour = new Date(h.dateHour).getHours();
                hourlyTotals[hour] += h.voiceSeconds;
            }
            const peakHourIndex = hourlyTotals.indexOf(Math.max(...hourlyTotals));
            const peakHour = `${peakHourIndex.toString().padStart(2, '0')}:00`;


            // Enrich with Discord names/avatars
            const enriched = await enrichTopData(guildId, topChannels, topMembers, 'VOICE');
            const totals = await getTotalValue(guildId, 'VOICE', startDate);

            responseData = {
                areaChart,
                heatmap: hourlyStats.map(h => ({ date: h.dateHour, voice: h.voiceSeconds })),
                topChannels: enriched.topChannels,
                topMembers: enriched.topMembers,
                totalChannelValue: totals.totalChannels,
                totalMemberValue: totals.totalMembers,
                avgSession,
                peakHour,
                uniqueUsers: vmDurMap.size,
                uniqueChannels: vcDurMap.size
            };
        }

        // 4. Members Data
        else if (type === 'members') {
            const dailyStatsRaw = await statsPrisma.statDaily.findMany({
                where: { guildId, date: { gte: startDate } },
                orderBy: { date: 'asc' },
                select: { date: true, newMembers: true, leftMembers: true }
            });

            // Group by formatted date to avoid duplicates
            const grouped = new Map<string, any>();
            for (const d of dailyStatsRaw) {
                const label = fmt(d.date);
                if (grouped.has(label)) {
                    const e = grouped.get(label);
                    e.newMembers += d.newMembers;
                    e.leftMembers += d.leftMembers;
                } else {
                    grouped.set(label, { ...d, label });
                }
            }
            const dailyStats = Array.from(grouped.values());

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
}
