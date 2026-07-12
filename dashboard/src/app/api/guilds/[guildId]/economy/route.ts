import '@/lib/bigintJson';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorizeGuildApiRequest, isGuildApiAuthFailure } from '@/lib/guildApiAuth';
import type {
    EconomyWorkspaceData,
    EconomyConfig,
    EarnSource,
    EarnSourceKey,
    RoleRule,
    FineRule,
    FineActionType,
    ShopItem,
    ShopItemType,
    QuestTemplate,
    QuestKind,
    QuestMetric,
    Achievement,
    AchievementMetric,
    EventWindow,
    EventWindowType,
    EventWindowStatus,
    Lottery,
    LotteryStatus,
    Season,
    SeasonStatus,
    SeasonRewardBand,
} from '@/lib/economy/types';
import { loadRoles, loadChannels, loadEmojis, invalidateEconomyCache } from './_shared';

export const dynamic = 'force-dynamic';

function parseJsonArray(value: string | null): string[] {
    if (!value) return [];
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
        return [];
    }
}

function parseSettings(value: string | null): Record<string, unknown> {
    if (!value) return {};
    try {
        const parsed = JSON.parse(value);
        return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
    } catch {
        return {};
    }
}

function parseRewardBands(value: string | null): SeasonRewardBand[] {
    if (!value) return [];
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? (parsed as SeasonRewardBand[]) : [];
    } catch {
        return [];
    }
}

const DEFAULT_CONFIG: EconomyConfig = {
    enabled: false,
    currencyName: 'coins',
    currencyEmoji: null,
    startingWallet: '0',
    bankInterestBps: null,
    demurrageBps: null,
    demurrageThreshold: null,
    transferCommissionBps: 0,
    marketTaxBps: 0,
    gamblingEnabled: false,
    houseEdgeBps: 500,
    minBet: '0',
    maxBet: null,
    gamblingDailyLossCap: null,
    confiscateOnBan: false,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapConfig(row: any): EconomyConfig {
    if (!row) return DEFAULT_CONFIG;
    return {
        enabled: row.enabled,
        currencyName: row.currencyName,
        currencyEmoji: row.currencyEmoji,
        startingWallet: String(row.startingWallet),
        bankInterestBps: row.bankInterestBps,
        demurrageBps: row.demurrageBps,
        demurrageThreshold: row.demurrageThreshold != null ? String(row.demurrageThreshold) : null,
        transferCommissionBps: row.transferCommissionBps,
        marketTaxBps: row.marketTaxBps,
        gamblingEnabled: row.gamblingEnabled,
        houseEdgeBps: row.houseEdgeBps,
        minBet: String(row.minBet),
        maxBet: row.maxBet != null ? String(row.maxBet) : null,
        gamblingDailyLossCap: row.gamblingDailyLossCap != null ? String(row.gamblingDailyLossCap) : null,
        confiscateOnBan: row.confiscateOnBan,
    };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapShopItem(row: any): ShopItem {
    return {
        id: row.id,
        name: row.name,
        description: row.description,
        emoji: row.emoji,
        type: row.type as ShopItemType,
        price: String(row.price),
        roleId: row.roleId,
        tempRoleHours: row.tempRoleHours,
        useEffect: row.useEffect,
        stock: row.stock,
        maxPerUser: row.maxPerUser,
        requiredRoleIds: parseJsonArray(row.requiredRoleIds),
        deniedRoleIds: parseJsonArray(row.deniedRoleIds),
        resellable: row.resellable,
        rentUpkeepAmount: row.rentUpkeepAmount != null ? String(row.rentUpkeepAmount) : null,
        rentUpkeepIntervalHours: row.rentUpkeepIntervalHours,
        enabled: row.enabled,
        sortOrder: row.sortOrder,
    };
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ guildId: string }> }) {
    try {
        const { guildId } = await params;
        const auth = await authorizeGuildApiRequest(request, guildId);
        if (isGuildApiAuthFailure(auth)) return auth.response;

        const [
            configRow,
            earnSourceRows,
            roleRuleRows,
            fineRuleRows,
            shopItemRows,
            questRows,
            achievementRows,
            eventWindowRows,
            lotteryRows,
            seasonRows,
            memberCount,
            activeShopItems,
            roles,
            channels,
            emojis,
        ] = await Promise.all([
            prisma.economyConfig.findUnique({ where: { guildId } }),
            prisma.economyEarnSource.findMany({ where: { guildId } }),
            prisma.economyRoleRule.findMany({ where: { guildId } }),
            prisma.economyFineRule.findMany({ where: { guildId } }),
            prisma.economyShopItem.findMany({ where: { guildId }, orderBy: { sortOrder: 'asc' } }),
            prisma.economyQuestTemplate.findMany({ where: { guildId }, orderBy: { sortOrder: 'asc' } }),
            prisma.economyAchievement.findMany({ where: { guildId } }),
            prisma.economyEventWindow.findMany({
                where: { guildId, status: { in: ['SCHEDULED', 'ACTIVE'] } },
                orderBy: { startsAt: 'asc' },
            }),
            prisma.economyLottery.findMany({
                where: { guildId, status: { in: ['OPEN', 'DRAWN'] } },
                orderBy: { id: 'desc' },
                take: 20,
            }),
            prisma.economySeason.findMany({ where: { guildId }, orderBy: { number: 'desc' } }),
            prisma.economyMember.count({ where: { guildId } }),
            prisma.economyShopItem.count({ where: { guildId, enabled: true } }),
            loadRoles(guildId),
            loadChannels(guildId),
            loadEmojis(guildId),
        ]);

        // Ticket counts per lottery.
        const lotteryIds = lotteryRows.map((l) => l.id);
        const ticketCounts = lotteryIds.length
            ? await prisma.economyLotteryTicket.groupBy({
                  by: ['lotteryId'],
                  where: { lotteryId: { in: lotteryIds } },
                  _sum: { count: true },
              })
            : [];
        const ticketCountMap = new Map(ticketCounts.map((t) => [t.lotteryId, t._sum.count ?? 0]));

        const earnSources: EarnSource[] = earnSourceRows.map((row) => ({
            source: row.source as EarnSourceKey,
            enabled: row.enabled,
            settings: parseSettings(row.settings),
        }));

        const roleRules: RoleRule[] = roleRuleRows.map((row) => ({
            roleId: row.roleId,
            earnMultiplier: row.earnMultiplier,
            salaryAmount: row.salaryAmount != null ? String(row.salaryAmount) : null,
            salaryIntervalHours: row.salaryIntervalHours,
            taxAmount: row.taxAmount != null ? String(row.taxAmount) : null,
            taxBps: row.taxBps,
            taxIntervalHours: row.taxIntervalHours,
            shopDiscountBps: row.shopDiscountBps,
            shopAccessOnly: row.shopAccessOnly,
            robProtectionBps: row.robProtectionBps,
        }));

        const fineRules: FineRule[] = fineRuleRows.map((row) => ({
            actionType: row.actionType as FineActionType,
            amount: row.amount != null ? String(row.amount) : null,
            percentBps: row.percentBps,
            enabled: row.enabled,
        }));

        const shopItems: ShopItem[] = shopItemRows.map(mapShopItem);

        const quests: QuestTemplate[] = questRows.map((row) => ({
            id: row.id,
            kind: row.kind as QuestKind,
            metric: row.metric as QuestMetric,
            target: row.target,
            reward: String(row.reward),
            name: row.name,
            description: row.description,
            enabled: row.enabled,
            sortOrder: row.sortOrder,
        }));

        const achievements: Achievement[] = achievementRows.map((row) => ({
            id: row.id,
            key: row.key,
            name: row.name,
            description: row.description,
            metric: row.metric as AchievementMetric,
            threshold: row.threshold,
            reward: String(row.reward),
            badgeEmoji: row.badgeEmoji,
            enabled: row.enabled,
        }));

        const eventWindows: EventWindow[] = eventWindowRows.map((row) => ({
            id: row.id,
            type: row.type as EventWindowType,
            multiplier: row.multiplier,
            amount: row.amount != null ? String(row.amount) : null,
            channelId: row.channelId,
            startsAt: row.startsAt.toISOString(),
            endsAt: row.endsAt.toISOString(),
            status: row.status as EventWindowStatus,
        }));

        const lotteries: Lottery[] = lotteryRows.map((row) => ({
            id: row.id,
            ticketPrice: String(row.ticketPrice),
            pot: String(row.pot),
            houseCutBps: row.houseCutBps,
            status: row.status as LotteryStatus,
            endsAt: row.endsAt.toISOString(),
            drawnAt: row.drawnAt ? row.drawnAt.toISOString() : null,
            winnerUserId: row.winnerUserId,
            channelId: row.channelId,
            ticketCount: ticketCountMap.get(row.id) ?? 0,
        }));

        const seasons: Season[] = seasonRows.map((row) => ({
            id: row.id,
            number: row.number,
            name: row.name,
            startsAt: row.startsAt.toISOString(),
            endsAt: row.endsAt ? row.endsAt.toISOString() : null,
            status: row.status as SeasonStatus,
            rewardsConfig: parseRewardBands(row.rewardsConfig),
        }));

        const data: EconomyWorkspaceData = {
            config: mapConfig(configRow),
            earnSources,
            roleRules,
            fineRules,
            shopItems,
            quests,
            achievements,
            eventWindows,
            lotteries,
            seasons,
            roles,
            channels,
            emojis,
            counts: { members: memberCount, activeShopItems },
        };

        return NextResponse.json(data);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to load economy workspace';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ guildId: string }> }) {
    try {
        const { guildId } = await params;
        const auth = await authorizeGuildApiRequest(request, guildId, { live: true });
        if (isGuildApiAuthFailure(auth)) return auth.response;

        const body = (await request.json()) as EconomyConfig;

        const data = {
            enabled: body.enabled,
            currencyName: body.currencyName,
            currencyEmoji: body.currencyEmoji,
            startingWallet: BigInt(body.startingWallet),
            bankInterestBps: body.bankInterestBps,
            demurrageBps: body.demurrageBps,
            demurrageThreshold: body.demurrageThreshold != null ? BigInt(body.demurrageThreshold) : null,
            transferCommissionBps: body.transferCommissionBps,
            marketTaxBps: body.marketTaxBps,
            gamblingEnabled: body.gamblingEnabled,
            houseEdgeBps: body.houseEdgeBps,
            minBet: BigInt(body.minBet),
            maxBet: body.maxBet != null ? BigInt(body.maxBet) : null,
            gamblingDailyLossCap: body.gamblingDailyLossCap != null ? BigInt(body.gamblingDailyLossCap) : null,
            confiscateOnBan: body.confiscateOnBan,
        };

        await prisma.economyConfig.upsert({
            where: { guildId },
            update: data,
            create: { guildId, ...data },
        });

        await invalidateEconomyCache(guildId);

        return NextResponse.json({ ok: true });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to save config';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
