import { Client } from 'discord.js';
import logger from '../utils/logger';
import { prisma } from '../utils/database';
import { isMissingModerationTableError } from './ModerationService';

export const RETENTION_CATEGORIES = [
    'AI_DISMISSED_INCIDENTS',
    'AI_CONFIRMED_INCIDENTS',
    'AUTOMOD_CASE_METADATA',
    'APPEAL_MESSAGES',
    'APPEAL_RESOLUTION_NOTES',
    'CLEARED_CASE_METADATA',
] as const;

type RetentionCategory = (typeof RETENTION_CATEGORIES)[number];
type RetentionStrategy = 'KEEP' | 'TRIM' | 'DELETE';

const DEFAULT_POLICIES: Record<RetentionCategory, { enabled: boolean; strategy: RetentionStrategy; ttlDays: number | null }> = {
    AI_DISMISSED_INCIDENTS: { enabled: true, strategy: 'DELETE', ttlDays: 30 },
    AI_CONFIRMED_INCIDENTS: { enabled: true, strategy: 'TRIM', ttlDays: 90 },
    AUTOMOD_CASE_METADATA: { enabled: true, strategy: 'TRIM', ttlDays: 30 },
    APPEAL_MESSAGES: { enabled: false, strategy: 'TRIM', ttlDays: 180 },
    APPEAL_RESOLUTION_NOTES: { enabled: false, strategy: 'TRIM', ttlDays: 180 },
    CLEARED_CASE_METADATA: { enabled: false, strategy: 'TRIM', ttlDays: 90 },
};

export class RetentionService {
    private static interval: NodeJS.Timeout | null = null;
    private static client: Client | null = null;
    private static running = false;

    static async ensureDefaults(guildId: string) {
        for (const [index, category] of RETENTION_CATEGORIES.entries()) {
            const policy = DEFAULT_POLICIES[category];
            await prisma.retentionPolicy.upsert({
                where: { guildId_category: { guildId, category } },
                update: {},
                create: {
                    guildId,
                    category,
                    enabled: policy.enabled,
                    strategy: policy.strategy,
                    ttlDays: policy.ttlDays,
                },
            });
        }
    }

    static init(client: Client) {
        if (this.interval) return;
        this.client = client;
        void this.runCycle();
        this.interval = setInterval(() => {
            void this.runCycle();
        }, 6 * 60 * 60 * 1000);
    }

    static stop() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
    }

    private static async runCycle() {
        if (this.running) return;
        this.running = true;

        try {
            const guildIds = await prisma.guild.findMany({ select: { id: true } });
            for (const { id } of guildIds) {
                await this.ensureDefaults(id);
            }

            const policies = await prisma.retentionPolicy.findMany({
                where: {
                    enabled: true,
                    ttlDays: { not: null },
                    strategy: { not: 'KEEP' },
                },
            });

            for (const policy of policies) {
                await this.applyPolicy({
                    guildId: policy.guildId,
                    category: policy.category as RetentionCategory,
                    strategy: policy.strategy as RetentionStrategy,
                    ttlDays: policy.ttlDays ?? 0,
                });
            }
        } catch (error) {
            if (!isMissingModerationTableError(error)) {
                logger.error('[RetentionService] Failed to run retention cycle:', error);
            }
        } finally {
            this.running = false;
        }
    }

    private static async applyPolicy(policy: {
        guildId: string;
        category: RetentionCategory;
        strategy: RetentionStrategy;
        ttlDays: number;
    }) {
        if (policy.ttlDays <= 0) return;

        const cutoff = new Date(Date.now() - policy.ttlDays * 24 * 60 * 60 * 1000);

        switch (policy.category) {
            case 'AI_DISMISSED_INCIDENTS':
                if (policy.strategy === 'DELETE') {
                    await prisma.aiModerationIncident.deleteMany({
                        where: {
                            guildId: policy.guildId,
                            status: { in: ['DISMISSED', 'FALSE_POSITIVE'] },
                            createdAt: { lt: cutoff },
                        },
                    });
                } else {
                    await prisma.aiModerationIncident.updateMany({
                        where: {
                            guildId: policy.guildId,
                            status: { in: ['DISMISSED', 'FALSE_POSITIVE'] },
                            createdAt: { lt: cutoff },
                        },
                        data: {
                            excerpt: '[removed by retention policy]',
                            categories: null,
                            summary: null,
                        },
                    });
                }
                break;
            case 'AI_CONFIRMED_INCIDENTS':
                if (policy.strategy === 'DELETE') {
                    await prisma.aiModerationIncident.deleteMany({
                        where: {
                            guildId: policy.guildId,
                            status: { startsWith: 'CONFIRMED' },
                            createdAt: { lt: cutoff },
                        },
                    });
                } else {
                    await prisma.aiModerationIncident.updateMany({
                        where: {
                            guildId: policy.guildId,
                            status: { startsWith: 'CONFIRMED' },
                            createdAt: { lt: cutoff },
                        },
                        data: {
                            excerpt: '[removed by retention policy]',
                            categories: null,
                        },
                    });
                }
                break;
            case 'AUTOMOD_CASE_METADATA':
                await prisma.moderationCase.updateMany({
                    where: {
                        guildId: policy.guildId,
                        source: 'automod',
                        metadata: { not: null },
                        createdAt: { lt: cutoff },
                    },
                    data: {
                        metadata: null,
                    },
                });
                break;
            case 'APPEAL_MESSAGES':
                await prisma.appealTicket.updateMany({
                    where: {
                        guildId: policy.guildId,
                        createdAt: { lt: cutoff },
                    },
                    data: {
                        message: '[removed by retention policy]',
                    },
                });
                break;
            case 'APPEAL_RESOLUTION_NOTES':
                await prisma.appealTicket.updateMany({
                    where: {
                        guildId: policy.guildId,
                        resolutionNote: { not: null },
                        reviewedAt: { lt: cutoff },
                    },
                    data: {
                        resolutionNote: null,
                    },
                });
                break;
            case 'CLEARED_CASE_METADATA':
                await prisma.moderationCase.updateMany({
                    where: {
                        guildId: policy.guildId,
                        status: { in: ['CLEARED', 'EXPIRED', 'REVERTED'] },
                        metadata: { not: null },
                        createdAt: { lt: cutoff },
                    },
                    data: {
                        metadata: null,
                    },
                });
                break;
            default:
                break;
        }
    }
}
