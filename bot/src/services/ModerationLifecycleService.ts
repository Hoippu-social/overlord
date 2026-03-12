import { Client } from 'discord.js';
import logger from '../utils/logger';
import { prisma } from '../utils/database';
import { createModerationCase, isMissingModerationTableError } from './ModerationService';

const POLL_INTERVAL_MS = 60_000;

export class ModerationLifecycleService {
    private static timer: NodeJS.Timeout | null = null;
    private static running = false;
    private static client: Client | null = null;

    static init(client: Client) {
        this.client = client;

        if (this.timer) {
            clearInterval(this.timer);
        }

        this.timer = setInterval(() => {
            void this.processExpiredCases();
        }, POLL_INTERVAL_MS);

        void this.processExpiredCases();
        logger.info('[ModerationLifecycle] Initialized');
    }

    static stop() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }

    private static async processExpiredCases() {
        if (this.running || !this.client) return;
        this.running = true;

        try {
            const expiredCases = await prisma.moderationCase.findMany({
                where: {
                    status: 'ACTIVE',
                    expiresAt: { lte: new Date() },
                    actionType: { in: ['TIMEOUT', 'TEMPBAN'] },
                },
                orderBy: { expiresAt: 'asc' },
                take: 100,
            });

            for (const moderationCase of expiredCases) {
                try {
                    await this.resolveExpiredCase(moderationCase);
                } catch (error) {
                    logger.error(`[ModerationLifecycle] Failed to resolve case #${moderationCase.caseNumber}:`, error);
                }
            }
        } catch (error) {
            if (!isMissingModerationTableError(error)) {
                logger.error('[ModerationLifecycle] Failed to process expired moderation cases:', error);
            }
        } finally {
            this.running = false;
        }
    }

    private static async resolveExpiredCase(moderationCase: {
        id: number;
        guildId: string;
        caseNumber: number;
        actionType: string;
        targetUserId: string;
        reason: string | null;
    }) {
        if (!this.client) return;

        const guild = await this.client.guilds.fetch(moderationCase.guildId).catch(() => null);
        if (!guild) {
            await prisma.moderationCase.update({
                where: { id: moderationCase.id },
                data: { status: 'EXPIRED' },
            });
            return;
        }

        if (moderationCase.actionType === 'TIMEOUT') {
            const member = await guild.members.fetch(moderationCase.targetUserId).catch(() => null);
            if (member) {
                await member.timeout(null, 'Temporary timeout expired').catch(() => null);
            }

            await createModerationCase({
                guildId: moderationCase.guildId,
                actionType: 'UNTIMEOUT',
                source: 'system',
                actorUserId: null,
                targetUserId: moderationCase.targetUserId,
                reason: 'Temporary timeout expired',
                relatedCaseId: moderationCase.id,
                status: 'CLEARED',
                metadata: { expired: true },
            });
        }

        if (moderationCase.actionType === 'TEMPBAN') {
            await guild.bans.remove(moderationCase.targetUserId, 'Temporary ban expired').catch(() => null);

            await createModerationCase({
                guildId: moderationCase.guildId,
                actionType: 'UNBAN',
                source: 'system',
                actorUserId: null,
                targetUserId: moderationCase.targetUserId,
                reason: 'Temporary ban expired',
                relatedCaseId: moderationCase.id,
                status: 'CLEARED',
                metadata: { expired: true },
            });
        }

        await prisma.moderationCase.update({
            where: { id: moderationCase.id },
            data: { status: 'EXPIRED' },
        });
    }
}
