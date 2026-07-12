import { Guild } from 'discord.js';
import { statsPrisma } from '../utils/database';

interface UsageMetrics {
    messages: number;
    voiceSeconds: number;
    newMembers: number;
    leftMembers: number;
}

/**
 * StatsService - Single-DB Architecture
 *
 * All statistics are written exclusively to PostgreSQL stats storage (statsPrisma).
 * Operational data is written to the main PostgreSQL database.
 *
 * 1. Raw events (messages, voice, interactions, activities, member events) -> statsPrisma immediately
 * 2. Aggregated metrics (hourly/daily) accumulated in memory buffer -> flushed every 5 min
 */
export class StatsService {
    private static buffer: Map<string, UsageMetrics> = new Map();
    private static flushTimer: NodeJS.Timeout | null = null;

    static async init() {
        console.log('[StatsService] Initializing PostgreSQL stats architecture...');

        this.flushTimer = setInterval(() => {
            this.flushBuffer();
        }, 5 * 60 * 1000);

        console.log('[StatsService] Buffer flush timer started (every 5 min -> PostgreSQL stats storage)');
    }

    static shutdown() {
        if (this.flushTimer) clearInterval(this.flushTimer);
        this.flushBuffer();
    }

    static async trackMessage(
        guildId: string,
        channelId: string,
        authorId: string,
        length: number,
        sourceMessageId?: string,
        createdAt = new Date()
    ) {
        try {
            await statsPrisma.statMessage.create({
                data: { guildId, channelId, authorId, length, sourceMessageId, createdAt },
            });
        } catch (e) {
            console.error('[Stats] trackMessage error', e);
        }

        this.incrementBuffer(guildId, { messages: 1 });
    }

    static async trackVoiceSession(
        guildId: string,
        channelId: string,
        userId: string,
        joinedAt: Date,
        durationSeconds: number,
        leftAt = new Date()
    ) {
        const duration = Math.max(0, Math.floor(durationSeconds));

        try {
            await statsPrisma.statVoiceState.create({
                data: {
                    guildId,
                    channelId,
                    userId,
                    sessionKey: this.buildVoiceSessionKey(guildId, channelId, userId, joinedAt, leftAt),
                    joinedAt,
                    leftAt,
                    duration,
                },
            });
        } catch (e) {
            console.error('[Stats] trackVoiceSession error', e);
        }

        this.incrementBuffer(guildId, { voiceSeconds: duration });
    }

    static async trackMemberJoin(guildId: string, userId: string, createdAt = new Date()) {
        try {
            await statsPrisma.statMemberEvent.create({
                data: {
                    guildId,
                    userId,
                    eventType: 'JOIN',
                    eventKey: this.buildMemberEventKey(guildId, userId, 'JOIN', createdAt),
                    createdAt,
                },
            });
        } catch (e) {
            console.error('[Stats] trackMemberJoin error', e);
        }

        this.incrementBuffer(guildId, { newMembers: 1 });
    }

    static async trackMemberLeave(guildId: string, userId: string, createdAt = new Date()) {
        try {
            await statsPrisma.statMemberEvent.create({
                data: {
                    guildId,
                    userId,
                    eventType: 'LEAVE',
                    eventKey: this.buildMemberEventKey(guildId, userId, 'LEAVE', createdAt),
                    createdAt,
                },
            });
        } catch (e) {
            console.error('[Stats] trackMemberLeave error', e);
        }

        this.incrementBuffer(guildId, { leftMembers: 1 });
    }

    static async trackInteraction(
        guildId: string,
        channelId: string,
        fromUserId: string,
        toUserId: string,
        type: 'REPLY' | 'MENTION',
        interactionKey?: string,
        createdAt = new Date()
    ) {
        if (fromUserId === toUserId) return;

        try {
            await statsPrisma.statInteraction.create({
                data: { guildId, channelId, fromUserId, toUserId, type, interactionKey, createdAt },
            });
        } catch (e) {
            console.error('[Stats] trackInteraction error', e);
        }
    }

    static async trackActivity(guildId: string, userId: string, activityName: string) {
        try {
            const existing = await statsPrisma.statActivity.findFirst({
                where: { guildId, userId, name: activityName, endTime: null },
            });
            if (existing) return;

            const startTime = new Date();
            await statsPrisma.statActivity.create({
                data: {
                    guildId,
                    userId,
                    name: activityName,
                    sessionKey: this.buildActivitySessionKey(guildId, userId, activityName, startTime),
                    startTime,
                },
            });
        } catch (e) {
            console.error('[Stats] trackActivity error', e);
        }
    }

    static async endActivity(guildId: string, userId: string, activityName: string) {
        try {
            const existing = await statsPrisma.statActivity.findFirst({
                where: { guildId, userId, name: activityName, endTime: null },
                orderBy: { startTime: 'desc' },
            });
            if (!existing) return;

            const endTime = new Date();
            const duration = Math.floor((endTime.getTime() - existing.startTime.getTime()) / 1000);
            await statsPrisma.statActivity.updateMany({
                where: { guildId, userId, name: activityName, startTime: existing.startTime, endTime: null },
                data: { endTime, duration },
            });
        } catch (e) {
            console.error('[Stats] endActivity error', e);
        }
    }

    static async snapshotMemberCount(guild: Guild) {
        try {
            const members = guild.members.cache;
            let online = 0;
            let idle = 0;
            let dnd = 0;
            let offline = 0;

            members.forEach((member) => {
                switch (member.presence?.status) {
                    case 'online':
                        online++;
                        break;
                    case 'idle':
                        idle++;
                        break;
                    case 'dnd':
                        dnd++;
                        break;
                    default:
                        offline++;
                        break;
                }
            });

            await statsPrisma.statMemberCount.create({
                data: { guildId: guild.id, online, idle, dnd, offline, total: members.size },
            });
        } catch (e) {
            console.error('[Stats] snapshotMemberCount error', e);
        }
    }

    private static incrementBuffer(guildId: string, metrics: Partial<UsageMetrics>) {
        const current = this.buffer.get(guildId) || {
            messages: 0,
            voiceSeconds: 0,
            newMembers: 0,
            leftMembers: 0,
        };

        this.buffer.set(guildId, {
            messages: current.messages + (metrics.messages || 0),
            voiceSeconds: current.voiceSeconds + (metrics.voiceSeconds || 0),
            newMembers: current.newMembers + (metrics.newMembers || 0),
            leftMembers: current.leftMembers + (metrics.leftMembers || 0),
        });
    }

    private static buildVoiceSessionKey(
        guildId: string,
        channelId: string,
        userId: string,
        joinedAt: Date,
        leftAt: Date
    ) {
        return `${guildId}:voice:${channelId}:${userId}:${joinedAt.toISOString()}:${leftAt.toISOString()}`;
    }

    private static buildMemberEventKey(
        guildId: string,
        userId: string,
        eventType: 'JOIN' | 'LEAVE',
        createdAt: Date
    ) {
        return `${guildId}:member:${eventType}:${userId}:${createdAt.toISOString()}`;
    }

    private static buildActivitySessionKey(
        guildId: string,
        userId: string,
        activityName: string,
        startTime: Date
    ) {
        return `${guildId}:activity:${userId}:${activityName}:${startTime.toISOString()}`;
    }

    private static async flushBuffer() {
        if (this.buffer.size === 0) return;
        console.log(`[StatsService] Flushing ${this.buffer.size} guild(s) to PostgreSQL stats storage...`);

        const now = new Date();
        const snapshot = new Map(this.buffer);
        this.buffer.clear();

        for (const [guildId, metrics] of snapshot.entries()) {
            await this.writeMetrics(guildId, now, metrics);
        }
    }

    private static async writeMetrics(guildId: string, date: Date, metrics: UsageMetrics) {
        const dateHour = new Date(date);
        dateHour.setUTCMinutes(0, 0, 0);

        const dayStart = new Date(date);
        dayStart.setUTCHours(0, 0, 0, 0);

        try {
            await statsPrisma.statHourly.upsert({
                where: { guildId_dateHour: { guildId, dateHour } },
                update: {
                    messages: { increment: metrics.messages },
                    voiceSeconds: { increment: metrics.voiceSeconds },
                    newMembers: { increment: metrics.newMembers },
                    leftMembers: { increment: metrics.leftMembers },
                },
                create: {
                    guildId,
                    dateHour,
                    messages: metrics.messages,
                    voiceSeconds: metrics.voiceSeconds,
                    newMembers: metrics.newMembers,
                    leftMembers: metrics.leftMembers,
                },
            });

            await statsPrisma.statDaily.upsert({
                where: { guildId_date: { guildId, date: dayStart } },
                update: {
                    messages: { increment: metrics.messages },
                    voiceSeconds: { increment: metrics.voiceSeconds },
                    newMembers: { increment: metrics.newMembers },
                    leftMembers: { increment: metrics.leftMembers },
                },
                create: {
                    guildId,
                    date: dayStart,
                    messages: metrics.messages,
                    voiceSeconds: metrics.voiceSeconds,
                    newMembers: metrics.newMembers,
                    leftMembers: metrics.leftMembers,
                },
            });
        } catch (e) {
            console.error(`[StatsService] writeMetrics failed for ${guildId}:`, e);
        }
    }
}
