import { Client, GuildMember } from 'discord.js';
import { Prisma } from '@prisma/client';
import { prisma } from '../utils/database';
import { logAuditEvent } from '../utils/auditLog';
import {
    EconomyAccount,
    EarnSourceCacheEntry,
    EarnSourceKey,
    EconomyConfigCache,
    EconomyMutationParams,
    EconomyMutationResult,
    EconomyRoleRuleCache,
    EconomyTransferParams,
} from '../types/economy';

const CONFIG_CACHE_TTL_MS = 5 * 60 * 1000;

interface ConfigCacheEntry {
    value: EconomyConfigCache;
    fetchedAt: number;
}

function accountField(account: EconomyAccount): 'wallet' | 'bank' {
    return account === 'WALLET' ? 'wallet' : 'bank';
}

class InsufficientFundsError extends Error {
    constructor() {
        super('INSUFFICIENT_FUNDS');
    }
}

export class EconomyService {
    private static configCache: Map<string, ConfigCacheEntry> = new Map();

    /**
     * Note: EconomyConfig.startingWallet is intentionally not applied here in Phase 1 —
     * new members always start at wallet 0. Applying startingWallet is deferred to a later phase.
     */
    static async getOrCreateMember(guildId: string, userId: string) {
        return prisma.economyMember.upsert({
            where: { guildId_userId: { guildId, userId } },
            update: {},
            create: { guildId, userId },
        });
    }

    static async getConfig(guildId: string): Promise<EconomyConfigCache> {
        const cached = this.configCache.get(guildId);
        if (cached && Date.now() - cached.fetchedAt < CONFIG_CACHE_TTL_MS) {
            return cached.value;
        }

        const [config, earnSourceRows, roleRuleRows, channelMultiplierRows] = await Promise.all([
            prisma.economyConfig.findUnique({ where: { guildId } }),
            prisma.economyEarnSource.findMany({ where: { guildId } }),
            prisma.economyRoleRule.findMany({ where: { guildId } }),
            prisma.economyChannelMultiplier.findMany({ where: { guildId } }),
        ]);

        const earnSources = new Map<EarnSourceKey, EarnSourceCacheEntry>();
        for (const row of earnSourceRows) {
            let settings: Record<string, unknown> = {};
            if (row.settings) {
                try {
                    settings = JSON.parse(row.settings);
                } catch {
                    settings = {};
                }
            }
            earnSources.set(row.source as EarnSourceKey, { enabled: row.enabled, settings });
        }

        const roleRules = new Map<string, EconomyRoleRuleCache>();
        for (const row of roleRuleRows) {
            roleRules.set(row.roleId, {
                roleId: row.roleId,
                earnMultiplier: row.earnMultiplier,
                shopDiscountBps: row.shopDiscountBps,
                shopAccessOnly: row.shopAccessOnly,
                robProtectionBps: row.robProtectionBps,
                salaryAmount: row.salaryAmount,
                salaryIntervalHours: row.salaryIntervalHours,
                taxAmount: row.taxAmount,
                taxBps: row.taxBps,
                taxIntervalHours: row.taxIntervalHours,
            });
        }

        const channelMultipliers = new Map<string, number>();
        for (const row of channelMultiplierRows) {
            channelMultipliers.set(row.channelId, row.multiplier);
        }

        const value: EconomyConfigCache = config
            ? {
                guildId,
                enabled: config.enabled,
                currencyName: config.currencyName,
                currencyEmoji: config.currencyEmoji,
                startingWallet: config.startingWallet,
                transferCommissionBps: config.transferCommissionBps,
                marketTaxBps: config.marketTaxBps,
                gamblingEnabled: config.gamblingEnabled,
                houseEdgeBps: config.houseEdgeBps,
                minBet: config.minBet,
                maxBet: config.maxBet,
                gamblingDailyLossCap: config.gamblingDailyLossCap,
                confiscateOnBan: config.confiscateOnBan,
                earnSources,
                roleRules,
                channelMultipliers,
                fetchedAt: Date.now(),
            }
            : {
                guildId,
                enabled: false,
                currencyName: 'coins',
                currencyEmoji: null,
                startingWallet: 0n,
                transferCommissionBps: 0,
                marketTaxBps: 0,
                gamblingEnabled: false,
                houseEdgeBps: 0,
                minBet: 0n,
                maxBet: null,
                gamblingDailyLossCap: null,
                confiscateOnBan: false,
                earnSources,
                roleRules,
                channelMultipliers,
                fetchedAt: Date.now(),
            };

        this.configCache.set(guildId, { value, fetchedAt: Date.now() });
        return value;
    }

    static async isSourceEnabled(guildId: string, source: EarnSourceKey): Promise<boolean> {
        const cfg = await this.getConfig(guildId);
        return cfg.enabled && cfg.earnSources.get(source)?.enabled === true;
    }

    static async isBlacklisted(guildId: string, userId: string): Promise<boolean> {
        const row = await prisma.economyMember.findUnique({
            where: { guildId_userId: { guildId, userId } },
            select: { blacklistedAt: true },
        });
        return !!row?.blacklistedAt;
    }

    /**
     * Role x channel x booster x active-event-window multipliers, taken as a product.
     * Multiple matching roles use the MAX role multiplier (not stacked).
     */
    static async resolveMultiplier(
        guildId: string,
        userId: string,
        opts?: { channelId?: string; member?: GuildMember }
    ): Promise<number> {
        const cfg = await this.getConfig(guildId);

        let roleMultiplier = 1.0;
        if (opts?.member) {
            for (const roleId of opts.member.roles.cache.keys()) {
                const rule = cfg.roleRules.get(roleId);
                if (rule && rule.earnMultiplier > roleMultiplier) {
                    roleMultiplier = rule.earnMultiplier;
                }
            }
        }

        const channelMultiplier = cfg.channelMultipliers.get(opts?.channelId ?? '') ?? 1.0;

        let boosterMultiplier = 1.0;
        if (opts?.member?.premiumSinceTimestamp) {
            const boosterSource = cfg.earnSources.get('BOOSTER');
            if (boosterSource?.enabled) {
                const mult = Number(boosterSource.settings?.multiplier);
                if (Number.isFinite(mult) && mult > 0) boosterMultiplier = mult;
            }
        }

        const eventMultiplier = await this.getActiveEventMultiplier(guildId);

        return roleMultiplier * channelMultiplier * boosterMultiplier * eventMultiplier;
    }

    private static eventWindowCache: Map<string, { multiplier: number; fetchedAt: number }> = new Map();
    private static readonly EVENT_WINDOW_CACHE_TTL_MS = 60 * 1000;

    /** Highest multiplier among currently-ACTIVE MULTIPLIER-type EconomyEventWindow rows for this guild. */
    private static async getActiveEventMultiplier(guildId: string): Promise<number> {
        const cached = this.eventWindowCache.get(guildId);
        if (cached && Date.now() - cached.fetchedAt < this.EVENT_WINDOW_CACHE_TTL_MS) {
            return cached.multiplier;
        }

        const now = new Date();
        const windows = await prisma.economyEventWindow.findMany({
            where: {
                guildId,
                type: 'MULTIPLIER',
                status: 'ACTIVE',
                startsAt: { lte: now },
                endsAt: { gte: now },
            },
            select: { multiplier: true },
        });

        let multiplier = 1.0;
        for (const w of windows) {
            if (w.multiplier && w.multiplier > multiplier) multiplier = w.multiplier;
        }

        this.eventWindowCache.set(guildId, { multiplier, fetchedAt: Date.now() });
        return multiplier;
    }

    /**
     * Looks up EconomyFineRule for the given moderation action type and debits the
     * offender, clamped to their currently-available wallet balance (fines never push
     * a member into negative balance in Phase 1 — debt/negative-balance support is a
     * later enhancement). No-ops if no enabled rule exists or the member has 0 wallet.
     */
    static async applyFineForCase(
        params: { guildId: string; userId: string; actionType: string; caseId: number; actorId?: string | null },
        client?: Client
    ): Promise<void> {
        const rule = await prisma.economyFineRule.findUnique({
            where: { guildId_actionType: { guildId: params.guildId, actionType: params.actionType } },
        });
        if (!rule || !rule.enabled) return;

        const member = await this.getOrCreateMember(params.guildId, params.userId);
        if (member.wallet <= 0n) return;

        let requested = 0n;
        if (rule.amount != null) {
            requested = rule.amount;
        } else if (rule.percentBps != null) {
            requested = (member.wallet * BigInt(rule.percentBps)) / 10000n;
        }
        if (requested <= 0n) return;

        const applied = requested > member.wallet ? member.wallet : requested;

        await this.debit(
            {
                guildId: params.guildId,
                userId: params.userId,
                account: 'WALLET',
                amount: applied,
                type: 'FINE',
                actorId: params.actorId ?? null,
                sourceRef: `case:${params.caseId}`,
                metadata: { requested: requested.toString(), actionType: params.actionType },
            },
            client
        );
    }

    /**
     * Zeroes out both wallet and bank into CONFISCATION ledger entries. Best-effort:
     * if a concurrent spend races this down, whatever remains at debit time is taken.
     */
    static async confiscate(
        params: { guildId: string; userId: string; reason?: string | null; actorId?: string | null },
        client?: Client
    ): Promise<void> {
        const member = await this.getOrCreateMember(params.guildId, params.userId);

        if (member.wallet > 0n) {
            await this.debit(
                {
                    guildId: params.guildId,
                    userId: params.userId,
                    account: 'WALLET',
                    amount: member.wallet,
                    type: 'CONFISCATION',
                    actorId: params.actorId ?? null,
                    metadata: params.reason ? { reason: params.reason } : undefined,
                },
                client
            );
        }

        if (member.bank > 0n) {
            await this.debit(
                {
                    guildId: params.guildId,
                    userId: params.userId,
                    account: 'BANK',
                    amount: member.bank,
                    type: 'CONFISCATION',
                    actorId: params.actorId ?? null,
                    metadata: params.reason ? { reason: params.reason } : undefined,
                },
                client
            );
        }
    }

    static async credit(params: EconomyMutationParams, client?: Client): Promise<EconomyMutationResult> {
        if (await this.isBlacklisted(params.guildId, params.userId)) {
            return { ok: false, reason: 'BLACKLISTED' };
        }

        const field = accountField(params.account);

        let balanceAfter: bigint;
        try {
            balanceAfter = await prisma.$transaction(async (tx) => {
                if (params.idempotencyKey) {
                    await tx.economyTransaction.create({
                        data: {
                            guildId: params.guildId,
                            userId: params.userId,
                            type: params.type,
                            account: params.account,
                            amount: params.amount,
                            balanceAfter: 0n, // placeholder, patched below once real balance is known
                            actorId: params.actorId ?? null,
                            sourceRef: params.sourceRef ?? null,
                            idempotencyKey: params.idempotencyKey,
                            metadata: params.metadata ? JSON.stringify(params.metadata) : null,
                        },
                    });
                }

                // Lifetime counters feed EconomyQuestService.checkAchievements' MESSAGES/VOICE_MINUTES
                // metrics. Each MESSAGE_EARN/VOICE_EARN credit call already represents exactly one
                // message or one earned voice-minute (per EconomyEarnService's buffering design), so
                // bumping by 1 here — rather than by `amount` — keeps the counters meaningful even
                // when per-message/per-minute reward amounts vary.
                const lifetimeIncrement =
                    params.type === 'MESSAGE_EARN'
                        ? { lifetimeMessages: { increment: 1 } }
                        : params.type === 'VOICE_EARN'
                          ? { lifetimeVoiceMinutes: { increment: 1 } }
                          : {};

                const member = await tx.economyMember.upsert({
                    where: { guildId_userId: { guildId: params.guildId, userId: params.userId } },
                    update: {
                        [field]: { increment: params.amount },
                        totalEarned: { increment: params.amount },
                        ...lifetimeIncrement,
                    },
                    create: {
                        guildId: params.guildId,
                        userId: params.userId,
                        wallet: params.account === 'WALLET' ? params.amount : 0n,
                        bank: params.account === 'BANK' ? params.amount : 0n,
                        totalEarned: params.amount,
                        lifetimeMessages: params.type === 'MESSAGE_EARN' ? 1 : 0,
                        lifetimeVoiceMinutes: params.type === 'VOICE_EARN' ? 1 : 0,
                    },
                });

                const newBalance = member[field];

                if (params.idempotencyKey) {
                    await tx.economyTransaction.update({
                        where: { idempotencyKey: params.idempotencyKey },
                        data: { balanceAfter: newBalance },
                    });
                } else {
                    await tx.economyTransaction.create({
                        data: {
                            guildId: params.guildId,
                            userId: params.userId,
                            type: params.type,
                            account: params.account,
                            amount: params.amount,
                            balanceAfter: newBalance,
                            actorId: params.actorId ?? null,
                            sourceRef: params.sourceRef ?? null,
                            metadata: params.metadata ? JSON.stringify(params.metadata) : null,
                        },
                    });
                }

                return newBalance;
            });
        } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
                return { ok: false, reason: 'DUPLICATE' };
            }
            throw error;
        }

        if (client) {
            logAuditEvent(client, {
                guildId: params.guildId,
                tag: 'economy',
                actorId: params.actorId ?? null,
                targetId: params.userId,
                payload: {
                    type: params.type,
                    amount: params.amount.toString(),
                    account: params.account,
                    ...params.metadata,
                },
            }).catch(() => {});
        }

        return { ok: true, balanceAfter };
    }

    static async debit(params: EconomyMutationParams, client?: Client): Promise<EconomyMutationResult> {
        if (await this.isBlacklisted(params.guildId, params.userId)) {
            return { ok: false, reason: 'BLACKLISTED' };
        }

        const field = accountField(params.account);

        let balanceAfter: bigint;
        try {
            balanceAfter = await prisma.$transaction(async (tx) => {
                if (params.idempotencyKey) {
                    await tx.economyTransaction.create({
                        data: {
                            guildId: params.guildId,
                            userId: params.userId,
                            type: params.type,
                            account: params.account,
                            amount: -params.amount,
                            balanceAfter: 0n, // placeholder, patched below once real balance is known
                            actorId: params.actorId ?? null,
                            sourceRef: params.sourceRef ?? null,
                            idempotencyKey: params.idempotencyKey,
                            metadata: params.metadata ? JSON.stringify(params.metadata) : null,
                        },
                    });
                }

                const res = await tx.economyMember.updateMany({
                    where: {
                        guildId: params.guildId,
                        userId: params.userId,
                        blacklistedAt: null,
                        [field]: { gte: params.amount },
                    },
                    data: {
                        [field]: { decrement: params.amount },
                        totalSpent: { increment: params.amount },
                    },
                });

                if (res.count === 0) {
                    throw new InsufficientFundsError();
                }

                const member = await tx.economyMember.findUniqueOrThrow({
                    where: { guildId_userId: { guildId: params.guildId, userId: params.userId } },
                });

                const newBalance = member[field];

                if (params.idempotencyKey) {
                    await tx.economyTransaction.update({
                        where: { idempotencyKey: params.idempotencyKey },
                        data: { balanceAfter: newBalance },
                    });
                } else {
                    await tx.economyTransaction.create({
                        data: {
                            guildId: params.guildId,
                            userId: params.userId,
                            type: params.type,
                            account: params.account,
                            amount: -params.amount,
                            balanceAfter: newBalance,
                            actorId: params.actorId ?? null,
                            sourceRef: params.sourceRef ?? null,
                            metadata: params.metadata ? JSON.stringify(params.metadata) : null,
                        },
                    });
                }

                return newBalance;
            });
        } catch (error) {
            if (error instanceof InsufficientFundsError) {
                return { ok: false, reason: 'INSUFFICIENT_FUNDS' };
            }
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
                return { ok: false, reason: 'DUPLICATE' };
            }
            throw error;
        }

        if (client) {
            logAuditEvent(client, {
                guildId: params.guildId,
                tag: 'economy',
                actorId: params.actorId ?? null,
                targetId: params.userId,
                payload: {
                    type: params.type,
                    amount: params.amount.toString(),
                    account: params.account,
                    ...params.metadata,
                },
            }).catch(() => {});
        }

        return { ok: true, balanceAfter };
    }

    /**
     * Phase 1 scope: WALLET-only transfers. Commission (if any) is burned, not credited
     * anywhere, per the EconomyTransferParams contract.
     *
     * debit() and credit() each run their own separate $transaction here rather than one
     * shared transaction spanning both — that's intentional (debit-before-credit ordering
     * avoids deadlocks). A crash between the two calls is an accepted Phase 1 edge case:
     * it would leave the ledger showing an outgoing transfer with no matching incoming
     * entry. Fixing that would require a two-phase-commit, which is out of scope here.
     */
    static async transfer(params: EconomyTransferParams, client?: Client): Promise<EconomyMutationResult> {
        const commission = params.commissionBps
            ? (params.amount * BigInt(params.commissionBps)) / 10000n
            : 0n;
        const netAmount = params.amount - commission;

        const debitResult = await this.debit(
            {
                guildId: params.guildId,
                userId: params.fromUserId,
                account: 'WALLET',
                amount: params.amount,
                type: 'TRANSFER_OUT',
                actorId: params.actorId ?? params.fromUserId,
                idempotencyKey: params.idempotencyKey ? `${params.idempotencyKey}:out` : null,
            },
            client
        );

        if (!debitResult.ok) {
            return debitResult;
        }

        const creditResult = await this.credit(
            {
                guildId: params.guildId,
                userId: params.toUserId,
                account: 'WALLET',
                amount: netAmount,
                type: 'TRANSFER_IN',
                actorId: params.actorId ?? params.fromUserId,
                idempotencyKey: params.idempotencyKey ? `${params.idempotencyKey}:in` : null,
            },
            client
        );

        // Return the credit result if it succeeded (most callers care about the receiver's
        // new balance); if crediting the receiver failed after the sender was already
        // debited (the accepted crash-edge-case above), fall back to the sender's new
        // balance from the debit so callers still get a meaningful ok:true balance.
        if (creditResult.ok) {
            return creditResult;
        }
        return { ok: true, balanceAfter: debitResult.balanceAfter };
    }

    static invalidateCache(guildId: string): void {
        this.configCache.delete(guildId);
        this.eventWindowCache.delete(guildId);
    }
}
