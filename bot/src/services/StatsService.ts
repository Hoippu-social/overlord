import { prisma, statsPrisma } from '../utils/database';
import { Guild } from 'discord.js';

interface UsageMetrics {
    messages: number;
    voiceSeconds: number;
    newMembers: number;
    leftMembers: number;
}

/**
 * StatsService - Dual-Database Architecture with Batching
 * 
 * 1. Accumulates metrics in memory (StatsBuffer)
 * 2. Flushes to Dashboard DB (development.db) every 5 mins
 * 3. Flushes to Stats DB (stats.db) every 30 mins
 * 4. Recovers from Stats DB on startup
 */
export class StatsService {
    // In-memory buffer: GuildID -> Metrics
    private static buffer: Map<string, UsageMetrics> = new Map();
    private static activityBuffer: Map<string, any[]> = new Map(); // Not fully implemented for batching yet, keeping simple

    // Timers
    private static dashboardTimer: NodeJS.Timeout | null = null;
    private static statsDbTimer: NodeJS.Timeout | null = null;

    static async init() {
        console.log('[StatsService] Initializing Dual-DB Architecture...');

        // 1. Recover from Stats DB to Dashboard DB
        await this.recoverFromStatsDB();

        // 2. Start Flush Timers
        // Dashboard (5 mins)
        this.dashboardTimer = setInterval(() => {
            this.flushToDashboardDB();
        }, 5 * 60 * 1000);

        // Stats DB (30 mins)
        this.statsDbTimer = setInterval(() => {
            this.flushToStatsDB();
        }, 30 * 60 * 1000);

        console.log('[StatsService] ✓ Timers started: Dashboard (5m), StatsDB (30m)');
    }

    static shutdown() {
        if (this.dashboardTimer) clearInterval(this.dashboardTimer);
        if (this.statsDbTimer) clearInterval(this.statsDbTimer);
        // Force final flush
        this.flushToDashboardDB();
        this.flushToStatsDB();
    }

    // ==================== TRACKING APIs (In-Memory) ====================

    static async trackMessage(guildId: string, channelId: string, authorId: string, length: number) {
        // 1. Raw record still goes to Dashboard DB for immediate log (optional, can be disabled for perf)
        // Keeping it for now as "Chat Logs" might be needed in real-time
        try {
            await prisma.statMessage.create({ data: { guildId, channelId, authorId, length } });
        } catch (e) { console.error('[Stats] Msg Log Error', e); }

        // 2. Buffer Aggregation
        this.incrementBuffer(guildId, { messages: 1 });
    }

    static async trackVoiceSession(guildId: string, channelId: string, userId: string, joinedAt: Date, durationSeconds: number) {
        const duration = Math.floor(durationSeconds);
        // 1. Raw record
        try {
            await prisma.statVoiceState.create({
                data: { guildId, channelId, userId, joinedAt, leftAt: new Date(), duration }
            });
        } catch (e) { console.error('[Stats] Voice Log Error', e); }

        // 2. Buffer Aggregation
        this.incrementBuffer(guildId, { voiceSeconds: duration });
    }

    static async trackMemberJoin(guildId: string) {
        this.incrementBuffer(guildId, { newMembers: 1 });
    }

    static async trackMemberLeave(guildId: string) {
        this.incrementBuffer(guildId, { leftMembers: 1 });
    }

    // Activity tracking remains direct for now as it's complex state
    static async trackActivity(guildId: string, userId: string, activityName: string) {
        try {
            const existing = await prisma.statActivity.findFirst({
                where: { guildId, userId, name: activityName, endTime: null }
            });
            if (existing) return;
            await prisma.statActivity.create({
                data: { guildId, userId, name: activityName, startTime: new Date() }
            });
        } catch (e) { console.error(e); }
    }

    static async endActivity(guildId: string, userId: string, activityName: string) {
        try {
            const existing = await prisma.statActivity.findFirst({
                where: { guildId, userId, name: activityName, endTime: null },
                orderBy: { startTime: 'desc' }
            });
            if (!existing) return;
            const endTime = new Date();
            const duration = Math.floor((endTime.getTime() - existing.startTime.getTime()) / 1000);
            await prisma.statActivity.update({
                where: { id: existing.id },
                data: { endTime, duration }
            });
        } catch (e) { console.error(e); }
    }

    // Member Snapshot remains direct (low frequency)
    static async snapshotMemberCount(guild: Guild) {
        try {
            const members = guild.members.cache;
            let online = 0, idle = 0, dnd = 0, offline = 0;
            members.forEach(m => {
                switch (m.presence?.status) {
                    case 'online': online++; break;
                    case 'idle': idle++; break;
                    case 'dnd': dnd++; break;
                    default: offline++; break;
                }
            });
            await prisma.statMemberCount.create({
                data: { guildId: guild.id, online, idle, dnd, offline, total: members.size }
            });
        } catch (e) { console.error(e); }
    }


    // ==================== BUFFER MGMT ====================

    private static incrementBuffer(guildId: string, metrics: Partial<UsageMetrics>) {
        const current = this.buffer.get(guildId) || { messages: 0, voiceSeconds: 0, newMembers: 0, leftMembers: 0 };

        this.buffer.set(guildId, {
            messages: current.messages + (metrics.messages || 0),
            voiceSeconds: current.voiceSeconds + (metrics.voiceSeconds || 0),
            newMembers: current.newMembers + (metrics.newMembers || 0),
            leftMembers: current.leftMembers + (metrics.leftMembers || 0),
        });
    }

    // ==================== FLUSHING LOGIC ====================

    /**
     * Route 1: Flush to Dashboard DB (Fast View)
     * IMPORTANT: Does NOT clear the buffer! Buffer assumes cumulative updates until safe flush?
     * NO: If we don't clear, we double count. 
     * STRATEGY: We flush DELTAS. 
     * But we have two destinations with different intervals.
     * Solution: We simply write the *current buffer* to DB and clear it?
     * IF we clear it, the 30m flush will only see the last 5m of data.
     * 
     * BETTER STRATEGY:
     * - `buffer`: Accumulates since last 5m flush.
     * - `longTermBuffer`: Accumulates since last 30m flush.
     */
    private static longTermBuffer: Map<string, UsageMetrics> = new Map();

    private static async flushToDashboardDB() {
        if (this.buffer.size === 0) return;

        console.log('[Stats] Flushing to Dashboard DB...');
        const now = new Date();

        for (const [guildId, metrics] of this.buffer.entries()) {
            // Write to Dashboard DB
            await this.writeMetricsToDB(prisma, guildId, now, metrics);

            // Accumulate to LongTerm Buffer
            const currentLT = this.longTermBuffer.get(guildId) || { messages: 0, voiceSeconds: 0, newMembers: 0, leftMembers: 0 };
            this.longTermBuffer.set(guildId, {
                messages: currentLT.messages + metrics.messages,
                voiceSeconds: currentLT.voiceSeconds + metrics.voiceSeconds,
                newMembers: currentLT.newMembers + metrics.newMembers,
                leftMembers: currentLT.leftMembers + metrics.leftMembers,
            });
        }

        // Clear ShortTerm Buffer
        this.buffer.clear();
    }

    private static async flushToStatsDB() {
        if (this.longTermBuffer.size === 0) return;

        console.log('[Stats] Flushing to Stats DB (Long-Term Storage)...');
        const now = new Date();

        for (const [guildId, metrics] of this.longTermBuffer.entries()) {
            // Write to Stats DB
            await this.writeMetricsToDB(statsPrisma, guildId, now, metrics);
        }

        // Clear LongTerm Buffer
        this.longTermBuffer.clear();
    }

    private static async writeMetricsToDB(client: any, guildId: string, date: Date, metrics: UsageMetrics) {
        const dateHour = new Date(date); dateHour.setMinutes(0, 0, 0);
        const dayStart = new Date(date); dayStart.setHours(0, 0, 0, 0);

        try {
            // 1. Hourly
            await client.statHourly.upsert({
                where: { guildId_dateHour: { guildId, dateHour } },
                update: {
                    messages: { increment: metrics.messages },
                    voiceSeconds: { increment: metrics.voiceSeconds },
                    newMembers: { increment: metrics.newMembers },
                    leftMembers: { increment: metrics.leftMembers },
                },
                create: {
                    guildId, dateHour,
                    messages: metrics.messages,
                    voiceSeconds: metrics.voiceSeconds,
                    newMembers: metrics.newMembers,
                    leftMembers: metrics.leftMembers,
                }
            });

            // 2. Daily
            await client.statDaily.upsert({
                where: { guildId_date: { guildId, date: dayStart } },
                update: {
                    messages: { increment: metrics.messages },
                    voiceSeconds: { increment: metrics.voiceSeconds },
                    newMembers: { increment: metrics.newMembers },
                    leftMembers: { increment: metrics.leftMembers },
                },
                create: {
                    guildId, date: dayStart,
                    messages: metrics.messages,
                    voiceSeconds: metrics.voiceSeconds,
                    newMembers: metrics.newMembers,
                    leftMembers: metrics.leftMembers,
                }
            });
        } catch (e) {
            console.error(`[Stats] Write Metrics Failed for ${guildId}:`, e);
        }
    }

    // ==================== RECOVERY ====================

    /**
     * Syncs aggregate data (Daily/Hourly) from Stats DB -> Dashboard DB
     * This ensures Dashboard has history even if development.db was wiped.
     */
    private static async recoverFromStatsDB() {
        console.log('[StatsService] Recovering data from Stats DB...');

        try {
            // 1. Get stats from StatsDB (last 30 days)
            const since = new Date(); since.setDate(since.getDate() - 30);

            const dailies = await statsPrisma.statDaily.findMany({ where: { date: { gte: since } } });
            const hourlies = await statsPrisma.statHourly.findMany({ where: { dateHour: { gte: since } } });

            console.log(`[StatsService] Found ${dailies.length} daily and ${hourlies.length} hourly records in Stats DB.`);

            // 2. Upsert into Dashboard DB
            // Note: using createMany with skipDuplicates might be faster if supported by SQLite, 
            // but upsert is safer. For startup, simple loop is okay if volume isn't massive.

            // Batch transaction for speed
            const transactions = [];

            for (const d of dailies) {
                transactions.push(prisma.statDaily.upsert({
                    where: { guildId_date: { guildId: d.guildId, date: d.date } },
                    update: { messages: d.messages, voiceSeconds: d.voiceSeconds, newMembers: d.newMembers, leftMembers: d.leftMembers },
                    create: { ...d, id: undefined } // remove ID collision
                }));
            }

            for (const h of hourlies) {
                transactions.push(prisma.statHourly.upsert({
                    where: { guildId_dateHour: { guildId: h.guildId, dateHour: h.dateHour } },
                    update: { messages: h.messages, voiceSeconds: h.voiceSeconds, newMembers: h.newMembers, leftMembers: h.leftMembers },
                    create: { ...h, id: undefined }
                }));
            }

            if (transactions.length > 0) {
                // Execute in chunks to avoid query limits
                const chunkSize = 50;
                for (let i = 0; i < transactions.length; i += chunkSize) {
                    await prisma.$transaction(transactions.slice(i, i + chunkSize));
                }
                console.log(`[StatsService] ✓ Synced ${transactions.length} records to Dashboard DB.`);
            } else {
                console.log('[StatsService] No data to sync.');
            }

        } catch (e) {
            console.error('[StatsService] Recovery Failed:', e);
        }
    }
}
