import { Client } from 'discord.js';
import logger from '../utils/logger';
import { prisma } from '../utils/database';
import { logAuditEvent } from '../utils/auditLog';
import { ensureModerationConfig, isMissingModerationTableError, resolveModerationCase } from './ModerationService';

const POLL_INTERVAL_MS = 60_000;

function getExpirationReason(actionType: string) {
    switch (actionType) {
        case 'TIMEOUT':
            return 'Temporary timeout expired';
        case 'TEMPBAN':
            return 'Temporary ban expired';
        case 'MUTE':
            return 'Temporary mute expired';
        default:
            return 'Temporary warning expired';
    }
}

function getExpirationAuditEvent(actionType: string) {
    switch (actionType) {
        case 'TIMEOUT':
            return 'untimeout';
        case 'TEMPBAN':
            return 'unban';
        case 'MUTE':
            return 'unmute';
        default:
            return 'unwarn';
    }
}

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
                    actionType: { in: ['TIMEOUT', 'TEMPBAN', 'MUTE', 'WARN'] },
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
        status: string;
        expiresAt: Date | null;
        metadata: string | null;
    }) {
        if (!this.client) return;

        const guild = await this.client.guilds.fetch(moderationCase.guildId).catch(() => null);
        const expirationReason = getExpirationReason(moderationCase.actionType);
        if (!guild) {
            await resolveModerationCase({
                moderationCase,
                nextStatus: 'EXPIRED',
                resolutionType: 'expired',
                reason: moderationCase.reason ?? expirationReason,
            });
            return;
        }

        if (moderationCase.actionType === 'TIMEOUT') {
            const member = await guild.members.fetch(moderationCase.targetUserId).catch(() => null);
            if (member) {
                await member.timeout(null, 'Temporary timeout expired').catch(() => null);
            }

        }

        if (moderationCase.actionType === 'TEMPBAN') {
            await guild.bans.remove(moderationCase.targetUserId, 'Temporary ban expired').catch(() => null);
        }

        if (moderationCase.actionType === 'MUTE') {
            const member = await guild.members.fetch(moderationCase.targetUserId).catch(() => null);
            if (member) {
                const config = await ensureModerationConfig(guild.id);
                const muteRoleId = config.config.muteRoleId;
                const muteRole = muteRoleId ? guild.roles.cache.get(muteRoleId) : null;
                if (muteRole) {
                    await member.roles.remove(muteRole, 'Temporary mute expired').catch(() => null);
                }
            }
        }

        await resolveModerationCase({
            moderationCase,
            nextStatus: 'EXPIRED',
            resolutionType: 'expired',
            reason: expirationReason,
        });

        await logAuditEvent(this.client, {
            guildId: moderationCase.guildId,
            tag: 'moderation',
            actorId: null,
            targetId: moderationCase.targetUserId,
            payload: {
                event: getExpirationAuditEvent(moderationCase.actionType),
                caseNumber: moderationCase.caseNumber,
                reason: expirationReason,
                expired: true,
            },
            severity: 'INFO',
        });
    }
}
