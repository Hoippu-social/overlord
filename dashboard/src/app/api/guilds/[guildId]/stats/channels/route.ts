import { NextRequest, NextResponse } from 'next/server';
import { prisma, statsPrisma } from '@/lib/prisma';

const BOT_API_URL = process.env.BOT_API_URL || 'http://127.0.0.1:3002';

// Patch BigInt serialization for JSON
(BigInt.prototype as any).toJSON = function () {
    return this.toString();
};

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
    const channelId = searchParams.get('channelId');
    const tab = searchParams.get('tab') || 'overview';
    const period = searchParams.get('period') || '30d';

    const now = new Date();
    const startDate = new Date();
    switch (period) {
        case '24h': startDate.setDate(now.getDate() - 1); break;
        case '3d': startDate.setDate(now.getDate() - 3); break;
        case '7d': startDate.setDate(now.getDate() - 7); break;
        case '30d': startDate.setDate(now.getDate() - 30); break;
        case '90d': startDate.setDate(now.getDate() - 90); break;
        case '365d': startDate.setFullYear(now.getFullYear() - 1); break;
        default: startDate.setDate(now.getDate() - 30); break;
    }

    try {
        // --- MODE 1: List channels ---
        if (!channelId) {
            const allMsgs = await getMergedMessages(guildId, { createdAt: { gte: startDate } });
            const allVoice = await getMergedVoice(guildId, { joinedAt: { gte: startDate } });

            const chanMsgMap = new Map<string, number>();
            const chanVoiceSecsMap = new Map<string, number>();
            const chanVoiceSessionsMap = new Map<string, number>();

            for (const m of allMsgs) chanMsgMap.set(m.channelId, (chanMsgMap.get(m.channelId) || 0) + 1);
            for (const v of allVoice) {
                const dur = v.duration || (v.leftAt ? Math.floor((v.leftAt.getTime() - v.joinedAt.getTime()) / 1000) : 0);
                chanVoiceSecsMap.set(v.channelId, (chanVoiceSecsMap.get(v.channelId) || 0) + dur);
                chanVoiceSessionsMap.set(v.channelId, (chanVoiceSessionsMap.get(v.channelId) || 0) + 1);
            }

            const allChannelIds = [...new Set([...chanMsgMap.keys(), ...chanVoiceSecsMap.keys()])];
            const channelInfo = await enrichChannelInfo(guildId, allChannelIds);

            const channels = allChannelIds.map(id => {
                const info = channelInfo[id];
                return {
                    channelId: id,
                    name: info?.name || id,
                    type: info?.type || 'unknown',
                    messages: chanMsgMap.get(id) || 0,
                    voiceSessions: chanVoiceSessionsMap.get(id) || 0,
                    voiceSeconds: chanVoiceSecsMap.get(id) || 0,
                };
            });

            channels.sort((a, b) => (b.messages + b.voiceSessions) - (a.messages + a.voiceSessions));
            return NextResponse.json({ channels });
        }

        // --- MODE 2: Channel Drilldown ---
        const fmt = (d: Date) => {
            if (period === '24h') return d.toISOString().substring(11, 16);
            return d.toISOString().split('T')[0];
        };

        const channelInfo = await enrichChannelInfo(guildId, [channelId]);
        const channelMeta = channelInfo[channelId] || { name: channelId, type: 'unknown' };

        if (tab === 'overview') {
            const allMsgs = await getMergedMessages(guildId, { channelId, createdAt: { gte: startDate } });
            const allVoice = await getMergedVoice(guildId, { channelId, joinedAt: { gte: startDate } });

            const totalMessages = allMsgs.length;
            const uniqueMessageMembers = new Set(allMsgs.map((m: any) => m.authorId)).size;
            const totalVoiceSeconds = allVoice.reduce((s: number, v: any) => s + (v.duration || (v.leftAt ? Math.floor((v.leftAt.getTime() - v.joinedAt.getTime()) / 1000) : 0)), 0);
            const voiceSessions = allVoice.length;
            const uniqueVoiceMembers = new Set(allVoice.map((v: any) => v.userId)).size;

            const sortedMsgs = [...allMsgs].sort((a: any, b: any) => b.createdAt.getTime() - a.createdAt.getTime());
            const sortedVoice = [...allVoice].sort((a: any, b: any) => b.joinedAt.getTime() - a.joinedAt.getTime());

            const memberMsgMap = new Map<string, number>();
            for (const m of allMsgs) memberMsgMap.set(m.authorId, (memberMsgMap.get(m.authorId) || 0) + 1);
            const topMsgMemberEntry = Array.from(memberMsgMap.entries()).sort((a, b) => b[1] - a[1])[0];

            const memberVoiceMap = new Map<string, number>();
            for (const v of allVoice) memberVoiceMap.set(v.userId, (memberVoiceMap.get(v.userId) || 0) + (v.duration || 0));
            const topVoiceMemberEntry = Array.from(memberVoiceMap.entries()).sort((a, b) => b[1] - a[1])[0];

            const userIdsToEnrich = [
                topMsgMemberEntry?.[0],
                topVoiceMemberEntry?.[0],
                sortedMsgs[0]?.authorId,
                sortedVoice[0]?.userId
            ].filter(Boolean) as string[];

            const usersInfo = userIdsToEnrich.length > 0 ? await enrichUserInfo(guildId, [...new Set(userIdsToEnrich)]) : {};

            return NextResponse.json({
                channel: channelMeta,
                overview: {
                    totalMessages,
                    uniqueMessageMembers,
                    totalVoiceSeconds,
                    voiceSessions,
                    uniqueVoiceMembers,
                    avgMessagesPerDay: Math.round(totalMessages / Math.max(1, Math.ceil((now.getTime() - startDate.getTime()) / 86400000))),
                    topMessageMember: topMsgMemberEntry ? {
                        userId: topMsgMemberEntry[0],
                        name: usersInfo[topMsgMemberEntry[0]]?.name || topMsgMemberEntry[0],
                        avatar: usersInfo[topMsgMemberEntry[0]]?.avatar || null,
                        value: topMsgMemberEntry[1]
                    } : null,
                    topVoiceMember: topVoiceMemberEntry ? {
                        userId: topVoiceMemberEntry[0],
                        name: usersInfo[topVoiceMemberEntry[0]]?.name || topVoiceMemberEntry[0],
                        avatar: usersInfo[topVoiceMemberEntry[0]]?.avatar || null,
                        value: topVoiceMemberEntry[1]
                    } : null,
                    mostRecentMessage: sortedMsgs[0] ? {
                        date: sortedMsgs[0].createdAt,
                        userId: sortedMsgs[0].authorId,
                        name: usersInfo[sortedMsgs[0].authorId]?.name || sortedMsgs[0].authorId,
                    } : null,
                    mostRecentVoice: sortedVoice[0] ? {
                        date: sortedVoice[0].joinedAt,
                        userId: sortedVoice[0].userId,
                        name: usersInfo[sortedVoice[0].userId]?.name || sortedVoice[0].userId,
                    } : null,
                }
            });
        }

        if (tab === 'messages') {
            const allMsgs = await getMergedMessages(guildId, { channelId, createdAt: { gte: startDate } });
            allMsgs.sort((a: any, b: any) => a.createdAt.getTime() - b.createdAt.getTime());

            const dailyMap = new Map<string, number>();
            for (const msg of allMsgs) {
                const key = fmt(msg.createdAt);
                dailyMap.set(key, (dailyMap.get(key) || 0) + 1);
            }
            const chart = Array.from(dailyMap.entries()).map(([date, count]) => ({ date, messages: count }));

            const memberBreakdownMap = new Map<string, number>();
            for (const m of allMsgs) memberBreakdownMap.set(m.authorId, (memberBreakdownMap.get(m.authorId) || 0) + 1);
            const sortedMembers = Array.from(memberBreakdownMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 20);
            const userIds = sortedMembers.map(([id]) => id);
            const usersInfo = userIds.length > 0 ? await enrichUserInfo(guildId, userIds) : {};
            const totalMessages = allMsgs.length;

            const members = sortedMembers.map(([authorId, count], i) => ({
                rank: i + 1,
                userId: authorId,
                name: usersInfo[authorId]?.name || authorId,
                avatar: usersInfo[authorId]?.avatar || null,
                messages: count,
                percentage: totalMessages > 0 ? Math.round(count / totalMessages * 10000) / 100 : 0
            }));

            return NextResponse.json({ channel: channelMeta, chart, totalMessages, members });
        }

        if (tab === 'voice') {
            const allVoice = await getMergedVoice(guildId, { channelId, joinedAt: { gte: startDate } });
            allVoice.sort((a: any, b: any) => a.joinedAt.getTime() - b.joinedAt.getTime());

            const dailyMap = new Map<string, number>();
            for (const v of allVoice) {
                const dur = v.duration || (v.leftAt ? Math.floor((v.leftAt.getTime() - v.joinedAt.getTime()) / 1000) : 0);
                const key = fmt(v.joinedAt);
                dailyMap.set(key, (dailyMap.get(key) || 0) + dur);
            }
            const chart = Array.from(dailyMap.entries()).map(([date, seconds]) => ({
                date,
                voiceMinutes: Math.floor(seconds / 60)
            }));

            const memberDurMap = new Map<string, number>();
            for (const v of allVoice) memberDurMap.set(v.userId, (memberDurMap.get(v.userId) || 0) + (v.duration || 0));
            const sortedMembers = Array.from(memberDurMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 20);
            const userIds = sortedMembers.map(([id]) => id);
            const usersInfo = userIds.length > 0 ? await enrichUserInfo(guildId, userIds) : {};
            const totalSeconds = allVoice.reduce((s: number, v: any) => s + (v.duration || (v.leftAt ? Math.floor((v.leftAt.getTime() - v.joinedAt.getTime()) / 1000) : 0)), 0);

            const members = sortedMembers.map(([userId, voiceSeconds], i) => ({
                rank: i + 1,
                userId,
                name: usersInfo[userId]?.name || userId,
                avatar: usersInfo[userId]?.avatar || null,
                voiceSeconds,
                percentage: totalSeconds > 0 ? Math.round(voiceSeconds / totalSeconds * 10000) / 100 : 0
            }));

            return NextResponse.json({ channel: channelMeta, chart, totalSeconds, members });
        }

        return NextResponse.json({ error: 'Invalid tab' }, { status: 400 });
    } catch (error) {
        console.error('[Channel Drilldown] Error:', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
