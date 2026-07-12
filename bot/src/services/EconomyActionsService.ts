import { prisma } from '../utils/database';
import { EconomyService } from './EconomyService';
import { EconomyQuestService } from './EconomyQuestService';
import logger from '../utils/logger';

// -- Per-action settings shapes (stored as JSON in EconomyEarnSource.settings) --
// Local to this file: DAILY / WORK / CRIME / ROB settings + defaults, following the
// same pattern as MessagesEarnSettings/DEFAULT_MESSAGES_SETTINGS in types/economy.ts.

export interface DailyEarnSettings {
    baseAmount: number;
    streakBonusPerDay: number;
    streakCap: number;
    graceHours: number;
}

export const DEFAULT_DAILY_SETTINGS: DailyEarnSettings = {
    baseAmount: 50,
    streakBonusPerDay: 5,
    streakCap: 30,
    graceHours: 48,
};

export interface WorkEarnSettings {
    minAmount: number;
    maxAmount: number;
    cooldownHours: number;
    flavorTexts: string[];
}

export const DEFAULT_WORK_SETTINGS: WorkEarnSettings = {
    minAmount: 20,
    maxAmount: 60,
    cooldownHours: 2,
    flavorTexts: ['You worked a shift and earned some coins.'],
};

export interface CrimeEarnSettings {
    minReward: number;
    maxReward: number;
    successPct: number;
    minFine: number;
    maxFine: number;
    cooldownHours: number;
}

export const DEFAULT_CRIME_SETTINGS: CrimeEarnSettings = {
    minReward: 30,
    maxReward: 100,
    successPct: 50,
    minFine: 20,
    maxFine: 50,
    cooldownHours: 3,
};

export interface RobEarnSettings {
    successPct: number;
    stealPctOfWalletMin: number;
    stealPctOfWalletMax: number;
    cooldownHours: number;
    minTargetWallet: number;
    minTargetAccountAgeDays: number;
}

export const DEFAULT_ROB_SETTINGS: RobEarnSettings = {
    successPct: 40,
    stealPctOfWalletMin: 10,
    stealPctOfWalletMax: 25,
    cooldownHours: 4,
    minTargetWallet: 100,
    minTargetAccountAgeDays: 3,
};

// -- Result types (discriminated unions) --
// A future slash command formats a Discord reply from these; this file only produces data.

export type DailyResult =
    | { ok: true; amount: number; streak: number }
    | { ok: false; reason: 'BLACKLISTED' | 'DISABLED' }
    | { ok: false; reason: 'COOLDOWN'; nextAvailableAt: Date };

export type WorkResult =
    | { ok: true; amount: number; flavorText: string }
    | { ok: false; reason: 'BLACKLISTED' | 'DISABLED' }
    | { ok: false; reason: 'COOLDOWN'; nextAvailableAt: Date };

export type CrimeResult =
    | { ok: true; success: true; amount: number }
    | { ok: true; success: false; fineAmount: number }
    | { ok: false; reason: 'BLACKLISTED' | 'DISABLED' }
    | { ok: false; reason: 'COOLDOWN'; nextAvailableAt: Date };

export type RobResult =
    | { ok: true; success: true; amount: bigint }
    | { ok: true; success: false; fineAmount: bigint }
    | { ok: false; reason: 'BLACKLISTED' | 'DISABLED' | 'SELF_TARGET' | 'TARGET_PROTECTED' | 'TARGET_TOO_POOR' | 'TARGET_SHIELDED' }
    | { ok: false; reason: 'COOLDOWN'; nextAvailableAt: Date };

const HOUR_MS = 60 * 60 * 1000;

function parseSettings<T>(raw: string | null | undefined, defaults: T): T {
    if (!raw) return defaults;
    try {
        const parsed = JSON.parse(raw);
        return { ...defaults, ...parsed };
    } catch {
        return defaults;
    }
}

function randomIntInRange(min: number, max: number): number {
    if (max <= min) return Math.max(0, Math.floor(min));
    return Math.floor(min + Math.random() * (max - min));
}

export class EconomyActionsService {
    static async claimDaily(guildId: string, userId: string): Promise<DailyResult> {
        if (await EconomyService.isBlacklisted(guildId, userId)) return { ok: false, reason: 'BLACKLISTED' };
        if (!(await EconomyService.isSourceEnabled(guildId, 'DAILY'))) return { ok: false, reason: 'DISABLED' };

        const sourceRow = await prisma.economyEarnSource.findUnique({
            where: { guildId_source: { guildId, source: 'DAILY' } },
        });
        const settings = parseSettings<DailyEarnSettings>(sourceRow?.settings, DEFAULT_DAILY_SETTINGS);

        const member = await EconomyService.getOrCreateMember(guildId, userId);
        const now = new Date();

        if (member.lastDailyAt) {
            const elapsedMs = now.getTime() - member.lastDailyAt.getTime();
            if (elapsedMs < 24 * HOUR_MS) {
                return {
                    ok: false,
                    reason: 'COOLDOWN',
                    nextAvailableAt: new Date(member.lastDailyAt.getTime() + 24 * HOUR_MS),
                };
            }
        }

        let newStreak: number;
        if (!member.lastDailyAt) {
            newStreak = 1;
        } else {
            const elapsedMs = now.getTime() - member.lastDailyAt.getTime();
            const graceWindowMs = 24 * HOUR_MS + settings.graceHours * HOUR_MS;
            newStreak = elapsedMs > graceWindowMs ? 1 : Math.min(member.dailyStreak + 1, settings.streakCap);
        }

        const amount = settings.baseAmount + settings.streakBonusPerDay * (newStreak - 1);

        const creditResult = await EconomyService.credit({
            guildId,
            userId,
            account: 'WALLET',
            amount: BigInt(amount),
            type: 'DAILY',
        });

        if (!creditResult.ok) {
            if (creditResult.reason === 'BLACKLISTED') return { ok: false, reason: 'BLACKLISTED' };
            return { ok: false, reason: 'DISABLED' };
        }

        await prisma.economyMember.update({
            where: { guildId_userId: { guildId, userId } },
            data: { dailyStreak: newStreak, lastDailyAt: now },
        });

        EconomyQuestService.checkAchievements(guildId, userId).catch((err: unknown) =>
            logger.error('[EconomyActionsService] Failed to check achievements after daily claim', err)
        );

        return { ok: true, amount, streak: newStreak };
    }

    static async doWork(guildId: string, userId: string): Promise<WorkResult> {
        if (await EconomyService.isBlacklisted(guildId, userId)) return { ok: false, reason: 'BLACKLISTED' };
        if (!(await EconomyService.isSourceEnabled(guildId, 'WORK'))) return { ok: false, reason: 'DISABLED' };

        const sourceRow = await prisma.economyEarnSource.findUnique({
            where: { guildId_source: { guildId, source: 'WORK' } },
        });
        const settings = parseSettings<WorkEarnSettings>(sourceRow?.settings, DEFAULT_WORK_SETTINGS);

        const member = await EconomyService.getOrCreateMember(guildId, userId);
        const now = new Date();

        if (member.lastWorkAt) {
            const elapsedMs = now.getTime() - member.lastWorkAt.getTime();
            const cooldownMs = settings.cooldownHours * HOUR_MS;
            if (elapsedMs < cooldownMs) {
                return {
                    ok: false,
                    reason: 'COOLDOWN',
                    nextAvailableAt: new Date(member.lastWorkAt.getTime() + cooldownMs),
                };
            }
        }

        const amount = randomIntInRange(settings.minAmount, settings.maxAmount);

        const creditResult = await EconomyService.credit({
            guildId,
            userId,
            account: 'WALLET',
            amount: BigInt(amount),
            type: 'WORK',
        });

        if (!creditResult.ok) {
            if (creditResult.reason === 'BLACKLISTED') return { ok: false, reason: 'BLACKLISTED' };
            return { ok: false, reason: 'DISABLED' };
        }

        await prisma.economyMember.update({
            where: { guildId_userId: { guildId, userId } },
            data: { lastWorkAt: now },
        });

        const flavorTexts = settings.flavorTexts.length > 0 ? settings.flavorTexts : DEFAULT_WORK_SETTINGS.flavorTexts;
        const flavorText = flavorTexts[Math.floor(Math.random() * flavorTexts.length)];

        return { ok: true, amount, flavorText };
    }

    static async attemptCrime(guildId: string, userId: string): Promise<CrimeResult> {
        if (await EconomyService.isBlacklisted(guildId, userId)) return { ok: false, reason: 'BLACKLISTED' };
        if (!(await EconomyService.isSourceEnabled(guildId, 'CRIME'))) return { ok: false, reason: 'DISABLED' };

        const sourceRow = await prisma.economyEarnSource.findUnique({
            where: { guildId_source: { guildId, source: 'CRIME' } },
        });
        const settings = parseSettings<CrimeEarnSettings>(sourceRow?.settings, DEFAULT_CRIME_SETTINGS);

        const member = await EconomyService.getOrCreateMember(guildId, userId);
        const now = new Date();

        if (member.lastCrimeAt) {
            const elapsedMs = now.getTime() - member.lastCrimeAt.getTime();
            const cooldownMs = settings.cooldownHours * HOUR_MS;
            if (elapsedMs < cooldownMs) {
                return {
                    ok: false,
                    reason: 'COOLDOWN',
                    nextAvailableAt: new Date(member.lastCrimeAt.getTime() + cooldownMs),
                };
            }
        }

        const success = Math.random() * 100 < settings.successPct;

        if (success) {
            const amount = randomIntInRange(settings.minReward, settings.maxReward);

            const creditResult = await EconomyService.credit({
                guildId,
                userId,
                account: 'WALLET',
                amount: BigInt(amount),
                type: 'CRIME',
            });

            await prisma.economyMember.update({
                where: { guildId_userId: { guildId, userId } },
                data: { lastCrimeAt: now },
            });

            if (!creditResult.ok) {
                if (creditResult.reason === 'BLACKLISTED') return { ok: false, reason: 'BLACKLISTED' };
                return { ok: false, reason: 'DISABLED' };
            }

            return { ok: true, success: true, amount };
        }

        const fine = randomIntInRange(settings.minFine, settings.maxFine);
        const debitResult = await EconomyService.debit({
            guildId,
            userId,
            account: 'WALLET',
            amount: BigInt(fine),
            type: 'CRIME_FINE',
        });

        await prisma.economyMember.update({
            where: { guildId_userId: { guildId, userId } },
            data: { lastCrimeAt: now },
        });

        if (!debitResult.ok) {
            if (debitResult.reason === 'INSUFFICIENT_FUNDS') {
                return { ok: true, success: false, fineAmount: 0 };
            }
            if (debitResult.reason === 'BLACKLISTED') return { ok: false, reason: 'BLACKLISTED' };
            return { ok: false, reason: 'DISABLED' };
        }

        return { ok: true, success: false, fineAmount: fine };
    }

    static async attemptRob(
        guildId: string,
        robberId: string,
        target: { id: string; joinedTimestamp: number | null }
    ): Promise<RobResult> {
        if (await EconomyService.isBlacklisted(guildId, robberId)) return { ok: false, reason: 'BLACKLISTED' };
        if (!(await EconomyService.isSourceEnabled(guildId, 'ROB'))) return { ok: false, reason: 'DISABLED' };

        if (robberId === target.id) return { ok: false, reason: 'SELF_TARGET' };

        const sourceRow = await prisma.economyEarnSource.findUnique({
            where: { guildId_source: { guildId, source: 'ROB' } },
        });
        const settings = parseSettings<RobEarnSettings>(sourceRow?.settings, DEFAULT_ROB_SETTINGS);

        const robber = await EconomyService.getOrCreateMember(guildId, robberId);
        const now = new Date();

        if (robber.lastRobAt) {
            const elapsedMs = now.getTime() - robber.lastRobAt.getTime();
            const cooldownMs = settings.cooldownHours * HOUR_MS;
            if (elapsedMs < cooldownMs) {
                return {
                    ok: false,
                    reason: 'COOLDOWN',
                    nextAvailableAt: new Date(robber.lastRobAt.getTime() + cooldownMs),
                };
            }
        }

        if (
            target.joinedTimestamp != null &&
            Date.now() - target.joinedTimestamp < settings.minTargetAccountAgeDays * 24 * 3600 * 1000
        ) {
            return { ok: false, reason: 'TARGET_PROTECTED' };
        }

        const targetMember = await EconomyService.getOrCreateMember(guildId, target.id);
        if (targetMember.blacklistedAt) return { ok: false, reason: 'TARGET_PROTECTED' };
        if (Number(targetMember.wallet) < settings.minTargetWallet) return { ok: false, reason: 'TARGET_TOO_POOR' };

        const shield = await prisma.economyInventoryItem.findFirst({
            where: {
                guildId,
                userId: target.id,
                status: 'USED',
                roleExpiresAt: { gt: new Date() },
                shopItem: { type: 'USABLE', useEffect: { contains: 'ROB_SHIELD' } },
            },
        });
        if (shield) return { ok: false, reason: 'TARGET_SHIELDED' };

        const rollSuccess = Math.random() * 100 < settings.successPct;

        if (rollSuccess) {
            const stealPct =
                settings.stealPctOfWalletMin +
                Math.random() * (settings.stealPctOfWalletMax - settings.stealPctOfWalletMin);
            let stealAmount = BigInt(Math.floor((Number(targetMember.wallet) * stealPct) / 100));
            if (stealAmount < 1n) stealAmount = 1n;

            const targetDebit = await EconomyService.debit({
                guildId,
                userId: target.id,
                account: 'WALLET',
                amount: stealAmount,
                type: 'ROB_STEAL',
                actorId: robberId,
                sourceRef: `rob_from:${robberId}`,
            });

            if (targetDebit.ok) {
                await EconomyService.credit({
                    guildId,
                    userId: robberId,
                    account: 'WALLET',
                    amount: stealAmount,
                    type: 'ROB_STEAL',
                    actorId: robberId,
                    sourceRef: `rob_target:${target.id}`,
                });

                await prisma.economyMember.update({
                    where: { guildId_userId: { guildId, userId: robberId } },
                    data: { lastRobAt: now },
                });

                return { ok: true, success: true, amount: stealAmount };
            }
            // Target-debit failed (e.g. race condition) — fall through to failure handling below.
        }

        const robberFinePct = settings.stealPctOfWalletMin;
        let fineAmount = BigInt(Math.floor((Number(robber.wallet) * robberFinePct) / 100));
        if (fineAmount <= 0n) fineAmount = robber.wallet > 0n ? 1n : 10n;

        const fineDebit = await EconomyService.debit({
            guildId,
            userId: robberId,
            account: 'WALLET',
            amount: fineAmount,
            type: 'ROB_FAIL',
        });
        // If the debit fails (insufficient funds), no fine was actually taken — report 0n
        // rather than the computed-but-uncollected amount.
        const appliedFine = fineDebit.ok ? fineAmount : 0n;

        await prisma.economyMember.update({
            where: { guildId_userId: { guildId, userId: robberId } },
            data: { lastRobAt: now },
        });

        return { ok: true, success: false, fineAmount: appliedFine };
    }
}
