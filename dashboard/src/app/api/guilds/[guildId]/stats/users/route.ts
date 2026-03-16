import { NextRequest, NextResponse } from 'next/server';
import { prisma, statsPrisma } from '@/lib/prisma';
import { requireGuildStatsAccess } from '@/lib/statsAccess';
import { withStatsTelemetry } from '@/lib/statsTelemetry';
import {
    buildStatsBucketLabels,
    buildVoiceWhereClause,
    formatStatsBucketLabel,
    getStatsStartDate,
    getVoiceSessionBucketDate,
    getVoiceSessionDurationSeconds,
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

async function enrichUserInfo(guildId: string, userIds: string[]) {
    try {
        const res = await fetch(`${BOT_API_URL}/api/enrich`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ guildId, userIds, channelIds: [] })
        });
        if (!res.ok) return {};
        const data = await res.json();
        return data.users || {};
    } catch {
        return {};
    }
}

async function enrichChannelInfo(guildId: string, channelIds: string[]) {
    try {
        const res = await fetch(`${BOT_API_URL}/api/enrich`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ guildId, userIds: [], channelIds })
        });
        if (!res.ok) return {};
        const data = await res.json();
        return data.channels || {};
    } catch {
        return {};
    }
}

// Merge utils
async function getMergedMessages(guildId: string, filters: any = {}) {
    return statsPrisma.statMessage.findMany({ where: { guildId, ...filters } });
}

async function getMergedVoice(guildId: string, filters: any = {}) {
    return statsPrisma.statVoiceState.findMany({ where: { guildId, ...filters } });
}

async function getUsersFromReadModels(guildId: string, startDate: Date) {
    try {
        const [dailyRows, voiceSessionRows] = await Promise.all([
            statsPrisma.statMemberDaily.groupBy({
                by: ['userId'],
                where: {
                    guildId,
                    date: { gte: startDate },
                },
                _sum: {
                    messages: true,
                    voiceSeconds: true,
                },
            }),
            statsPrisma.statVoiceState.groupBy({
                by: ['userId'],
                where: {
                    guildId,
                    ...buildVoiceWhereClause(startDate),
                },
                _count: {
                    _all: true,
                },
            }),
        ]);

        const voiceSessionsByUser = new Map<string, number>();
        for (const row of voiceSessionRows) {
            voiceSessionsByUser.set(row.userId, row._count._all);
        }

        return dailyRows.map((row) => ({
            userId: row.userId,
            messages: row._sum.messages || 0,
            voiceSeconds: row._sum.voiceSeconds || 0,
            voiceSessions: voiceSessionsByUser.get(row.userId) || 0,
        }));
    } catch (error) {
        if (isMissingTableError(error)) {
            return null;
        }
        throw error;
    }
}

async function getGuildStatsTimezone(guildId: string): Promise<string> {
    const settings = await prisma.botSettings.findUnique({
        where: { guildId },
        select: { timezone: true },
    });

    return settings?.timezone || 'UTC';
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ guildId: string }> }
) {
    const { guildId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    const tab = searchParams.get('tab') || 'overview'; // overview | messages | voice
    const period = normalizeStatsPeriod(searchParams.get('period') || '30d');
    return withStatsTelemetry({ guildId, endpoint: userId ? `users:${tab}` : 'users:list', method: 'GET', period }, async () => {
        const access = await requireGuildStatsAccess(request, guildId);
        if (!access.ok) {
            return access.response;
        }

        const now = new Date();
        const startDate = getStatsStartDate(period, now);

        try {
            const timezone = await getGuildStatsTimezone(guildId);

        // --- MODE 1: List users with activity ---
        if (!userId) {
            const readModelRows = await getUsersFromReadModels(guildId, startDate);

            let usersBase: Array<{ userId: string; messages: number; voiceSessions: number; voiceSeconds: number }>;
            if (readModelRows && readModelRows.length > 0) {
                usersBase = readModelRows;
            } else {
                const allMsgs = await getMergedMessages(guildId, { createdAt: { gte: startDate } });
                const allVoice = await getMergedVoice(guildId, buildVoiceWhereClause(startDate));

                const userMsgMap = new Map<string, number>();
                const userVoiceSecondsMap = new Map<string, number>();
                const userVoiceSessionsMap = new Map<string, number>();

                for (const m of allMsgs) {
                    userMsgMap.set(m.authorId, (userMsgMap.get(m.authorId) || 0) + 1);
                }
                for (const v of allVoice) {
                    const dur = getVoiceSessionDurationSeconds(v, now);
                    userVoiceSecondsMap.set(v.userId, (userVoiceSecondsMap.get(v.userId) || 0) + dur);
                    userVoiceSessionsMap.set(v.userId, (userVoiceSessionsMap.get(v.userId) || 0) + 1);
                }

                const allUserIds = [...new Set([...userMsgMap.keys(), ...userVoiceSecondsMap.keys()])];
                usersBase = allUserIds.map((id) => ({
                    userId: id,
                    messages: userMsgMap.get(id) || 0,
                    voiceSessions: userVoiceSessionsMap.get(id) || 0,
                    voiceSeconds: userVoiceSecondsMap.get(id) || 0,
                }));
            }

            const allUserIds = usersBase.map((user) => user.userId);
            const usersInfo = await enrichUserInfo(guildId, allUserIds);

            const users = usersBase.map((user) => {
                const info = usersInfo[user.userId];
                return {
                    userId: user.userId,
                    name: info?.name || user.userId,
                    username: info?.username || null,
                    tag: info?.tag || null,
                    avatar: info?.avatar || null,
                    messages: user.messages,
                    voiceSessions: user.voiceSessions,
                    voiceSeconds: user.voiceSeconds,
                };
            });

            // Sort by total activity
            users.sort((a, b) => (b.messages + b.voiceSessions) - (a.messages + a.voiceSessions));

            return NextResponse.json({ users });
        }

        // --- MODE 2: User Drilldown ---
        const fmt = (d: Date) => formatStatsBucketLabel(d, period, timezone);

        // Enrich user info
        const usersInfo = await enrichUserInfo(guildId, [userId]);
        const userMeta = usersInfo[userId] || { name: userId, avatar: null };

        if (tab === 'overview') {
            const allMsgs = await getMergedMessages(guildId, { authorId: userId, createdAt: { gte: startDate } });
            const allVoice = await getMergedVoice(guildId, { userId, ...buildVoiceWhereClause(startDate) });

            // Stats from merged data
            const totalMessages = allMsgs.length;
            const uniqueMsgChannels = new Set(allMsgs.map((m: any) => m.channelId)).size;
            const totalVoiceSeconds = allVoice.reduce((s: number, v: any) => s + getVoiceSessionDurationSeconds(v, now), 0);
            const voiceSessions = allVoice.length;
            const uniqueVoiceChannels = new Set(allVoice.map((v: any) => v.channelId)).size;

            // Most recent
            const sortedMsgs = [...allMsgs].sort((a: any, b: any) => b.createdAt.getTime() - a.createdAt.getTime());
            const sortedVoice = [...allVoice].sort((a: any, b: any) =>
                getVoiceSessionBucketDate(b, now).getTime() - getVoiceSessionBucketDate(a, now).getTime()
            );

            // Top message channel
            const msgChanMap = new Map<string, number>();
            for (const m of allMsgs) msgChanMap.set(m.channelId, (msgChanMap.get(m.channelId) || 0) + 1);
            const topMsgChannelEntry = Array.from(msgChanMap.entries()).sort((a, b) => b[1] - a[1])[0];

            // Top voice channel
            const voiceChanMap = new Map<string, number>();
            for (const v of allVoice) {
                voiceChanMap.set(v.channelId, (voiceChanMap.get(v.channelId) || 0) + getVoiceSessionDurationSeconds(v, now));
            }
            const topVoiceChannelEntry = Array.from(voiceChanMap.entries()).sort((a, b) => b[1] - a[1])[0];

            const channelIdsToEnrich = [
                topMsgChannelEntry?.[0],
                topVoiceChannelEntry?.[0],
                sortedMsgs[0]?.channelId,
                sortedVoice[0]?.channelId
            ].filter(Boolean) as string[];
            const channelsInfo = channelIdsToEnrich.length > 0 ? await enrichChannelInfo(guildId, [...new Set(channelIdsToEnrich)]) : {};

            return NextResponse.json({
                user: userMeta,
                overview: {
                    totalMessages,
                    uniqueMessageChannels: uniqueMsgChannels,
                    totalVoiceSeconds,
                    voiceSessions,
                    uniqueVoiceChannels,
                    avgMessagesPerDay: Math.round(totalMessages / Math.max(1, Math.ceil((now.getTime() - startDate.getTime()) / 86400000))),
                    topMessageChannel: topMsgChannelEntry ? {
                        channelId: topMsgChannelEntry[0],
                        name: channelsInfo[topMsgChannelEntry[0]]?.name || topMsgChannelEntry[0],
                        value: topMsgChannelEntry[1]
                    } : null,
                    topVoiceChannel: topVoiceChannelEntry ? {
                        channelId: topVoiceChannelEntry[0],
                        name: channelsInfo[topVoiceChannelEntry[0]]?.name || topVoiceChannelEntry[0],
                        value: topVoiceChannelEntry[1]
                    } : null,
                    mostRecentMessage: sortedMsgs[0] ? {
                        date: sortedMsgs[0].createdAt,
                        channelId: sortedMsgs[0].channelId,
                        channelName: channelsInfo[sortedMsgs[0].channelId]?.name || sortedMsgs[0].channelId,
                    } : null,
                    mostRecentVoice: sortedVoice[0] ? {
                        date: getVoiceSessionBucketDate(sortedVoice[0], now),
                        channelId: sortedVoice[0].channelId,
                        channelName: channelsInfo[sortedVoice[0].channelId]?.name || sortedVoice[0].channelId,
                    } : null,
                }
            });
        }

        if (tab === 'messages') {
            const allMsgs = await getMergedMessages(guildId, { authorId: userId, createdAt: { gte: startDate } });
            allMsgs.sort((a: any, b: any) => a.createdAt.getTime() - b.createdAt.getTime());

            const dailyMap = new Map<string, number>();

            for (const label of buildStatsBucketLabels(startDate, now, period, timezone)) {
                dailyMap.set(label, 0);
            }

            for (const msg of allMsgs) {
                const key = fmt(msg.createdAt);
                dailyMap.set(key, (dailyMap.get(key) || 0) + 1);
            }
            const chart = Array.from(dailyMap.entries()).map(([date, count]) => ({ date, messages: count }));

            const channelBreakdownMap = new Map<string, number>();
            for (const m of allMsgs) channelBreakdownMap.set(m.channelId, (channelBreakdownMap.get(m.channelId) || 0) + 1);
            const sortedChannels = Array.from(channelBreakdownMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 20);
            const channelIds = sortedChannels.map(([id]) => id);
            const channelsInfo = channelIds.length > 0 ? await enrichChannelInfo(guildId, channelIds) : {};

            const totalMessages = allMsgs.length;
            const channels = sortedChannels.map(([channelId, count], i) => ({
                rank: i + 1,
                channelId,
                name: channelsInfo[channelId]?.name || channelId,
                messages: count,
                percentage: totalMessages > 0 ? Math.round(count / totalMessages * 10000) / 100 : 0
            }));

            return NextResponse.json({ user: userMeta, chart, totalMessages, channels });
        }

        if (tab === 'voice') {
            const allVoice = await getMergedVoice(guildId, { userId, ...buildVoiceWhereClause(startDate) });
            allVoice.sort((a: any, b: any) => {
                const aEnd = getVoiceSessionBucketDate(a, now).getTime();
                const bEnd = getVoiceSessionBucketDate(b, now).getTime();
                return aEnd - bEnd;
            });

            const dailyMap = new Map<string, number>();

            for (const label of buildStatsBucketLabels(startDate, now, period, timezone)) {
                dailyMap.set(label, 0);
            }

            for (const v of allVoice) {
                const dur = getVoiceSessionDurationSeconds(v, now);
                const key = fmt(getVoiceSessionBucketDate(v, now));
                dailyMap.set(key, (dailyMap.get(key) || 0) + dur);
            }
            const chart = Array.from(dailyMap.entries()).map(([date, seconds]) => ({
                date,
                voiceMinutes: Math.floor(seconds / 60)
            }));

            const chanDurMap = new Map<string, number>();
            for (const v of allVoice) {
                const dur = getVoiceSessionDurationSeconds(v, now);
                chanDurMap.set(v.channelId, (chanDurMap.get(v.channelId) || 0) + dur);
            }
            const sortedChannels = Array.from(chanDurMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 20);
            const channelIds = sortedChannels.map(([id]) => id);
            const channelsInfo = channelIds.length > 0 ? await enrichChannelInfo(guildId, channelIds) : {};
            const totalSeconds = allVoice.reduce((s: number, v: any) => s + getVoiceSessionDurationSeconds(v, now), 0);

            const channels = sortedChannels.map(([channelId, voiceSeconds], i) => ({
                rank: i + 1,
                channelId,
                name: channelsInfo[channelId]?.name || channelId,
                voiceSeconds,
                percentage: totalSeconds > 0 ? Math.round(voiceSeconds / totalSeconds * 10000) / 100 : 0
            }));

            return NextResponse.json({ user: userMeta, chart, totalSeconds, channels });
        }

            return NextResponse.json({ error: 'Invalid tab' }, { status: 400 });
        } catch (error) {
            console.error('[User Drilldown] Error:', error);
            return NextResponse.json({ error: 'Internal error' }, { status: 500 });
        }
    });
}
