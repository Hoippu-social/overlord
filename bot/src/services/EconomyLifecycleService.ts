import { Client } from 'discord.js';
import { prisma, statsPrisma } from '../utils/database';
import logger from '../utils/logger';
import { EconomyService } from './EconomyService';
import { EconomyGameService } from './EconomyGameService';
import { EconomyPvpService } from './EconomyPvpService';
import { EconomyQuestService } from './EconomyQuestService';

const SHORT_SWEEP_INTERVAL_MS = 60 * 1000; // every 1 minute
const HOURLY_SWEEP_INTERVAL_MS = 60 * 60 * 1000; // every 1 hour

let shortSweepTimer: ReturnType<typeof setInterval> | null = null;
let hourlySweepTimer: ReturnType<typeof setInterval> | null = null;

// ─── Local settings shapes (JSON stored on EconomyEarnSource.settings) ───────

interface InvitesEarnSettings {
    amount: number;
    minStayDays: number;
    weeklyCapPerInviter?: number;
}

interface BirthdayEarnSettings {
    amount: number;
}

interface StatsTopEarnSettings {
    period: string;
    category: string;
    rewards: { rank: number; amount: number }[];
}

interface CleanRecordEarnSettings {
    days: number;
    amount: number;
}

interface WorldEventsEarnSettings {
    chancePerHour: number;
    durationHours: number;
    multiplier: number;
}

const DEFAULT_STATS_TOP_SETTINGS: StatsTopEarnSettings = {
    period: '7D',
    category: 'MESSAGES',
    rewards: [
        { rank: 1, amount: 200 },
        { rank: 2, amount: 100 },
        { rank: 3, amount: 50 },
    ],
};

const DEFAULT_CLEAN_RECORD_SETTINGS: CleanRecordEarnSettings = { days: 30, amount: 100 };

const DEFAULT_WORLD_EVENTS_SETTINGS: WorldEventsEarnSettings = {
    chancePerHour: 2,
    durationHours: 1,
    multiplier: 3,
};

function parseSettings<T>(raw: string | null | undefined, fallback: T): T {
    if (!raw) return fallback;
    try {
        return { ...fallback, ...JSON.parse(raw) };
    } catch {
        return fallback;
    }
}

async function getSourceSettings<T>(guildId: string, source: string, fallback: T): Promise<T> {
    const row = await prisma.economyEarnSource.findUnique({
        where: { guildId_source: { guildId, source } },
    });
    return parseSettings<T>(row?.settings, fallback);
}

function todayMonthDay(): string {
    const now = new Date();
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    const day = String(now.getUTCDate()).padStart(2, '0');
    return `${month}-${day}`;
}

/** ISO 8601 week key, e.g. "2026-W27". Used to scope stats-top rewards to once per week per rank. */
function getIsoWeekKey(date: Date = new Date()): string {
    const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
    return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

// ─── 1-minute sweep ────────────────────────────────────────────────────────

async function sweepLotteryDraws(): Promise<void> {
    const due = await prisma.economyLottery.findMany({
        where: { status: 'OPEN', endsAt: { lte: new Date() } },
    });

    for (const lottery of due) {
        try {
            const tickets = await prisma.economyLotteryTicket.findMany({
                where: { lotteryId: lottery.id },
            });

            if (tickets.length === 0) {
                await prisma.economyLottery.update({
                    where: { id: lottery.id },
                    data: { status: 'CANCELLED' },
                });
                continue;
            }

            const pool: string[] = [];
            for (const ticket of tickets) {
                for (let i = 0; i < ticket.count; i++) pool.push(ticket.userId);
            }

            if (pool.length === 0) {
                await prisma.economyLottery.update({
                    where: { id: lottery.id },
                    data: { status: 'CANCELLED' },
                });
                continue;
            }

            const winnerUserId = pool[Math.floor(Math.random() * pool.length)];
            const payout = lottery.pot - (lottery.pot * BigInt(lottery.houseCutBps)) / 10000n;

            if (payout > 0n) {
                await EconomyService.credit({
                    guildId: lottery.guildId,
                    userId: winnerUserId,
                    account: 'WALLET',
                    amount: payout,
                    type: 'LOTTERY_WIN',
                    sourceRef: `lottery:${lottery.id}`,
                });
            }

            await prisma.economyLottery.update({
                where: { id: lottery.id },
                data: { status: 'DRAWN', drawnAt: new Date(), winnerUserId },
            });
        } catch (err) {
            logger.warn(`[EconomyLifecycle] Lottery draw failed for lottery ${lottery.id}:`, err);
        }
    }
}

async function sweepGameHousekeeping(): Promise<void> {
    try {
        await EconomyGameService.expireStaleDuels();
    } catch (err) {
        logger.warn('[EconomyLifecycle] Duel expiry sweep failed:', err);
    }

    EconomyGameService.cleanupExpiredSessions();

    try {
        await EconomyPvpService.expireStaleMatches();
    } catch (err) {
        logger.warn('[EconomyLifecycle] PvP match expiry sweep failed:', err);
    }
}

async function sweepEventWindows(client: Client): Promise<void> {
    const startingWindows = await prisma.economyEventWindow.findMany({
        where: { status: 'SCHEDULED', startsAt: { lte: new Date() } },
    });

    for (const window of startingWindows) {
        try {
            if (window.type === 'AIRDROP') {
                await executeAirdrop(client, window);
                await prisma.economyEventWindow.update({
                    where: { id: window.id },
                    data: { status: 'DONE' },
                });
            } else {
                await prisma.economyEventWindow.update({
                    where: { id: window.id },
                    data: { status: 'ACTIVE' },
                });
            }
        } catch (err) {
            logger.warn(`[EconomyLifecycle] Failed to start event window ${window.id}:`, err);
        }
    }

    const endingWindows = await prisma.economyEventWindow.findMany({
        where: { status: 'ACTIVE', endsAt: { lte: new Date() } },
    });

    for (const window of endingWindows) {
        try {
            await prisma.economyEventWindow.update({
                where: { id: window.id },
                data: { status: 'DONE' },
            });
        } catch (err) {
            logger.warn(`[EconomyLifecycle] Failed to end event window ${window.id}:`, err);
        }
    }
}

async function executeAirdrop(
    client: Client,
    window: { id: number; guildId: string; channelId: string | null; amount: bigint | null }
): Promise<void> {
    try {
        if (!window.channelId || window.amount == null) return;

        const channel = await client.channels.fetch(window.channelId).catch(() => null);
        if (!channel || !('guild' in channel) || !channel.guild) return;

        const recipients = Array.from(channel.guild.members.cache.filter((m) => !m.user.bot).values()).slice(
            0,
            200
        );

        for (const member of recipients) {
            try {
                await EconomyService.credit({
                    guildId: window.guildId,
                    userId: member.id,
                    account: 'WALLET',
                    amount: window.amount,
                    type: 'AIRDROP',
                    sourceRef: `event:${window.id}`,
                });
            } catch (err) {
                logger.warn(`[EconomyLifecycle] Airdrop credit failed for ${member.id}:`, err);
            }
        }

        if ('send' in channel && typeof channel.send === 'function') {
            await channel
                .send({
                    content: `🎁 Airdrop! ${recipients.length} members received ${window.amount} coins.`,
                })
                .catch(() => null);
        }
    } catch (err) {
        logger.warn(`[EconomyLifecycle] Airdrop execution failed for window ${window.id}:`, err);
    }
}

async function removeInventoryRole(
    client: Client,
    item: { guildId: string; userId: string },
    roleId: string
): Promise<void> {
    const guild = client.guilds.cache.get(item.guildId);
    const member = await guild?.members.fetch(item.userId).catch(() => null);
    await member?.roles.remove(roleId).catch(() => null);
}

async function sweepTempRoleExpiry(client: Client): Promise<void> {
    const expired = await prisma.economyInventoryItem.findMany({
        where: { status: 'OWNED', roleExpiresAt: { lte: new Date() } },
        include: { shopItem: true },
    });

    for (const item of expired) {
        try {
            if (item.shopItem.roleId) {
                await removeInventoryRole(client, item, item.shopItem.roleId);
            }

            await prisma.economyInventoryItem.update({
                where: { id: item.id },
                data: { status: 'EXPIRED' },
            });
        } catch (err) {
            logger.warn(`[EconomyLifecycle] Temp-role expiry failed for inventory item ${item.id}:`, err);
        }
    }
}

async function sweepRentUpkeep(client: Client): Promise<void> {
    const due = await prisma.economyInventoryItem.findMany({
        where: { status: 'OWNED', nextUpkeepAt: { lte: new Date() } },
        include: { shopItem: true },
    });

    for (const item of due) {
        try {
            if (item.shopItem.rentUpkeepAmount == null) continue;

            const result = await EconomyService.debit({
                guildId: item.guildId,
                userId: item.userId,
                account: 'WALLET',
                amount: item.shopItem.rentUpkeepAmount,
                type: 'RENT_UPKEEP',
                sourceRef: `inventoryItem:${item.id}`,
            });

            if (result.ok) {
                const intervalHours = item.shopItem.rentUpkeepIntervalHours ?? 24;
                await prisma.economyInventoryItem.update({
                    where: { id: item.id },
                    data: { nextUpkeepAt: new Date(Date.now() + intervalHours * 3600000) },
                });
            } else {
                if (item.shopItem.roleId) {
                    await removeInventoryRole(client, item, item.shopItem.roleId);
                }
                await prisma.economyInventoryItem.update({
                    where: { id: item.id },
                    data: { status: 'EXPIRED' },
                });
            }
        } catch (err) {
            logger.warn(`[EconomyLifecycle] Rent upkeep failed for inventory item ${item.id}:`, err);
        }
    }
}

async function runShortSweep(client: Client): Promise<void> {
    await sweepLotteryDraws();
    await sweepGameHousekeeping();
    await sweepEventWindows(client);
    await sweepTempRoleExpiry(client);
    await sweepRentUpkeep(client);
}

// ─── 1-hour sweep ──────────────────────────────────────────────────────────

async function sweepRoleSalaries(client: Client): Promise<void> {
    const rules = await prisma.economyRoleRule.findMany({
        where: { salaryAmount: { not: null }, salaryIntervalHours: { not: null } },
    });

    for (const rule of rules) {
        try {
            const guild = client.guilds.cache.get(rule.guildId);
            if (!guild) continue;

            const periodBucket = Math.floor(Date.now() / (rule.salaryIntervalHours! * 3600000));
            const members = guild.members.cache.filter(
                (m) => m.roles.cache.has(rule.roleId) && !m.user.bot
            );

            for (const member of members.values()) {
                try {
                    await EconomyService.credit({
                        guildId: rule.guildId,
                        userId: member.id,
                        account: 'WALLET',
                        amount: rule.salaryAmount!,
                        type: 'SALARY',
                        idempotencyKey: `salary:${rule.guildId}:${rule.roleId}:${member.id}:${periodBucket}`,
                    });
                } catch (err) {
                    logger.warn(
                        `[EconomyLifecycle] Salary payout failed for ${member.id} in guild ${rule.guildId}:`,
                        err
                    );
                }
            }
        } catch (err) {
            logger.warn(`[EconomyLifecycle] Salary sweep failed for role rule ${rule.id}:`, err);
        }
    }
}

async function sweepRoleTaxes(client: Client): Promise<void> {
    const rules = await prisma.economyRoleRule.findMany({
        where: {
            taxIntervalHours: { not: null },
            OR: [{ taxAmount: { not: null } }, { taxBps: { not: null } }],
        },
    });

    for (const rule of rules) {
        try {
            const guild = client.guilds.cache.get(rule.guildId);
            if (!guild) continue;

            const periodBucket = Math.floor(Date.now() / (rule.taxIntervalHours! * 3600000));
            const members = guild.members.cache.filter(
                (m) => m.roles.cache.has(rule.roleId) && !m.user.bot
            );

            for (const member of members.values()) {
                try {
                    const idempotencyKey = `tax:${rule.guildId}:${rule.roleId}:${member.id}:${periodBucket}`;

                    if (rule.taxAmount != null) {
                        await EconomyService.debit({
                            guildId: rule.guildId,
                            userId: member.id,
                            account: 'WALLET',
                            amount: rule.taxAmount,
                            type: 'ROLE_TAX',
                            idempotencyKey,
                        });
                    } else if (rule.taxBps != null) {
                        const memberRow = await EconomyService.getOrCreateMember(rule.guildId, member.id);
                        const amount = (memberRow.wallet * BigInt(rule.taxBps)) / 10000n;
                        if (amount <= 0n) continue;

                        await EconomyService.debit({
                            guildId: rule.guildId,
                            userId: member.id,
                            account: 'WALLET',
                            amount,
                            type: 'ROLE_TAX',
                            idempotencyKey,
                        });
                    }
                } catch (err) {
                    logger.warn(
                        `[EconomyLifecycle] Tax collection failed for ${member.id} in guild ${rule.guildId}:`,
                        err
                    );
                }
            }
        } catch (err) {
            logger.warn(`[EconomyLifecycle] Tax sweep failed for role rule ${rule.id}:`, err);
        }
    }
}

async function sweepInviteRewards(guildId: string): Promise<void> {
    const settings = await getSourceSettings<InvitesEarnSettings>(guildId, 'INVITES', {
        amount: 50,
        minStayDays: 7,
    });

    const rows = await statsPrisma.inviteUseEvent.findMany({
        where: {
            guildId,
            inviterId: { not: null },
            leftAt: null,
            joinedAt: { lte: new Date(Date.now() - settings.minStayDays * 86400000) },
        },
        take: 200,
    });

    for (const row of rows) {
        if (!row.inviterId || row.inviterId === row.memberId) continue;

        try {
            await EconomyService.credit({
                guildId,
                userId: row.inviterId,
                account: 'WALLET',
                amount: BigInt(settings.amount),
                type: 'INVITE_REWARD',
                idempotencyKey: `invite:${guildId}:${row.memberId}`,
            });
        } catch (err) {
            logger.warn(`[EconomyLifecycle] Invite reward failed for inviter ${row.inviterId}:`, err);
        }
    }
}

async function sweepBirthdays(guildId: string): Promise<void> {
    const settings = await getSourceSettings<BirthdayEarnSettings>(guildId, 'BIRTHDAY', { amount: 100 });

    const members = await prisma.economyMember.findMany({
        where: { guildId, birthday: todayMonthDay() },
    });

    for (const member of members) {
        try {
            await EconomyService.credit({
                guildId,
                userId: member.userId,
                account: 'WALLET',
                amount: BigInt(settings.amount),
                type: 'BIRTHDAY_REWARD',
                idempotencyKey: `birthday:${guildId}:${member.userId}:${new Date().getUTCFullYear()}`,
            });
        } catch (err) {
            logger.warn(`[EconomyLifecycle] Birthday reward failed for ${member.userId}:`, err);
        }
    }
}

async function sweepStatsTopRewards(guildId: string): Promise<void> {
    const settings = await getSourceSettings<StatsTopEarnSettings>(
        guildId,
        'STATS_TOP',
        DEFAULT_STATS_TOP_SETTINGS
    );
    if (settings.rewards.length === 0) return;

    const maxRank = Math.max(...settings.rewards.map((r) => r.rank));
    const rows = await statsPrisma.statTopMember.findMany({
        where: { guildId, period: settings.period, category: settings.category },
        orderBy: { value: 'desc' },
        take: maxRank,
    });

    const weekKey = getIsoWeekKey();

    for (let i = 0; i < rows.length; i++) {
        const rank = i + 1;
        const reward = settings.rewards.find((r) => r.rank === rank);
        if (!reward) continue;

        const row = rows[i];
        try {
            await EconomyService.credit({
                guildId,
                userId: row.userId,
                account: 'WALLET',
                amount: BigInt(reward.amount),
                type: 'STATS_TOP_REWARD',
                idempotencyKey: `stats_top:${guildId}:${settings.period}:${settings.category}:${rank}:${weekKey}`,
            });
        } catch (err) {
            logger.warn(`[EconomyLifecycle] Stats-top reward failed for ${row.userId}:`, err);
        }
    }
}

async function sweepCleanRecordBonus(guildId: string): Promise<void> {
    const settings = await getSourceSettings<CleanRecordEarnSettings>(
        guildId,
        'CLEAN_RECORD',
        DEFAULT_CLEAN_RECORD_SETTINGS
    );

    const recentlyActive = await prisma.economyMember.findMany({
        where: { guildId, updatedAt: { gte: new Date(Date.now() - 7 * 86400000) } },
        take: 100,
    });

    const monthKey = new Date().toISOString().slice(0, 7);

    for (const member of recentlyActive) {
        try {
            const caseCount = await prisma.moderationCase.count({
                where: {
                    guildId,
                    targetUserId: member.userId,
                    createdAt: { gte: new Date(Date.now() - settings.days * 86400000) },
                },
            });
            if (caseCount > 0) continue;

            await EconomyService.credit({
                guildId,
                userId: member.userId,
                account: 'WALLET',
                amount: BigInt(settings.amount),
                type: 'CLEAN_RECORD_REWARD',
                idempotencyKey: `clean_record:${guildId}:${member.userId}:${monthKey}`,
            });
        } catch (err) {
            logger.warn(`[EconomyLifecycle] Clean-record bonus failed for ${member.userId}:`, err);
        }
    }
}

async function sweepWorldEvents(guildId: string): Promise<void> {
    const settings = await getSourceSettings<WorldEventsEarnSettings>(
        guildId,
        'WORLD_EVENTS',
        DEFAULT_WORLD_EVENTS_SETTINGS
    );

    if (Math.random() * 100 >= settings.chancePerHour) return;

    const activeCount = await prisma.economyEventWindow.count({
        where: { guildId, type: 'MULTIPLIER', status: 'ACTIVE' },
    });
    if (activeCount > 0) return;

    await prisma.economyEventWindow.create({
        data: {
            guildId,
            type: 'MULTIPLIER',
            multiplier: settings.multiplier,
            startsAt: new Date(),
            endsAt: new Date(Date.now() + settings.durationHours * 3600000),
            status: 'ACTIVE',
            createdBy: 'system',
        },
    });
}

/**
 * Passive-accumulation achievements (TOTAL_EARNED, MESSAGES, VOICE_MINUTES) can cross
 * their threshold without any single triggering action, so they're checked periodically
 * here rather than after every earn event. Bounded to recently-active members, same
 * cost-limiting approach as sweepCleanRecordBonus.
 */
async function sweepAchievements(guildId: string): Promise<void> {
    const recentlyActive = await prisma.economyMember.findMany({
        where: { guildId, updatedAt: { gte: new Date(Date.now() - 7 * 86400000) } },
        take: 100,
    });

    for (const member of recentlyActive) {
        try {
            await EconomyQuestService.checkAchievements(guildId, member.userId);
        } catch (err) {
            logger.warn(`[EconomyLifecycle] Achievement check failed for ${member.userId}:`, err);
        }
    }
}

async function runHourlySweep(client: Client): Promise<void> {
    await sweepRoleSalaries(client);
    await sweepRoleTaxes(client);

    for (const guild of client.guilds.cache.values()) {
        try {
            if (await EconomyService.isSourceEnabled(guild.id, 'INVITES')) {
                await sweepInviteRewards(guild.id);
            }
        } catch (err) {
            logger.warn(`[EconomyLifecycle] Invite reward sweep failed for guild ${guild.id}:`, err);
        }

        try {
            if (await EconomyService.isSourceEnabled(guild.id, 'BIRTHDAY')) {
                await sweepBirthdays(guild.id);
            }
        } catch (err) {
            logger.warn(`[EconomyLifecycle] Birthday sweep failed for guild ${guild.id}:`, err);
        }

        try {
            if (await EconomyService.isSourceEnabled(guild.id, 'STATS_TOP')) {
                await sweepStatsTopRewards(guild.id);
            }
        } catch (err) {
            logger.warn(`[EconomyLifecycle] Stats-top sweep failed for guild ${guild.id}:`, err);
        }

        try {
            if (await EconomyService.isSourceEnabled(guild.id, 'CLEAN_RECORD')) {
                await sweepCleanRecordBonus(guild.id);
            }
        } catch (err) {
            logger.warn(`[EconomyLifecycle] Clean-record sweep failed for guild ${guild.id}:`, err);
        }

        try {
            if (await EconomyService.isSourceEnabled(guild.id, 'WORLD_EVENTS')) {
                await sweepWorldEvents(guild.id);
            }
        } catch (err) {
            logger.warn(`[EconomyLifecycle] World-events sweep failed for guild ${guild.id}:`, err);
        }

        try {
            await sweepAchievements(guild.id);
        } catch (err) {
            logger.warn(`[EconomyLifecycle] Achievement sweep failed for guild ${guild.id}:`, err);
        }
    }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export const EconomyLifecycleService = {
    init(client: Client) {
        if (shortSweepTimer || hourlySweepTimer) return;

        shortSweepTimer = setInterval(() => {
            runShortSweep(client).catch((err) => logger.error('[EconomyLifecycle] Short sweep failed', err));
        }, SHORT_SWEEP_INTERVAL_MS);

        hourlySweepTimer = setInterval(() => {
            runHourlySweep(client).catch((err) => logger.error('[EconomyLifecycle] Hourly sweep failed', err));
        }, HOURLY_SWEEP_INTERVAL_MS);

        logger.info('[EconomyLifecycle] Initialized (1-min short sweep + 1-hour sweep)');
    },

    stop() {
        if (shortSweepTimer) {
            clearInterval(shortSweepTimer);
            shortSweepTimer = null;
        }
        if (hourlySweepTimer) {
            clearInterval(hourlySweepTimer);
            hourlySweepTimer = null;
        }
    },

    // Exposed for testing/manual invocation; not used by init()'s interval scheduling directly.
    runShortSweep,
    runHourlySweep,
};
