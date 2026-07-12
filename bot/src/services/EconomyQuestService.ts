import { Prisma, EconomyQuestTemplate } from '@prisma/client';
import { prisma } from '../utils/database';
import logger from '../utils/logger';
import { EconomyService } from './EconomyService';

export type QuestMetric = 'MESSAGES' | 'VOICE_MINUTES' | 'REACTIONS' | 'GAMES_PLAYED' | 'ITEMS_BOUGHT';

export interface QuestWithProgress extends EconomyQuestTemplate {
    periodKey: string;
    progress: number;
    completedAt: Date | null;
    claimedAt: Date | null;
}

export type ClaimResult =
    | { ok: true; reward: bigint }
    | { ok: false; reason: 'NOT_FOUND' | 'NOT_COMPLETED' | 'ALREADY_CLAIMED' };

export interface UnlockedAchievement {
    id: number;
    key: string;
    name: string;
    description: string | null;
    badgeEmoji: string | null;
    reward: bigint;
}

/**
 * Standard ISO 8601 week numbering, Monday-start weeks. Returns keys like "2026-W27".
 */
function getIsoWeekKey(date: Date): string {
    const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    // ISO weekday: Monday=1 .. Sunday=7
    const dayNum = d.getUTCDay() || 7;
    // Shift to the Thursday of this week — the ISO week's year is the year of that Thursday.
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const isoYearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNum = Math.ceil(((d.getTime() - isoYearStart.getTime()) / 86400000 + 1) / 7);
    return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

function periodKeyFor(kind: string, now: Date): string {
    return kind === 'WEEKLY' ? getIsoWeekKey(now) : now.toISOString().slice(0, 10);
}

export class EconomyQuestService {
    /**
     * Called on every relevant user action (message sent, voice minute ticked, reaction
     * added, game played, item bought). Must be cheap and MUST NOT throw — quest tracking
     * failures should never break the caller's primary flow.
     */
    static async incrementMetric(
        guildId: string,
        userId: string,
        metric: QuestMetric | string,
        amount: number
    ): Promise<void> {
        try {
            const templates = await prisma.economyQuestTemplate.findMany({
                where: { guildId, metric, enabled: true },
            });
            if (templates.length === 0) return;

            const now = new Date();

            for (const template of templates) {
                const periodKey = periodKeyFor(template.kind, now);

                const row = await prisma.economyQuestProgress.upsert({
                    where: {
                        guildId_userId_templateId_periodKey: {
                            guildId,
                            userId,
                            templateId: template.id,
                            periodKey,
                        },
                    },
                    update: { progress: { increment: amount } },
                    create: { guildId, userId, templateId: template.id, periodKey, progress: amount },
                });

                if (row.progress >= template.target && row.completedAt === null) {
                    await prisma.economyQuestProgress.update({
                        where: { id: row.id },
                        data: { completedAt: new Date() },
                    });
                }
            }
        } catch (err) {
            logger.error('[EconomyQuestService] incrementMetric failed', err);
        }
    }

    /** Returns all enabled quest templates for the guild combined with the user's current-period progress. */
    static async listActiveQuests(guildId: string, userId: string): Promise<QuestWithProgress[]> {
        const templates = await prisma.economyQuestTemplate.findMany({
            where: { guildId, enabled: true },
            orderBy: { sortOrder: 'asc' },
        });

        const now = new Date();
        const results: QuestWithProgress[] = [];

        for (const template of templates) {
            const periodKey = periodKeyFor(template.kind, now);

            const progressRow = await prisma.economyQuestProgress.findUnique({
                where: {
                    guildId_userId_templateId_periodKey: {
                        guildId,
                        userId,
                        templateId: template.id,
                        periodKey,
                    },
                },
            });

            results.push({
                ...template,
                periodKey,
                progress: progressRow?.progress ?? 0,
                completedAt: progressRow?.completedAt ?? null,
                claimedAt: progressRow?.claimedAt ?? null,
            });
        }

        return results;
    }

    /**
     * Claims the reward for a completed-but-unclaimed quest. Uses a conditional updateMany
     * guard (claimedAt: null) BEFORE crediting, mirroring the idempotency-key-first pattern
     * in EconomyService.credit, to prevent a double-claim race.
     */
    static async claimQuest(guildId: string, userId: string, templateId: number): Promise<ClaimResult> {
        const template = await prisma.economyQuestTemplate.findUnique({ where: { id: templateId } });
        if (!template || template.guildId !== guildId) {
            return { ok: false, reason: 'NOT_FOUND' };
        }

        const periodKey = periodKeyFor(template.kind, new Date());

        const progressRow = await prisma.economyQuestProgress.findUnique({
            where: {
                guildId_userId_templateId_periodKey: { guildId, userId, templateId, periodKey },
            },
        });

        if (!progressRow || progressRow.completedAt === null) {
            return { ok: false, reason: 'NOT_COMPLETED' };
        }
        if (progressRow.claimedAt !== null) {
            return { ok: false, reason: 'ALREADY_CLAIMED' };
        }

        const claim = await prisma.economyQuestProgress.updateMany({
            where: { id: progressRow.id, claimedAt: null },
            data: { claimedAt: new Date() },
        });

        if (claim.count === 0) {
            return { ok: false, reason: 'ALREADY_CLAIMED' };
        }

        await EconomyService.credit({
            guildId,
            userId,
            account: 'WALLET',
            amount: template.reward,
            type: 'QUEST_REWARD',
            sourceRef: `quest:${templateId}:${periodKey}`,
        });

        return { ok: true, reward: template.reward };
    }

    /**
     * Call after any action that might cross an achievement threshold. Self-contained —
     * wiring callers is a later integration step, not implemented here.
     */
    static async checkAchievements(guildId: string, userId: string): Promise<UnlockedAchievement[]> {
        const member = await EconomyService.getOrCreateMember(guildId, userId);
        const achievements = await prisma.economyAchievement.findMany({
            where: { guildId, enabled: true },
        });

        const unlocked: UnlockedAchievement[] = [];

        for (const achievement of achievements) {
            let currentValue: number | null = null;

            switch (achievement.metric) {
                case 'TOTAL_EARNED':
                    currentValue = Number(member.totalEarned);
                    break;
                case 'DAILY_STREAK':
                    currentValue = member.dailyStreak;
                    break;
                case 'GAMES_WON':
                    currentValue = member.gamesWon;
                    break;
                case 'VOICE_MINUTES':
                    currentValue = member.lifetimeVoiceMinutes;
                    break;
                case 'MESSAGES':
                    currentValue = member.lifetimeMessages;
                    break;
                case 'LOTTERY_WIN':
                    // Lottery wins aren't tracked on EconomyMember yet — always treat as not-met.
                    // A later enhancement could add a dedicated counter for this metric.
                    currentValue = null;
                    break;
                default:
                    currentValue = null;
            }

            if (currentValue === null || currentValue < achievement.threshold) continue;

            try {
                await prisma.economyAchievementUnlock.create({
                    data: { guildId, userId, achievementId: achievement.id },
                });
            } catch (err) {
                if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
                    // Already unlocked — silently skip.
                    continue;
                }
                throw err;
            }

            await EconomyService.credit({
                guildId,
                userId,
                account: 'WALLET',
                amount: achievement.reward,
                type: 'ACHIEVEMENT_REWARD',
                sourceRef: `achievement:${achievement.id}`,
            });

            unlocked.push({
                id: achievement.id,
                key: achievement.key,
                name: achievement.name,
                description: achievement.description,
                badgeEmoji: achievement.badgeEmoji,
                reward: achievement.reward,
            });
        }

        return unlocked;
    }
}
