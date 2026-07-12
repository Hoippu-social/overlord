import { statsPrisma, prisma } from '../utils/database';
import { Client } from 'discord.js';
import { StatsService } from './StatsService';
import { BackupService } from './BackupService';

/**
 * RollupService handles:
 * 1. Periodic member count snapshots (every 15 minutes)
 * 2. Top rankings recalculation for all dashboard periods (hourly + daily)
 * 3. Daily maintenance: 90D/180D/ALL tops, backup, 2-year TTL rotation
 *
 * All data is written exclusively to PostgreSQL stats storage (statsPrisma).
 */

// Dashboard periods and their day windows
const HOURLY_PERIODS = [
    { key: '24H', days: 1 },
    { key: '3D', days: 3 },
    { key: '7D', days: 7 },
    { key: '14D', days: 14 },
    { key: '30D', days: 30 },
];

const DAILY_PERIODS = [
    { key: '90D', days: 90 },
    { key: '180D', days: 180 },
    { key: 'ALL', days: 730 }, // 2 years — full available history
];

const TWO_YEARS_MS = 730 * 24 * 60 * 60 * 1000;

export class RollupService {
    private static client: Client | null = null;
    private static cronJobs: NodeJS.Timeout[] = [];

    static init(client: Client) {
        this.client = client;
        console.log('[Rollup] Initializing statistics service...');

        // 1. Member snapshots every 15 min
        const snapshotInterval = setInterval(() => {
            this.runMemberSnapshots();
        }, 15 * 60 * 1000);

        // 2. Hourly: recalculate short-period tops (24H, 3D, 7D, 14D, 30D) — every hour at :05
        const hourlyInterval = setInterval(() => {
            const minutes = new Date().getMinutes();
            if (minutes === 5) {
                this.recalculatePeriods(HOURLY_PERIODS);
            }
        }, 60 * 1000); // check every minute

        // 3. Daily at 00:05: long-period tops + backup + TTL rotation
        const dailyInterval = setInterval(() => {
            const now = new Date();
            if (now.getHours() === 0 && now.getMinutes() === 5) {
                this.runDailyMaintenance();
            }
        }, 60 * 1000);

        this.cronJobs.push(snapshotInterval, hourlyInterval, dailyInterval);

        console.log('[Rollup] ✓ Cron jobs scheduled:');
        console.log('  - Member snapshots: every 15 min');
        console.log('  - Short-period tops (24H..30D): hourly at :05');
        console.log('  - Daily maintenance (90D/180D/ALL + backup + TTL): daily at 00:05');

        // Run initial tasks shortly after bot starts
        setTimeout(async () => {
            console.log('[Rollup] Running initial tasks on startup...');
            await this.runMemberSnapshots();
            await this.recalculatePeriods(HOURLY_PERIODS);
            // Don't run daily on startup (too expensive) — only run if explicitly needed
        }, 15 * 1000); // 15 seconds after start
    }

    static shutdown() {
        this.cronJobs.forEach(job => clearInterval(job));
        console.log('[Rollup] Stopped all cron jobs');
    }

    // ── Member Snapshots ─────────────────────────────────────────────────────

    private static async runMemberSnapshots() {
        if (!this.client) return;
        for (const guild of this.client.guilds.cache.values()) {
            try {
                await StatsService.snapshotMemberCount(guild);
            } catch (error) {
                console.error(`[Rollup] Member snapshot failed for ${guild.id}:`, error);
            }
        }
    }

    // ── Top Rankings ─────────────────────────────────────────────────────────

    /**
     * Recalculate top members and channels for a set of periods.
     * Can be called for all guilds (from cron) or a single guild (from on-demand API).
     */
    static async recalculatePeriods(
        periods: { key: string; days: number }[],
        guildId?: string
    ) {
        const guilds = guildId
            ? [{ id: guildId }]
            : Array.from(this.client?.guilds.cache.values() ?? []);

        for (const guild of guilds) {
            for (const period of periods) {
                await this.recalculateOnePeriodForGuild(guild.id, period.key, period.days);
            }
        }
    }

    /**
     * Recalculate tops for a specific guild and period.
     * Made public so the on-demand rollup API can call it directly.
     */
    static async recalculateOnePeriodForGuild(guildId: string, periodKey: string, days: number) {
        const since = new Date();
        since.setDate(since.getDate() - days);
        since.setHours(0, 0, 0, 0);

        try {
            // Merge raw data from both DBs

            const [msgCh, msgMem, voiceCh, voiceMem] = await Promise.all([
                statsPrisma.statMessage.groupBy({ by: ['channelId'], where: { guildId, createdAt: { gte: since } }, _count: { id: true } }),
                statsPrisma.statMessage.groupBy({ by: ['authorId'], where: { guildId, createdAt: { gte: since } }, _count: { id: true } }),
                statsPrisma.statVoiceState.groupBy({ by: ['channelId'], where: { guildId, joinedAt: { gte: since } }, _sum: { duration: true } }),
                statsPrisma.statVoiceState.groupBy({ by: ['userId'], where: { guildId, joinedAt: { gte: since } }, _sum: { duration: true } }),
            ]);

            const msgByChannel = msgCh.map(i => ({ channelId: i.channelId, value: i._count.id }));
            const msgByMember = msgMem.map(i => ({ authorId: i.authorId, value: i._count.id }));
            const voiceByChannel = voiceCh.map(i => ({ channelId: i.channelId, value: i._sum.duration || 0 }));
            const voiceByMember = voiceMem.map(i => ({ userId: i.userId, value: i._sum.duration || 0 }));

            // Sort and take top 20
            const topMsgCh = msgByChannel.sort((a, b) => b.value - a.value).slice(0, 20);
            const topMsgMem = msgByMember.sort((a, b) => b.value - a.value).slice(0, 20);
            const topVoiceCh = voiceByChannel.sort((a, b) => b.value - a.value).slice(0, 20);
            const topVoiceMem = voiceByMember.sort((a, b) => b.value - a.value).slice(0, 20);

            // Delete old tops for this period+guild and insert fresh ones
            // Safety: WHERE clause is always present (guildId + period)
            await Promise.all([
                statsPrisma.statTopChannel.deleteMany({ where: { guildId, period: periodKey } }),
                statsPrisma.statTopMember.deleteMany({ where: { guildId, period: periodKey } }),
            ]);

            const ops: Promise<any>[] = [];

            for (const ch of topMsgCh) {
                ops.push(statsPrisma.statTopChannel.create({
                    data: { guildId, channelId: ch.channelId, period: periodKey, category: 'MESSAGES', value: ch.value }
                }));
            }
            for (const m of topMsgMem) {
                ops.push(statsPrisma.statTopMember.create({
                    data: { guildId, userId: m.authorId, period: periodKey, category: 'MESSAGES', value: m.value }
                }));
            }
            for (const ch of topVoiceCh) {
                ops.push(statsPrisma.statTopChannel.create({
                    data: { guildId, channelId: ch.channelId, period: periodKey, category: 'VOICE', value: ch.value }
                }));
            }
            for (const m of topVoiceMem) {
                ops.push(statsPrisma.statTopMember.create({
                    data: { guildId, userId: m.userId, period: periodKey, category: 'VOICE', value: m.value }
                }));
            }

            await Promise.all(ops);
            console.log(`[Rollup] ✓ Tops recalculated: guild=${guildId} period=${periodKey}`);
        } catch (error) {
            console.error(`[Rollup] recalculateOnePeriodForGuild failed (${guildId}, ${periodKey}):`, error);
        }
    }

    // ── Daily Maintenance ────────────────────────────────────────────────────

    private static async runDailyMaintenance() {
        console.log('[Rollup] Starting daily maintenance...');

        // 1. Recalculate long-period tops for all guilds
        console.log('[Rollup] Recalculating 90D, 180D, ALL tops...');
        await this.recalculatePeriods(DAILY_PERIODS);

        // 2. Create daily backup
        await BackupService.createBackup();

        // 3. TTL rotation — delete raw data older than 2 years
        const cutoff = new Date(Date.now() - TWO_YEARS_MS);
        console.log(`[Rollup] TTL rotation: deleting raw data before ${cutoff.toISOString()}...`);
        try {
            const [msgs, voice, activities, interactions, memberCounts] = await Promise.all([
                statsPrisma.statMessage.deleteMany({ where: { createdAt: { lt: cutoff } } }),
                statsPrisma.statVoiceState.deleteMany({ where: { joinedAt: { lt: cutoff } } }),
                statsPrisma.statActivity.deleteMany({ where: { startTime: { lt: cutoff } } }),
                statsPrisma.statInteraction.deleteMany({ where: { createdAt: { lt: cutoff } } }),
                statsPrisma.statMemberCount.deleteMany({ where: { createdAt: { lt: cutoff } } }),
            ]);
            console.log(`[Rollup] TTL: removed ${msgs.count} msgs, ${voice.count} voice, ${activities.count} activities, ${interactions.count} interactions, ${memberCounts.count} member snapshots`);
        } catch (e) {
            console.error('[Rollup] TTL rotation failed:', e);
        }

        console.log('[Rollup] ✓ Daily maintenance complete');
    }
}
