import { NextRequest, NextResponse } from 'next/server';
import { prisma, statsPrisma } from '@/lib/prisma';
import { updateSyncStatus } from './status/route';

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ guildId: string }> }
) {
    const { guildId } = await params;

    // Parse request body for custom period
    let customDays: number | null = null;
    try {
        const body = await request.json();
        customDays = body.days || null;
    } catch {
        // No body or invalid JSON, use default
    }

    // Determine sync window
    const SYNC_DAYS = customDays || 90; // Default 3 months
    const since = new Date();
    since.setDate(since.getDate() - SYNC_DAYS);
    since.setHours(0, 0, 0, 0);

    // Date for 30d Top calc
    const since30d = new Date();
    since30d.setDate(since30d.getDate() - 30);
    since30d.setHours(0, 0, 0, 0);

    try {
        console.log(`[StatsSync] Starting comprehensive sync for guild ${guildId} for ${SYNC_DAYS} days since ${since.toISOString()}`);

        // Initialize progress
        updateSyncStatus(guildId, {
            isRunning: true,
            progress: 0,
            message: 'Starting sync...',
            startedAt: new Date()
        });

        // --- 1. Aggregating Messages (from TWO databases) ---
        updateSyncStatus(guildId, { progress: 10, message: 'Fetching messages from both databases...' });

        // Fetch from stats.db (long term)
        const statsMessages = await statsPrisma.statMessage.findMany({
            where: { guildId, createdAt: { gte: since } }
        });

        // Fetch from development.db (recent)
        const devMessages = await prisma.statMessage.findMany({
            where: { guildId, createdAt: { gte: since } }
        });

        // Combine and deduplicate (just in case they overlap)
        const msgMap = new Map();
        for (const m of statsMessages) msgMap.set(m.id, m);
        for (const m of devMessages) msgMap.set(m.id, m);
        const rawMessages = Array.from(msgMap.values());

        console.log(`[StatsSync] Combined ${rawMessages.length} messages (${statsMessages.length} stats, ${devMessages.length} dev)`);

        updateSyncStatus(guildId, { progress: 20, message: `Processing ${rawMessages.length} total messages...` });

        // Group by Hour (for StatHourly) and Day (for StatDaily)
        const hourlyStats = new Map<string, { messages: number, voice: number, joined: number, left: number }>();
        const dailyStats = new Map<string, { messages: number, voice: number, joined: number, left: number }>();

        const getHourlyEntry = (date: Date) => {
            const d = new Date(date);
            d.setMinutes(0, 0, 0);
            const key = d.toISOString();
            if (!hourlyStats.has(key)) hourlyStats.set(key, { messages: 0, voice: 0, joined: 0, left: 0 });
            return hourlyStats.get(key)!;
        };

        const getDailyEntry = (date: Date) => {
            const d = new Date(date);
            d.setHours(0, 0, 0, 0);
            const key = d.toISOString();
            if (!dailyStats.has(key)) dailyStats.set(key, { messages: 0, voice: 0, joined: 0, left: 0 });
            return dailyStats.get(key)!;
        };

        // Process Messages
        for (const msg of rawMessages) {
            const h = getHourlyEntry(msg.createdAt);
            h.messages++;
            const d = getDailyEntry(msg.createdAt);
            d.messages++;
        }

        // --- 2. Aggregating Voice (from TWO databases) ---
        updateSyncStatus(guildId, { progress: 30, message: 'Fetching voice data from both databases...' });

        const statsVoice = await statsPrisma.statVoiceState.findMany({
            where: {
                guildId,
                OR: [
                    { leftAt: { gte: since } },
                    { leftAt: null, joinedAt: { gte: since } }
                ]
            }
        });

        const devVoice = await prisma.statVoiceState.findMany({
            where: {
                guildId,
                OR: [
                    { leftAt: { gte: since } },
                    { leftAt: null, joinedAt: { gte: since } }
                ]
            }
        });

        // Combine and deduplicate
        const voiceMap = new Map();
        for (const v of statsVoice) voiceMap.set(v.id, v);
        for (const v of devVoice) voiceMap.set(v.id, v);
        const rawVoice = Array.from(voiceMap.values());

        console.log(`[StatsSync] Combined ${rawVoice.length} voice sessions (${statsVoice.length} stats, ${devVoice.length} dev)`);

        for (const session of rawVoice) {
            if (!session.joinedAt) continue;

            let duration: number;
            if (session.duration) {
                duration = session.duration;
            } else if (session.leftAt) {
                duration = Math.floor((session.leftAt.getTime() - session.joinedAt.getTime()) / 1000);
            } else {
                duration = Math.floor((Date.now() - session.joinedAt.getTime()) / 1000);
            }
            if (duration < 0) duration = 0;

            const endDate = session.leftAt || new Date();
            const h = getHourlyEntry(endDate);
            h.voice += duration;
            const d = getDailyEntry(endDate);
            d.voice += duration;
        }

        // --- 3. Aggregating Members (Joins/Leaves) from Audit Logs ---
        updateSyncStatus(guildId, { progress: 45, message: 'Fetching member events...' });

        const rawMemberEvents = await prisma.auditLogEvent.findMany({
            where: {
                guildId,
                tag: 'invites',
                createdAt: { gte: since }
            }
        });
        console.log(`[StatsSync] Fetched ${rawMemberEvents.length} member events`);

        for (const event of rawMemberEvents) {
            if (!event.payload) continue;
            let payload: any = {};
            try { payload = JSON.parse(event.payload); } catch { continue; }

            const eventType = payload.event;
            const ts = event.createdAt;

            if (eventType === 'invite_join' && ts >= since) {
                getHourlyEntry(ts).joined++;
                getDailyEntry(ts).joined++;
            }
            if (eventType === 'invite_leave' && ts >= since) {
                getHourlyEntry(ts).left++;
                getDailyEntry(ts).left++;
            }
        }

        // --- 4. Writing Hourly/Daily to Database (AGGREGATE DATABASE) ---
        updateSyncStatus(guildId, { progress: 60, message: 'Updating hourly/daily records...' });

        const totalHours = hourlyStats.size;
        let processedHours = 0;

        for (const [key, stats] of hourlyStats) {
            const dateHour = new Date(key);
            await statsPrisma.statHourly.upsert({
                where: { guildId_dateHour: { guildId, dateHour } },
                update: {
                    messages: stats.messages,
                    voiceSeconds: stats.voice,
                    newMembers: stats.joined,
                    leftMembers: stats.left
                },
                create: {
                    guildId, dateHour,
                    messages: stats.messages,
                    voiceSeconds: stats.voice,
                    newMembers: stats.joined,
                    leftMembers: stats.left
                }
            });

            processedHours++;
            if (processedHours % 50 === 0) {
                updateSyncStatus(guildId, { progress: 60 + Math.floor((processedHours / totalHours) * 10), message: `Saving hourly data...` });
            }
        }

        for (const [key, stats] of dailyStats) {
            const date = new Date(key);
            await statsPrisma.statDaily.upsert({
                where: { guildId_date: { guildId, date } },
                update: {
                    messages: stats.messages,
                    voiceSeconds: stats.voice,
                    newMembers: stats.joined,
                    leftMembers: stats.left
                },
                create: {
                    guildId, date,
                    messages: stats.messages,
                    voiceSeconds: stats.voice,
                    newMembers: stats.joined,
                    leftMembers: stats.left
                }
            });
        }

        // --- 5. Calculating Tops (Last 30d) ---
        updateSyncStatus(guildId, { progress: 80, message: 'Calculating rankings...' });

        // We use combined raw data for tops to be accurate
        // However, GROUP BY across two databases in Prisma is impossible.
        // For simplicity and speed, we take the combined rawMessages array from earlier if it was within 30d

        const topMsgChannelMap = new Map<string, number>();
        const topMsgMemberMap = new Map<string, number>();

        for (const m of rawMessages) {
            if (m.createdAt >= since30d) {
                topMsgChannelMap.set(m.channelId, (topMsgChannelMap.get(m.channelId) || 0) + 1);
                topMsgMemberMap.set(m.authorId, (topMsgMemberMap.get(m.authorId) || 0) + 1);
            }
        }

        const topVoiceChannelMap = new Map<string, number>();
        const topVoiceMemberMap = new Map<string, number>();
        for (const v of rawVoice) {
            const duration = v.duration || (v.leftAt ? Math.floor((v.leftAt.getTime() - v.joinedAt.getTime()) / 1000) : 0);
            if (v.joinedAt >= since30d) {
                topVoiceChannelMap.set(v.channelId, (topVoiceChannelMap.get(v.channelId) || 0) + duration);
                topVoiceMemberMap.set(v.userId, (topVoiceMemberMap.get(v.userId) || 0) + duration);
            }
        }

        // Clean old 30d tops
        await statsPrisma.statTopChannel.deleteMany({ where: { guildId, period: '30D' } });
        await statsPrisma.statTopMember.deleteMany({ where: { guildId, period: '30D' } });

        // Save new Tops
        const topPromises = [];

        // Sort and take top 20
        const sortedMsgChannels = Array.from(topMsgChannelMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 20);
        for (const [id, val] of sortedMsgChannels) {
            topPromises.push(statsPrisma.statTopChannel.create({ data: { guildId, channelId: id, period: '30D', category: 'MESSAGES', value: val } }));
        }

        const sortedVoiceChannels = Array.from(topVoiceChannelMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 20);
        for (const [id, val] of sortedVoiceChannels) {
            topPromises.push(statsPrisma.statTopChannel.create({ data: { guildId, channelId: id, period: '30D', category: 'VOICE', value: val } }));
        }

        const sortedMsgMembers = Array.from(topMsgMemberMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 20);
        for (const [id, val] of sortedMsgMembers) {
            topPromises.push(statsPrisma.statTopMember.create({ data: { guildId, userId: id, period: '30D', category: 'MESSAGES', value: val } }));
        }

        const sortedVoiceMembers = Array.from(topVoiceMemberMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 20);
        for (const [id, val] of sortedVoiceMembers) {
            topPromises.push(statsPrisma.statTopMember.create({ data: { guildId, userId: id, period: '30D', category: 'VOICE', value: val } }));
        }

        await Promise.all(topPromises);

        console.log(`[StatsSync] Completed comprehensive sync for ${guildId}.`);

        updateSyncStatus(guildId, {
            isRunning: false,
            progress: 100,
            message: 'Sync completed',
            finishedAt: new Date(),
            lastSyncDate: new Date()
        });

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('[StatsSync] CRITICAL ERROR:', error);
        updateSyncStatus(guildId, {
            isRunning: false,
            progress: 0,
            message: `Sync failed: ${error instanceof Error ? error.message : String(error)}`,
            finishedAt: new Date()
        });
        return NextResponse.json({ error: 'Sync failed', details: String(error) }, { status: 500 });
    }
}
