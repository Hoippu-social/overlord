import { NextRequest, NextResponse } from 'next/server';
import { prisma, statsPrisma } from '@/lib/prisma';

const BOT_API_URL = process.env.BOT_API_URL || 'http://127.0.0.1:3002';

// Patch BigInt serialization for JSON
(BigInt.prototype as any).toJSON = function () {
    return this.toString();
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
    const [a, b] = await Promise.all([
        statsPrisma.statMessage.findMany({ where: { guildId, ...filters } }),
        prisma.statMessage.findMany({ where: { guildId, ...filters } }),
    ]);
    const map = new Map<number, any>();
    for (const m of a) map.set(m.id, m);
    for (const m of b) map.set(m.id, m);
    return Array.from(map.values());
}

async function getMergedVoice(guildId: string, filters: any = {}) {
    const [a, b] = await Promise.all([
        statsPrisma.statVoiceState.findMany({ where: { guildId, ...filters } }),
        prisma.statVoiceState.findMany({ where: { guildId, ...filters } }),
    ]);
    const map = new Map<number, any>();
    for (const v of a) map.set(v.id, v);
    for (const v of b) map.set(v.id, v);
    return Array.from(map.values());
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ guildId: string }> }
) {
    const { guildId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    const tab = searchParams.get('tab') || 'overview'; // overview | messages | voice
    const period = searchParams.get('period') || '30d';

    // Calculate date range
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
        default: startDate.setDate(now.getDate() - 30); break;
    }

    try {
        // --- MODE 1: List users with activity ---
        if (!userId) {
            const allMsgs = await getMergedMessages(guildId, { createdAt: { gte: startDate } });
            const allVoice = await getMergedVoice(guildId, { joinedAt: { gte: startDate } });

            // Aggregate per user from merged data
            const userMsgMap = new Map<string, number>();
            const userVoiceSecondsMap = new Map<string, number>();
            const userVoiceSessionsMap = new Map<string, number>();

            for (const m of allMsgs) {
                userMsgMap.set(m.authorId, (userMsgMap.get(m.authorId) || 0) + 1);
            }
            for (const v of allVoice) {
                const dur = v.duration || (v.leftAt ? Math.floor((v.leftAt.getTime() - v.joinedAt.getTime()) / 1000) : 0);
                userVoiceSecondsMap.set(v.userId, (userVoiceSecondsMap.get(v.userId) || 0) + dur);
                userVoiceSessionsMap.set(v.userId, (userVoiceSessionsMap.get(v.userId) || 0) + 1);
            }

            const allUserIds = [...new Set([...userMsgMap.keys(), ...userVoiceSecondsMap.keys()])];
            const usersInfo = await enrichUserInfo(guildId, allUserIds);

            const users = allUserIds.map(id => {
                const info = usersInfo[id];
                return {
                    userId: id,
                    name: info?.name || id,
                    username: info?.username || null,
                    tag: info?.tag || null,
                    avatar: info?.avatar || null,
                    messages: userMsgMap.get(id) || 0,
                    voiceSessions: userVoiceSessionsMap.get(id) || 0,
                    voiceSeconds: userVoiceSecondsMap.get(id) || 0,
                };
            });

            // Sort by total activity
            users.sort((a, b) => (b.messages + b.voiceSessions) - (a.messages + a.voiceSessions));

            return NextResponse.json({ users });
        }

        // --- MODE 2: User Drilldown ---
        const fmt = (d: Date) => {
            if (period === '24h') return d.toISOString().substring(11, 13) + ':00';
            const dd = d.getDate().toString().padStart(2, '0');
            const mm = (d.getMonth() + 1).toString().padStart(2, '0');
            const yyyy = d.getFullYear();
            return `${dd}.${mm}.${yyyy}`;
        };

        // Enrich user info
        const usersInfo = await enrichUserInfo(guildId, [userId]);
        const userMeta = usersInfo[userId] || { name: userId, avatar: null };

        if (tab === 'overview') {
            const allMsgs = await getMergedMessages(guildId, { authorId: userId, createdAt: { gte: startDate } });
            const allVoice = await getMergedVoice(guildId, { userId, joinedAt: { gte: startDate } });

            // Stats from merged data
            const totalMessages = allMsgs.length;
            const uniqueMsgChannels = new Set(allMsgs.map((m: any) => m.channelId)).size;
            const totalVoiceSeconds = allVoice.reduce((s: number, v: any) => s + (v.duration || (v.leftAt ? Math.floor((v.leftAt.getTime() - v.joinedAt.getTime()) / 1000) : 0)), 0);
            const voiceSessions = allVoice.length;
            const uniqueVoiceChannels = new Set(allVoice.map((v: any) => v.channelId)).size;

            // Most recent
            const sortedMsgs = [...allMsgs].sort((a: any, b: any) => b.createdAt.getTime() - a.createdAt.getTime());
            const sortedVoice = [...allVoice].sort((a: any, b: any) => b.joinedAt.getTime() - a.joinedAt.getTime());

            // Top message channel
            const msgChanMap = new Map<string, number>();
            for (const m of allMsgs) msgChanMap.set(m.channelId, (msgChanMap.get(m.channelId) || 0) + 1);
            const topMsgChannelEntry = Array.from(msgChanMap.entries()).sort((a, b) => b[1] - a[1])[0];

            // Top voice channel
            const voiceChanMap = new Map<string, number>();
            for (const v of allVoice) voiceChanMap.set(v.channelId, (voiceChanMap.get(v.channelId) || 0) + (v.duration || 0));
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
                        date: sortedVoice[0].joinedAt,
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

            // Pre-fill empty dates
            let curr = new Date(startDate);
            if (period === '24h') curr.setMinutes(0, 0, 0);
            else curr.setHours(0, 0, 0, 0);
            while (curr <= now) {
                dailyMap.set(fmt(curr), 0);
                if (period === '24h') curr.setHours(curr.getHours() + 1);
                else curr.setDate(curr.getDate() + 1);
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
            const allVoice = await getMergedVoice(guildId, { userId, joinedAt: { gte: startDate } });
            allVoice.sort((a: any, b: any) => a.joinedAt.getTime() - b.joinedAt.getTime());

            const dailyMap = new Map<string, number>();

            // Pre-fill empty dates
            let curr = new Date(startDate);
            if (period === '24h') curr.setMinutes(0, 0, 0);
            else curr.setHours(0, 0, 0, 0);
            while (curr <= now) {
                dailyMap.set(fmt(curr), 0);
                if (period === '24h') curr.setHours(curr.getHours() + 1);
                else curr.setDate(curr.getDate() + 1);
            }

            for (const v of allVoice) {
                const dur = v.duration || (v.leftAt ? Math.floor((v.leftAt.getTime() - v.joinedAt.getTime()) / 1000) : 0);
                const key = fmt(v.joinedAt);
                dailyMap.set(key, (dailyMap.get(key) || 0) + dur);
            }
            const chart = Array.from(dailyMap.entries()).map(([date, seconds]) => ({
                date,
                voiceMinutes: Math.floor(seconds / 60)
            }));

            const chanDurMap = new Map<string, number>();
            for (const v of allVoice) {
                const dur = v.duration || 0;
                chanDurMap.set(v.channelId, (chanDurMap.get(v.channelId) || 0) + dur);
            }
            const sortedChannels = Array.from(chanDurMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 20);
            const channelIds = sortedChannels.map(([id]) => id);
            const channelsInfo = channelIds.length > 0 ? await enrichChannelInfo(guildId, channelIds) : {};
            const totalSeconds = allVoice.reduce((s: number, v: any) => s + (v.duration || (v.leftAt ? Math.floor((v.leftAt.getTime() - v.joinedAt.getTime()) / 1000) : 0)), 0);

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
}
