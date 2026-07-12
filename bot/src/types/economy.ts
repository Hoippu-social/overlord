// Shared type contracts for the Economy module (Phase 1).
// EconomyService.ts and EconomyEarnService.ts both depend on these — keep signatures
// in sync with actual implementations.

export type EconomyLedgerType =
    | 'MESSAGE_EARN' | 'VOICE_EARN' | 'REACTION_EARN' | 'DAILY' | 'WORK' | 'CRIME' | 'CRIME_FINE'
    | 'ROB_STEAL' | 'ROB_FAIL' | 'INVITE_REWARD' | 'SALARY' | 'ROLE_TAX' | 'FINE'
    | 'CONFISCATION' | 'TRANSFER_OUT' | 'TRANSFER_IN' | 'COMMISSION' | 'SHOP_PURCHASE'
    | 'ITEM_USE' | 'MARKET_SALE' | 'MARKET_PURCHASE' | 'MARKET_TAX' | 'LOTTERY_TICKET'
    | 'LOTTERY_WIN' | 'BET' | 'BET_PAYOUT' | 'DUEL_STAKE' | 'DUEL_WIN' | 'RENT_UPKEEP'
    | 'ADMIN_GRANT' | 'ADMIN_DEDUCT' | 'AIRDROP' | 'LOOT_DROP' | 'QUEST_REWARD'
    | 'ACHIEVEMENT_REWARD' | 'SEASON_REWARD' | 'SEASON_RESET' | 'DEPOSIT' | 'WITHDRAW'
    | 'TICKET_BONUS' | 'STATS_TOP_REWARD' | 'CLEAN_RECORD_REWARD' | 'BIRTHDAY_REWARD'
    | 'WORLD_EVENT_REWARD' | 'BOOSTER_BONUS';

export type EconomyAccount = 'WALLET' | 'BANK';

// Matches EconomyEarnSource.source values in prisma/schema.prisma
export type EarnSourceKey =
    | 'MESSAGES' | 'VOICE' | 'REACTIONS' | 'BOOSTER' | 'INVITES' | 'DAILY' | 'WORK'
    | 'CRIME' | 'ROB' | 'LOOT_DROP' | 'BIRTHDAY' | 'TICKET_BONUS' | 'STATS_TOP'
    | 'CLEAN_RECORD' | 'WORLD_EVENTS';

export interface EconomyMutationParams {
    guildId: string;
    userId: string;
    account: EconomyAccount;
    amount: bigint; // always positive; direction implied by credit() vs debit()
    type: EconomyLedgerType;
    actorId?: string | null;
    sourceRef?: string | null;
    /** Unique key for crash-safe, re-runnable mutations (cron payouts, claims). Omit for buffered/best-effort earnings. */
    idempotencyKey?: string | null;
    metadata?: Record<string, unknown>;
}

export interface EconomyTransferParams {
    guildId: string;
    fromUserId: string;
    toUserId: string;
    amount: bigint;
    /** Basis points commission taken from the transferred amount and burned (not credited to a treasury account in Phase 1). */
    commissionBps?: number;
    actorId?: string | null;
    idempotencyKey?: string | null;
}

export type EconomyMutationResult =
    | { ok: true; balanceAfter: bigint }
    | { ok: false; reason: 'INSUFFICIENT_FUNDS' | 'BLACKLISTED' | 'DUPLICATE' | 'DISABLED' | 'NOT_FOUND' };

export interface EarnSourceCacheEntry {
    enabled: boolean;
    settings: Record<string, unknown>;
}

export interface EconomyConfigCache {
    guildId: string;
    enabled: boolean;
    currencyName: string;
    currencyEmoji: string | null;
    startingWallet: bigint;
    transferCommissionBps: number;
    marketTaxBps: number;
    gamblingEnabled: boolean;
    houseEdgeBps: number;
    minBet: bigint;
    maxBet: bigint | null;
    gamblingDailyLossCap: bigint | null;
    confiscateOnBan: boolean;
    earnSources: Map<EarnSourceKey, EarnSourceCacheEntry>;
    roleRules: Map<string, EconomyRoleRuleCache>; // keyed by roleId
    channelMultipliers: Map<string, number>; // keyed by channelId
    fetchedAt: number; // Date.now() at cache time, for TTL checks
}

export interface EconomyRoleRuleCache {
    roleId: string;
    earnMultiplier: number;
    shopDiscountBps: number;
    shopAccessOnly: boolean;
    robProtectionBps: number;
    salaryAmount: bigint | null;
    salaryIntervalHours: number | null;
    taxAmount: bigint | null;
    taxBps: number | null;
    taxIntervalHours: number | null;
}

// -- Per-source settings shapes (stored as JSON in EconomyEarnSource.settings) --
// Phase 1 implements MESSAGES and VOICE; other keys are reserved for later phases
// but the shape is fixed now so the dashboard config UI (later stage) has a stable contract.

export interface MessagesEarnSettings {
    minAmount: number;
    maxAmount: number;
    cooldownSeconds: number;
    minMessageLength: number;
    /** Rolling-hour diminishing returns curve, e.g. [{ afterCount: 10, multiplier: 0.5 }] */
    diminishingSteps: { afterCount: number; multiplier: number }[];
    excludedChannelIds: string[];
    countThreads: boolean;
}

export interface VoiceEarnSettings {
    amountPerMinute: number;
    minMembersInChannel: number;
    excludeAfkChannel: boolean;
    pauseAfterSelfMuteDeafMinutes: number | null;
    dailyCapMinutes: number | null;
    excludedChannelIds: string[];
}

export const DEFAULT_MESSAGES_SETTINGS: MessagesEarnSettings = {
    minAmount: 1,
    maxAmount: 5,
    cooldownSeconds: 60,
    minMessageLength: 3,
    diminishingSteps: [
        { afterCount: 10, multiplier: 0.5 },
        { afterCount: 25, multiplier: 0.25 },
    ],
    excludedChannelIds: [],
    countThreads: true,
};

export const DEFAULT_VOICE_SETTINGS: VoiceEarnSettings = {
    amountPerMinute: 2,
    minMembersInChannel: 2,
    excludeAfkChannel: true,
    pauseAfterSelfMuteDeafMinutes: 10,
    dailyCapMinutes: 240,
    excludedChannelIds: [],
};

export interface ReactionsEarnSettings {
    /** Total reaction count (all emoji combined) a message needs to trigger the bonus, once. */
    threshold: number;
    amount: number;
    dailyCapTriggers: number | null;
}

export const DEFAULT_REACTIONS_SETTINGS: ReactionsEarnSettings = {
    threshold: 5,
    amount: 3,
    dailyCapTriggers: 5,
};
