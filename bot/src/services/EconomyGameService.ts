import crypto from 'crypto';
import { prisma } from '../utils/database';
import { EconomyService } from './EconomyService';
import { EconomyQuestService } from './EconomyQuestService';
import logger from '../utils/logger';

// -- Result types (discriminated unions) --
// A future slash command formats a Discord reply from these; this file only produces data.

export type GamblingGuardFailureReason =
    | 'GAMBLING_DISABLED'
    | 'BLACKLISTED'
    | 'BET_TOO_LOW'
    | 'BET_TOO_HIGH'
    | 'DAILY_LOSS_CAP';

export type GamblingGuardResult = { ok: true } | { ok: false; reason: GamblingGuardFailureReason };

export type CoinflipResult =
    | { ok: false; reason: GamblingGuardFailureReason | 'INSUFFICIENT_FUNDS' }
    | { ok: true; won: true; result: 'HEADS' | 'TAILS'; payout: bigint }
    | { ok: true; won: false; result: 'HEADS' | 'TAILS' };

export type SlotsResult =
    | { ok: false; reason: GamblingGuardFailureReason | 'INSUFFICIENT_FUNDS' }
    | { ok: true; won: boolean; symbols: [string, string, string]; payout: bigint };

export type RouletteColor = 'RED' | 'BLACK' | 'GREEN';

export type RouletteResult =
    | { ok: false; reason: GamblingGuardFailureReason | 'INSUFFICIENT_FUNDS' }
    | { ok: true; won: boolean; roll: number; color: RouletteColor; payout: bigint };

export type StartBlackjackResult =
    | { ok: false; reason: GamblingGuardFailureReason | 'INSUFFICIENT_FUNDS' }
    | { ok: true; sessionId: string; playerHand: number[]; dealerUpCard: number; playerTotal: number };

export type HitBlackjackResult =
    | { ok: false; reason: 'NOT_FOUND' | 'NOT_YOUR_TURN' | 'EXPIRED' }
    | { ok: true; playerHand: number[]; playerTotal: number; busted: boolean };

export type StandBlackjackResult =
    | { ok: false; reason: 'NOT_FOUND' | 'NOT_YOUR_TURN' | 'EXPIRED' }
    | {
          ok: true;
          playerTotal: number;
          dealerHand: number[];
          dealerTotal: number;
          outcome: 'WIN' | 'LOSE' | 'PUSH';
          payout: bigint;
      };

export type CreateDuelResult =
    | {
          ok: false;
          reason:
              | GamblingGuardFailureReason
              | 'SELF_DUEL'
              | 'INSUFFICIENT_FUNDS';
      }
    | { ok: true; duelId: number };

export type AcceptDuelResult =
    | { ok: false; reason: 'NOT_FOUND' | 'NOT_YOUR_DUEL' | 'EXPIRED' | 'INSUFFICIENT_FUNDS' | 'ALREADY_RESOLVED' }
    | { ok: true; winnerId: string; payout: bigint };

export type DeclineDuelResult =
    | { ok: false; reason: 'NOT_FOUND' | 'NOT_YOUR_DUEL' | 'ALREADY_RESOLVED' }
    | { ok: true };

interface BlackjackSession {
    guildId: string;
    userId: string;
    bet: bigint;
    deck: number[];
    playerHand: number[];
    dealerHand: number[];
    status: 'PLAYER_TURN' | 'DEALER_TURN' | 'DONE';
    createdAt: number;
}

const BLACKJACK_SESSION_TTL_MS = 5 * 60 * 1000;
const CARD_VALUES = [2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 10, 10, 11];
const ROULETTE_RED_NUMBERS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const SLOTS_SYMBOLS = ['🍒', '🍋', '🔔', '⭐', '7️⃣'];

function drawCard(): number {
    return CARD_VALUES[Math.floor(Math.random() * CARD_VALUES.length)];
}

function handTotal(hand: number[]): number {
    let total = hand.reduce((sum, v) => sum + v, 0);
    let aces = hand.filter((v) => v === 11).length;
    while (total > 21 && aces > 0) {
        total -= 10;
        aces -= 1;
    }
    return total;
}

function applyHouseEdge(bet: bigint, fairMultiplier: number, houseEdgeBps: number): bigint {
    return (bet * BigInt(fairMultiplier) * BigInt(10000 - houseEdgeBps)) / 10000n;
}

function startOfTodayUtc(): Date {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export class EconomyGameService {
    private static blackjackSessions: Map<string, BlackjackSession> = new Map();

    private static async checkGamblingAllowed(
        guildId: string,
        userId: string,
        bet: bigint
    ): Promise<GamblingGuardResult> {
        if (await EconomyService.isBlacklisted(guildId, userId)) {
            return { ok: false, reason: 'BLACKLISTED' };
        }

        const cfg = await EconomyService.getConfig(guildId);
        if (!cfg.gamblingEnabled) {
            return { ok: false, reason: 'GAMBLING_DISABLED' };
        }

        if (bet < cfg.minBet) {
            return { ok: false, reason: 'BET_TOO_LOW' };
        }
        if (cfg.maxBet != null && bet > cfg.maxBet) {
            return { ok: false, reason: 'BET_TOO_HIGH' };
        }

        // gamblingDailyLossCap is not part of EconomyConfigCache (the cached config shape
        // used by EconomyService.getConfig), so it's read directly off the EconomyConfig
        // row here rather than extending that shared cache type.
        const configRow = await prisma.economyConfig.findUnique({
            where: { guildId },
            select: { gamblingDailyLossCap: true },
        });
        if (configRow?.gamblingDailyLossCap != null) {
            const agg = await prisma.economyTransaction.aggregate({
                _sum: { amount: true },
                where: {
                    guildId,
                    userId,
                    type: { in: ['BET', 'BET_PAYOUT'] },
                    createdAt: { gte: startOfTodayUtc() },
                },
            });
            const netAmount = agg._sum.amount ?? 0n;
            if (netAmount < -configRow.gamblingDailyLossCap) {
                return { ok: false, reason: 'DAILY_LOSS_CAP' };
            }
        }

        return { ok: true };
    }

    private static async incrementGameStats(guildId: string, userId: string, won: boolean): Promise<void> {
        await prisma.economyMember.update({
            where: { guildId_userId: { guildId, userId } },
            data: won
                ? { gamesPlayed: { increment: 1 }, gamesWon: { increment: 1 } }
                : { gamesPlayed: { increment: 1 } },
        });
        EconomyQuestService.incrementMetric(guildId, userId, 'GAMES_PLAYED', 1).catch((err: unknown) =>
            logger.error('[EconomyGameService] Failed to increment GAMES_PLAYED quest metric', err)
        );
        if (won) {
            EconomyQuestService.checkAchievements(guildId, userId).catch((err: unknown) =>
                logger.error('[EconomyGameService] Failed to check achievements after game win', err)
            );
        }
    }

    static async playCoinflip(
        guildId: string,
        userId: string,
        bet: bigint,
        choice: 'HEADS' | 'TAILS'
    ): Promise<CoinflipResult> {
        const guard = await this.checkGamblingAllowed(guildId, userId, bet);
        if (!guard.ok) return { ok: false, reason: guard.reason };

        const cfg = await EconomyService.getConfig(guildId);

        const debitResult = await EconomyService.debit({
            guildId,
            userId,
            account: 'WALLET',
            amount: bet,
            type: 'BET',
            metadata: { game: 'COINFLIP' },
        });
        if (!debitResult.ok) {
            return { ok: false, reason: 'INSUFFICIENT_FUNDS' };
        }

        const result: 'HEADS' | 'TAILS' = Math.random() < 0.5 ? 'HEADS' : 'TAILS';

        if (result === choice) {
            const payout = applyHouseEdge(bet, 2, cfg.houseEdgeBps);
            await EconomyService.credit({
                guildId,
                userId,
                account: 'WALLET',
                amount: payout,
                type: 'BET_PAYOUT',
                metadata: { game: 'COINFLIP' },
            });
            await this.incrementGameStats(guildId, userId, true);
            return { ok: true, won: true, result, payout };
        }

        await this.incrementGameStats(guildId, userId, false);
        return { ok: true, won: false, result };
    }

    static async playSlots(guildId: string, userId: string, bet: bigint): Promise<SlotsResult> {
        const guard = await this.checkGamblingAllowed(guildId, userId, bet);
        if (!guard.ok) return { ok: false, reason: guard.reason };

        const cfg = await EconomyService.getConfig(guildId);

        const debitResult = await EconomyService.debit({
            guildId,
            userId,
            account: 'WALLET',
            amount: bet,
            type: 'BET',
            metadata: { game: 'SLOTS' },
        });
        if (!debitResult.ok) {
            return { ok: false, reason: 'INSUFFICIENT_FUNDS' };
        }

        const symbols: [string, string, string] = [
            SLOTS_SYMBOLS[Math.floor(Math.random() * SLOTS_SYMBOLS.length)],
            SLOTS_SYMBOLS[Math.floor(Math.random() * SLOTS_SYMBOLS.length)],
            SLOTS_SYMBOLS[Math.floor(Math.random() * SLOTS_SYMBOLS.length)],
        ];

        let multiplier = 0;
        if (symbols[0] === symbols[1] && symbols[1] === symbols[2]) {
            multiplier = symbols[0] === '7️⃣' ? 50 : 10;
        } else if (symbols[0] === symbols[1] || symbols[1] === symbols[2] || symbols[0] === symbols[2]) {
            multiplier = 2;
        }

        const won = multiplier > 0;
        let payout = 0n;
        if (won) {
            payout = applyHouseEdge(bet, multiplier, cfg.houseEdgeBps);
            await EconomyService.credit({
                guildId,
                userId,
                account: 'WALLET',
                amount: payout,
                type: 'BET_PAYOUT',
                metadata: { game: 'SLOTS' },
            });
        }
        await this.incrementGameStats(guildId, userId, won);

        return { ok: true, won, symbols, payout };
    }

    static async playRoulette(
        guildId: string,
        userId: string,
        bet: bigint,
        betType: 'RED' | 'BLACK' | 'GREEN' | 'NUMBER',
        number?: number
    ): Promise<RouletteResult> {
        const guard = await this.checkGamblingAllowed(guildId, userId, bet);
        if (!guard.ok) return { ok: false, reason: guard.reason };

        const cfg = await EconomyService.getConfig(guildId);

        const debitResult = await EconomyService.debit({
            guildId,
            userId,
            account: 'WALLET',
            amount: bet,
            type: 'BET',
            metadata: { game: 'ROULETTE' },
        });
        if (!debitResult.ok) {
            return { ok: false, reason: 'INSUFFICIENT_FUNDS' };
        }

        const roll = Math.floor(Math.random() * 37);
        const color: RouletteColor = roll === 0 ? 'GREEN' : ROULETTE_RED_NUMBERS.has(roll) ? 'RED' : 'BLACK';

        let won = false;
        let fairMultiplier = 0;
        if (betType === 'RED' || betType === 'BLACK') {
            won = color === betType;
            fairMultiplier = 2;
        } else if (betType === 'GREEN') {
            won = color === 'GREEN';
            fairMultiplier = 14;
        } else if (betType === 'NUMBER') {
            won = number != null && roll === number;
            fairMultiplier = 36;
        }

        let payout = 0n;
        if (won) {
            payout = applyHouseEdge(bet, fairMultiplier, cfg.houseEdgeBps);
            await EconomyService.credit({
                guildId,
                userId,
                account: 'WALLET',
                amount: payout,
                type: 'BET_PAYOUT',
                metadata: { game: 'ROULETTE' },
            });
        }
        await this.incrementGameStats(guildId, userId, won);

        return { ok: true, won, roll, color, payout };
    }

    static async startBlackjack(guildId: string, userId: string, bet: bigint): Promise<StartBlackjackResult> {
        const guard = await this.checkGamblingAllowed(guildId, userId, bet);
        if (!guard.ok) return { ok: false, reason: guard.reason };

        const debitResult = await EconomyService.debit({
            guildId,
            userId,
            account: 'WALLET',
            amount: bet,
            type: 'BET',
            metadata: { game: 'BLACKJACK' },
        });
        if (!debitResult.ok) {
            return { ok: false, reason: 'INSUFFICIENT_FUNDS' };
        }

        const playerHand = [drawCard(), drawCard()];
        const dealerHand = [drawCard(), drawCard()];

        const sessionId = crypto.randomUUID();
        this.blackjackSessions.set(sessionId, {
            guildId,
            userId,
            bet,
            deck: [],
            playerHand,
            dealerHand,
            status: 'PLAYER_TURN',
            createdAt: Date.now(),
        });

        return {
            ok: true,
            sessionId,
            playerHand: [...playerHand],
            dealerUpCard: dealerHand[0],
            playerTotal: handTotal(playerHand),
        };
    }

    /** Refunds and deletes a session, treating it as an abandoned push (not a loss). */
    private static async refundAndExpireSession(sessionId: string, session: BlackjackSession): Promise<void> {
        this.blackjackSessions.delete(sessionId);
        await EconomyService.credit({
            guildId: session.guildId,
            userId: session.userId,
            account: 'WALLET',
            amount: session.bet,
            type: 'BET_PAYOUT',
            metadata: { game: 'BLACKJACK', reason: 'SESSION_EXPIRED' },
        });
    }

    private static isSessionExpired(session: BlackjackSession): boolean {
        return Date.now() - session.createdAt > BLACKJACK_SESSION_TTL_MS;
    }

    static async hitBlackjack(sessionId: string, userId: string): Promise<HitBlackjackResult> {
        const session = this.blackjackSessions.get(sessionId);
        if (!session) return { ok: false, reason: 'NOT_FOUND' };
        if (session.userId !== userId) return { ok: false, reason: 'NOT_YOUR_TURN' };
        if (this.isSessionExpired(session)) {
            await this.refundAndExpireSession(sessionId, session);
            return { ok: false, reason: 'EXPIRED' };
        }
        if (session.status !== 'PLAYER_TURN') return { ok: false, reason: 'NOT_YOUR_TURN' };

        session.playerHand.push(drawCard());
        const playerTotal = handTotal(session.playerHand);
        const busted = playerTotal > 21;

        if (busted) {
            session.status = 'DONE';
            this.blackjackSessions.delete(sessionId);
            await this.incrementGameStats(session.guildId, session.userId, false);
        }

        return { ok: true, playerHand: [...session.playerHand], playerTotal, busted };
    }

    static async standBlackjack(sessionId: string, userId: string): Promise<StandBlackjackResult> {
        const session = this.blackjackSessions.get(sessionId);
        if (!session) return { ok: false, reason: 'NOT_FOUND' };
        if (session.userId !== userId) return { ok: false, reason: 'NOT_YOUR_TURN' };
        if (this.isSessionExpired(session)) {
            await this.refundAndExpireSession(sessionId, session);
            return { ok: false, reason: 'EXPIRED' };
        }
        if (session.status !== 'PLAYER_TURN') return { ok: false, reason: 'NOT_YOUR_TURN' };

        session.status = 'DEALER_TURN';

        const playerTotal = handTotal(session.playerHand);

        let dealerTotal = handTotal(session.dealerHand);
        while (dealerTotal < 17) {
            session.dealerHand.push(drawCard());
            dealerTotal = handTotal(session.dealerHand);
        }

        let outcome: 'WIN' | 'LOSE' | 'PUSH';
        if (dealerTotal > 21) {
            outcome = 'WIN';
        } else if (playerTotal > dealerTotal) {
            outcome = 'WIN';
        } else if (playerTotal < dealerTotal) {
            outcome = 'LOSE';
        } else {
            outcome = 'PUSH';
        }

        let payout = 0n;
        if (outcome === 'WIN') {
            const cfg = await EconomyService.getConfig(session.guildId);
            payout = applyHouseEdge(session.bet, 2, cfg.houseEdgeBps);
            await EconomyService.credit({
                guildId: session.guildId,
                userId: session.userId,
                account: 'WALLET',
                amount: payout,
                type: 'BET_PAYOUT',
                metadata: { game: 'BLACKJACK' },
            });
        } else if (outcome === 'PUSH') {
            payout = session.bet;
            await EconomyService.credit({
                guildId: session.guildId,
                userId: session.userId,
                account: 'WALLET',
                amount: payout,
                type: 'BET_PAYOUT',
                metadata: { game: 'BLACKJACK', reason: 'PUSH' },
            });
        }

        await this.incrementGameStats(session.guildId, session.userId, outcome === 'WIN');

        session.status = 'DONE';
        this.blackjackSessions.delete(sessionId);

        return {
            ok: true,
            playerTotal,
            dealerHand: [...session.dealerHand],
            dealerTotal,
            outcome,
            payout,
        };
    }

    static cleanupExpiredSessions(): void {
        for (const [sessionId, session] of this.blackjackSessions.entries()) {
            if (this.isSessionExpired(session)) {
                this.blackjackSessions.delete(sessionId);
                EconomyService.credit({
                    guildId: session.guildId,
                    userId: session.userId,
                    account: 'WALLET',
                    amount: session.bet,
                    type: 'BET_PAYOUT',
                    metadata: { game: 'BLACKJACK', reason: 'SESSION_EXPIRED' },
                }).catch(() => {});
            }
        }
    }

    static async createDuel(params: {
        guildId: string;
        challengerId: string;
        opponentId: string;
        stake: bigint;
        game?: string;
        channelId?: string;
        expiresInMinutes?: number;
    }): Promise<CreateDuelResult> {
        if (params.challengerId === params.opponentId) {
            return { ok: false, reason: 'SELF_DUEL' };
        }

        const guard = await this.checkGamblingAllowed(params.guildId, params.challengerId, params.stake);
        if (!guard.ok) return { ok: false, reason: guard.reason };

        const debitResult = await EconomyService.debit({
            guildId: params.guildId,
            userId: params.challengerId,
            account: 'WALLET',
            amount: params.stake,
            type: 'DUEL_STAKE',
        });
        if (!debitResult.ok) {
            return { ok: false, reason: 'INSUFFICIENT_FUNDS' };
        }

        const duel = await prisma.economyDuel.create({
            data: {
                guildId: params.guildId,
                game: params.game ?? 'COINFLIP',
                challengerId: params.challengerId,
                opponentId: params.opponentId,
                stake: params.stake,
                status: 'PENDING',
                channelId: params.channelId,
                expiresAt: new Date(Date.now() + (params.expiresInMinutes ?? 5) * 60000),
            },
        });

        return { ok: true, duelId: duel.id };
    }

    static async acceptDuel(duelId: number, opponentId: string): Promise<AcceptDuelResult> {
        const duel = await prisma.economyDuel.findUnique({ where: { id: duelId } });
        if (!duel) return { ok: false, reason: 'NOT_FOUND' };
        if (duel.opponentId !== opponentId) return { ok: false, reason: 'NOT_YOUR_DUEL' };
        if (duel.status !== 'PENDING') return { ok: false, reason: 'ALREADY_RESOLVED' };

        if (duel.expiresAt <= new Date()) {
            await prisma.economyDuel.update({
                where: { id: duelId },
                data: { status: 'EXPIRED' },
            });
            await EconomyService.credit({
                guildId: duel.guildId,
                userId: duel.challengerId,
                account: 'WALLET',
                amount: duel.stake,
                type: 'DUEL_STAKE',
                metadata: { reason: 'EXPIRED' },
            });
            return { ok: false, reason: 'EXPIRED' };
        }

        const debitResult = await EconomyService.debit({
            guildId: duel.guildId,
            userId: opponentId,
            account: 'WALLET',
            amount: duel.stake,
            type: 'DUEL_STAKE',
        });
        if (!debitResult.ok) {
            return { ok: false, reason: 'INSUFFICIENT_FUNDS' };
        }

        const flip = await prisma.$transaction(async (tx) => {
            const updateResult = await tx.economyDuel.updateMany({
                where: { id: duelId, status: 'PENDING' },
                data: { status: 'ACTIVE' },
            });
            return updateResult.count;
        });

        if (flip === 0) {
            await EconomyService.credit({
                guildId: duel.guildId,
                userId: opponentId,
                account: 'WALLET',
                amount: duel.stake,
                type: 'DUEL_STAKE',
                metadata: { reason: 'ALREADY_RESOLVED' },
            });
            return { ok: false, reason: 'ALREADY_RESOLVED' };
        }

        const cfg = await EconomyService.getConfig(duel.guildId);
        const winnerId: string = Math.random() < 0.5 ? duel.challengerId : opponentId;
        const payout = applyHouseEdge(duel.stake, 2, cfg.houseEdgeBps);

        await EconomyService.credit({
            guildId: duel.guildId,
            userId: winnerId,
            account: 'WALLET',
            amount: payout,
            type: 'DUEL_WIN',
            metadata: { duelId },
        });

        await prisma.economyDuel.update({
            where: { id: duelId },
            data: { status: 'RESOLVED', winnerId },
        });

        return { ok: true, winnerId, payout };
    }

    static async declineDuel(duelId: number, opponentId: string): Promise<DeclineDuelResult> {
        const duel = await prisma.economyDuel.findUnique({ where: { id: duelId } });
        if (!duel) return { ok: false, reason: 'NOT_FOUND' };
        if (duel.opponentId !== opponentId) return { ok: false, reason: 'NOT_YOUR_DUEL' };
        if (duel.status !== 'PENDING') return { ok: false, reason: 'ALREADY_RESOLVED' };

        await EconomyService.credit({
            guildId: duel.guildId,
            userId: duel.challengerId,
            account: 'WALLET',
            amount: duel.stake,
            type: 'DUEL_STAKE',
            metadata: { reason: 'DECLINED' },
        });

        await prisma.economyDuel.update({
            where: { id: duelId },
            data: { status: 'DECLINED' },
        });

        return { ok: true };
    }

    static async expireStaleDuels(): Promise<number> {
        const staleDuels = await prisma.economyDuel.findMany({
            where: { status: 'PENDING', expiresAt: { lt: new Date() } },
        });

        for (const duel of staleDuels) {
            await EconomyService.credit({
                guildId: duel.guildId,
                userId: duel.challengerId,
                account: 'WALLET',
                amount: duel.stake,
                type: 'DUEL_STAKE',
                metadata: { reason: 'EXPIRED' },
            });
            await prisma.economyDuel.update({
                where: { id: duel.id },
                data: { status: 'EXPIRED' },
            });
        }

        return staleDuels.length;
    }
}
