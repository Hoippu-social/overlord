// Typed model for the Economy dashboard workspace.
//
// The dashboard is the config / control / analytics surface for the guild economy.
// Money values cross the wire as decimal STRINGS (Prisma BigInt serialized via
// `@/lib/bigintJson`), never JS numbers — parse with BigInt() when you need math,
// and format for display via `format.ts`. Never coerce a money string to Number()
// for anything but display.

export type LedgerType =
    | 'MESSAGE_EARN' | 'VOICE_EARN' | 'REACTION_EARN' | 'DAILY' | 'WORK' | 'CRIME' | 'CRIME_FINE'
    | 'ROB_STEAL' | 'ROB_FAIL' | 'INVITE_REWARD' | 'SALARY' | 'ROLE_TAX' | 'FINE'
    | 'CONFISCATION' | 'TRANSFER_OUT' | 'TRANSFER_IN' | 'COMMISSION' | 'SHOP_PURCHASE'
    | 'ITEM_USE' | 'MARKET_SALE' | 'MARKET_PURCHASE' | 'MARKET_TAX' | 'LOTTERY_TICKET'
    | 'LOTTERY_WIN' | 'BET' | 'BET_PAYOUT' | 'DUEL_STAKE' | 'DUEL_WIN' | 'RENT_UPKEEP'
    | 'ADMIN_GRANT' | 'ADMIN_DEDUCT' | 'AIRDROP' | 'LOOT_DROP' | 'QUEST_REWARD'
    | 'ACHIEVEMENT_REWARD' | 'SEASON_REWARD' | 'SEASON_RESET' | 'DEPOSIT' | 'WITHDRAW'
    | 'TICKET_BONUS' | 'STATS_TOP_REWARD' | 'CLEAN_RECORD_REWARD' | 'BIRTHDAY_REWARD'
    | 'WORLD_EVENT_REWARD' | 'BOOSTER_BONUS';

// Matches EconomyEarnSource.source keys in the bot schema.
export type EarnSourceKey =
    | 'MESSAGES' | 'VOICE' | 'REACTIONS' | 'BOOSTER' | 'INVITES' | 'DAILY' | 'WORK'
    | 'CRIME' | 'ROB' | 'LOOT_DROP' | 'BIRTHDAY' | 'TICKET_BONUS' | 'STATS_TOP'
    | 'CLEAN_RECORD' | 'WORLD_EVENTS';

export const EARN_SOURCE_KEYS: EarnSourceKey[] = [
    'MESSAGES', 'VOICE', 'REACTIONS', 'BOOSTER', 'INVITES', 'DAILY', 'WORK',
    'CRIME', 'ROB', 'LOOT_DROP', 'BIRTHDAY', 'TICKET_BONUS', 'STATS_TOP',
    'CLEAN_RECORD', 'WORLD_EVENTS',
];

export interface DiscordRoleRef {
    id: string;
    name: string;
    color?: string | number | null;
    position?: number;
}

export interface DiscordChannelRef {
    id: string;
    name: string;
    type?: string | number;
    parentId?: string | null;
}

export interface DiscordEmojiRef {
    id: string;
    name: string;
    animated?: boolean;
    available?: boolean;
    url: string;
    value: string;
}

export interface EconomyConfig {
    enabled: boolean;
    currencyName: string;
    currencyEmoji: string | null;
    startingWallet: string;
    bankInterestBps: number | null;
    demurrageBps: number | null;
    demurrageThreshold: string | null;
    transferCommissionBps: number;
    marketTaxBps: number;
    gamblingEnabled: boolean;
    houseEdgeBps: number;
    minBet: string;
    maxBet: string | null;
    gamblingDailyLossCap: string | null;
    confiscateOnBan: boolean;
}

// Per-source config. `settings` is a free-form JSON object whose shape depends on
// `source`; each panel/editor knows the concrete shape for the source it edits.
// The dashboard treats it opaquely except in the EarnSourcesPanel editors.
export interface EarnSource {
    source: EarnSourceKey;
    enabled: boolean;
    settings: Record<string, unknown>;
}

export interface RoleRule {
    roleId: string;
    earnMultiplier: number;
    salaryAmount: string | null;
    salaryIntervalHours: number | null;
    taxAmount: string | null;
    taxBps: number | null;
    taxIntervalHours: number | null;
    shopDiscountBps: number;
    shopAccessOnly: boolean;
    robProtectionBps: number;
}

export type FineActionType = 'WARN' | 'TIMEOUT' | 'MUTE' | 'KICK' | 'BAN' | 'TEMPBAN' | 'AUTOMOD';

export interface FineRule {
    actionType: FineActionType;
    amount: string | null;
    percentBps: number | null;
    enabled: boolean;
}

export type ShopItemType = 'ROLE' | 'TEMP_ROLE' | 'BADGE' | 'USABLE' | 'CUSTOM';

export interface ShopItem {
    id: number;
    name: string;
    description: string | null;
    emoji: string | null;
    type: ShopItemType;
    price: string;
    roleId: string | null;
    tempRoleHours: number | null;
    useEffect: string | null;
    stock: number | null;
    maxPerUser: number | null;
    requiredRoleIds: string[];
    deniedRoleIds: string[];
    resellable: boolean;
    rentUpkeepAmount: string | null;
    rentUpkeepIntervalHours: number | null;
    enabled: boolean;
    sortOrder: number;
}

export type QuestKind = 'DAILY' | 'WEEKLY';
export type QuestMetric = 'MESSAGES' | 'VOICE_MINUTES' | 'REACTIONS' | 'GAMES_PLAYED' | 'ITEMS_BOUGHT';

export interface QuestTemplate {
    id: number;
    kind: QuestKind;
    metric: QuestMetric;
    target: number;
    reward: string;
    name: string;
    description: string | null;
    enabled: boolean;
    sortOrder: number;
}

export type AchievementMetric =
    | 'TOTAL_EARNED' | 'DAILY_STREAK' | 'GAMES_WON' | 'LOTTERY_WIN' | 'VOICE_MINUTES' | 'MESSAGES';

export interface Achievement {
    id: number;
    key: string;
    name: string;
    description: string | null;
    metric: AchievementMetric;
    threshold: number;
    reward: string;
    badgeEmoji: string | null;
    enabled: boolean;
}

export type EventWindowType = 'MULTIPLIER' | 'AIRDROP';
export type EventWindowStatus = 'SCHEDULED' | 'ACTIVE' | 'DONE' | 'CANCELLED';

export interface EventWindow {
    id: number;
    type: EventWindowType;
    multiplier: number | null;
    amount: string | null;
    channelId: string | null;
    startsAt: string;
    endsAt: string;
    status: EventWindowStatus;
}

export type LotteryStatus = 'OPEN' | 'DRAWN' | 'CANCELLED';

export interface Lottery {
    id: number;
    ticketPrice: string;
    pot: string;
    houseCutBps: number;
    status: LotteryStatus;
    endsAt: string;
    drawnAt: string | null;
    winnerUserId: string | null;
    channelId: string | null;
    ticketCount: number;
}

export type SeasonStatus = 'ACTIVE' | 'ARCHIVED';

export interface Season {
    id: number;
    number: number;
    name: string | null;
    startsAt: string;
    endsAt: string | null;
    status: SeasonStatus;
    rewardsConfig: SeasonRewardBand[];
}

export interface SeasonRewardBand {
    rankFrom: number;
    rankTo: number;
    amount: number;
    roleId?: string;
}

export interface SeasonResultRow {
    userId: string;
    rank: number;
    finalWallet: string;
    finalBank: string;
    totalEarned: string;
    displayName?: string | null;
}

// One member row in the Wallets table.
export interface WalletRow {
    userId: string;
    displayName: string | null;
    avatar: string | null;
    wallet: string;
    bank: string;
    totalEarned: string;
    totalSpent: string;
    dailyStreak: number;
    blacklisted: boolean;
    blacklistReason: string | null;
    topRoleId: string | null;
}

export interface WalletsPage {
    rows: WalletRow[];
    total: number;
    page: number;
    pageSize: number;
}

// One ledger entry in the Ledger browser.
export interface LedgerRow {
    id: string;
    userId: string;
    displayName: string | null;
    type: LedgerType;
    account: 'WALLET' | 'BANK';
    amount: string; // signed
    balanceAfter: string;
    actorId: string | null;
    sourceRef: string | null;
    createdAt: string;
}

export interface LedgerPage {
    rows: LedgerRow[];
    nextCursor: string | null;
}

// Aggregates for the Overview tab.
export interface OverviewData {
    totalWallet: string;
    totalBank: string;
    totalSupply: string; // wallet + bank
    memberCount: number;
    // Emission (money printed) and sinks (money burned) over the selected period,
    // broken down by ledger type. Values are positive magnitudes.
    sources: { type: LedgerType; amount: string }[];
    sinks: { type: LedgerType; amount: string }[];
    emissionTotal: string;
    sinkTotal: string;
    // Daily emission vs sink series for a chart, oldest-first.
    trend: { date: string; emission: string; sink: string }[];
    activeEventCount: number;
}

// Everything the workspace needs on first load (excluding paginated wallets/ledger).
export interface EconomyWorkspaceData {
    config: EconomyConfig;
    earnSources: EarnSource[];
    roleRules: RoleRule[];
    fineRules: FineRule[];
    shopItems: ShopItem[];
    quests: QuestTemplate[];
    achievements: Achievement[];
    eventWindows: EventWindow[];
    lotteries: Lottery[];
    seasons: Season[];
    roles: DiscordRoleRef[];
    channels: DiscordChannelRef[];
    emojis: DiscordEmojiRef[];
    counts: {
        members: number;
        activeShopItems: number;
    };
}

export type WorkspaceTab =
    | 'overview'
    | 'wallets'
    | 'earn'
    | 'shop'
    | 'roles'
    | 'quests'
    | 'events'
    | 'ledger'
    | 'config';

export const WORKSPACE_TAB_KEYS: WorkspaceTab[] = [
    'overview', 'wallets', 'earn', 'shop', 'roles', 'quests', 'events', 'ledger', 'config',
];
