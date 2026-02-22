import { prisma } from '../utils/database';
import { Client } from 'discord.js';
import { StatsService } from './StatsService';
import fs from 'fs';
import path from 'path';

/**
 * RollupService handles:
 * 1. Periodic member count snapshots (every 15 minutes)
 * 2. Top rankings recalculation (every hour)
 * 
 * Note: Real-time aggregation of messages/voice/members is handled
 * by StatsService directly on each event.
 * Note: Legacy JSON backups removal - moved to dual-DB architecture (stats.db).
 */
export class RollupService {
    private static client: Client | null = null;
    private static cronJobs: NodeJS.Timeout[] = [];

    /**
     * Initialize the rollup service with cron scheduling
     */
    static init(client: Client) {
        this.client = client;
        console.log('[Rollup] Initializing statistics service...');

        // Member count snapshots every 15 minutes
        const snapshotInterval = setInterval(() => {
            this.runMemberSnapshots();
        }, 15 * 60 * 1000); // 15 minutes

        // Recalculate top rankings every hour at :05
        const topRankingsInterval = setInterval(() => {
            const minutes = new Date().getMinutes();
            if (minutes === 5) {
                this.recalculateTopRankings();
            }
        }, 60000); // Check every minute

        this.cronJobs.push(snapshotInterval, topRankingsInterval);

        console.log('[Rollup] ✓ Cron jobs scheduled:');
        console.log('  - Member snapshots: every 15 min');
        console.log('  - Top rankings: hourly at :05');

        // Run initial tasks on startup
        setTimeout(() => {
            console.log('[Rollup] Running initial tasks on startup...');
            this.runMemberSnapshots();
            this.recalculateTopRankings();
        }, 10000); // Wait 10 seconds after bot starts
    }

    /**
     * Shutdown cleanup
     */
    static shutdown() {
        this.cronJobs.forEach(job => clearInterval(job));
        console.log('[Rollup] Stopped all cron jobs');
    }

    /**
     * Run member count snapshots for all guilds
     */
    private static async runMemberSnapshots() {
        if (!this.client) return;

        const guilds = this.client.guilds.cache;
        console.log(`[Rollup] Running member snapshots for ${guilds.size} guilds...`);

        for (const guild of guilds.values()) {
            try {
                await StatsService.snapshotMemberCount(guild);
            } catch (error) {
                console.error(`[Rollup] Member snapshot failed for guild ${guild.id}:`, error);
            }
        }
    }

    /**
     * Recalculate top member and channel rankings.
     * This updates StatTopMember and StatTopChannel tables.
     * Made public so it can be called manually if needed.
     */
    static async recalculateTopRankings() {
        if (!this.client) return;

        console.log('[Rollup] Recalculating top rankings...');

        for (const guild of this.client.guilds.cache.values()) {
            await this.recalculateTopRankingsForGuild(guild.id);
        }

        console.log('[Rollup] ✓ Top rankings recalculated');
    }

    /**
     * Recalculate top rankings for a specific guild.
     * Can be called without the client reference.
     */
    static async recalculateTopRankingsForGuild(guildId: string) {
        const since30d = new Date();
        since30d.setDate(since30d.getDate() - 30);
        since30d.setHours(0, 0, 0, 0);

        try {
            // Top Messages by Channel
            const topMsgChannels = await prisma.statMessage.groupBy({
                by: ['channelId'],
                where: { guildId, createdAt: { gte: since30d } },
                _count: { id: true },
                orderBy: { _count: { id: 'desc' } },
                take: 20
            });

            // Top Voice by Channel
            const topVoiceChannels = await prisma.statVoiceState.groupBy({
                by: ['channelId'],
                where: { guildId, joinedAt: { gte: since30d } },
                _sum: { duration: true },
                orderBy: { _sum: { duration: 'desc' } },
                take: 20
            });

            // Top Messages by Member
            const topMsgMembers = await prisma.statMessage.groupBy({
                by: ['authorId'],
                where: { guildId, createdAt: { gte: since30d } },
                _count: { id: true },
                orderBy: { _count: { id: 'desc' } },
                take: 20
            });

            // Top Voice by Member
            const topVoiceMembers = await prisma.statVoiceState.groupBy({
                by: ['userId'],
                where: { guildId, joinedAt: { gte: since30d } },
                _sum: { duration: true },
                orderBy: { _sum: { duration: 'desc' } },
                take: 20
            });

            // Delete old rankings for this guild
            await prisma.statTopChannel.deleteMany({ where: { guildId, period: '30D' } });
            await prisma.statTopMember.deleteMany({ where: { guildId, period: '30D' } });

            // Insert new rankings
            const operations = [];

            for (const ch of topMsgChannels) {
                operations.push(prisma.statTopChannel.create({
                    data: { guildId, channelId: ch.channelId, period: '30D', category: 'MESSAGES', value: ch._count.id }
                }));
            }

            for (const ch of topVoiceChannels) {
                operations.push(prisma.statTopChannel.create({
                    data: { guildId, channelId: ch.channelId, period: '30D', category: 'VOICE', value: ch._sum.duration || 0 }
                }));
            }

            for (const m of topMsgMembers) {
                operations.push(prisma.statTopMember.create({
                    data: { guildId, userId: m.authorId, period: '30D', category: 'MESSAGES', value: m._count.id }
                }));
            }

            for (const m of topVoiceMembers) {
                operations.push(prisma.statTopMember.create({
                    data: { guildId, userId: m.userId, period: '30D', category: 'VOICE', value: m._sum.duration || 0 }
                }));
            }

            await Promise.all(operations);
            console.log(`[Rollup] ✓ Top rankings recalculated for guild ${guildId}`);
        } catch (error) {
            console.error(`[Rollup] Top rankings failed for guild ${guildId}:`, error);
        }
    }
}
