import crypto from 'crypto';
import { EconomyService } from './EconomyService';

// In-memory PvP match engine for competitive player-vs-player games (Rock-Paper-Scissors
// and Tic-Tac-Toe). Matches escrow both players' stakes up front; the winner takes the
// pot minus the configured house rake (a sink). State lives in memory and expires; a
// lifecycle sweep calls expireStaleMatches() to refund abandoned escrows.

export type PvpGame = 'RPS' | 'TICTACTOE';
export type RpsPick = 'ROCK' | 'PAPER' | 'SCISSORS';
export type TttMark = 'X' | 'O';

const MATCH_TTL_MS = 5 * 60 * 1000;
const RPS_BEST_OF = 3; // first to 2 round wins

interface BaseMatch {
    id: string;
    guildId: string;
    game: PvpGame;
    challengerId: string;
    opponentId: string;
    stake: bigint;
    status: 'PENDING' | 'ACTIVE' | 'RESOLVED' | 'EXPIRED' | 'DECLINED';
    channelId: string;
    messageId?: string;
    createdAt: number;
}

interface RpsMatch extends BaseMatch {
    game: 'RPS';
    score: { challenger: number; opponent: number };
    round: number;
    picks: { challenger?: RpsPick; opponent?: RpsPick };
}

interface TttMatch extends BaseMatch {
    game: 'TICTACTOE';
    board: (TttMark | null)[]; // 9 cells; challenger = X, opponent = O
    turn: string; // userId whose move it is
}

type PvpMatch = RpsMatch | TttMatch;

export type PvpFailReason =
    | 'GAMBLING_DISABLED' | 'BLACKLISTED' | 'BET_TOO_LOW' | 'BET_TOO_HIGH'
    | 'SELF_MATCH' | 'INSUFFICIENT_FUNDS' | 'NOT_FOUND' | 'NOT_YOUR_MATCH'
    | 'ALREADY_RESOLVED' | 'EXPIRED' | 'NOT_YOUR_TURN' | 'CELL_TAKEN' | 'ALREADY_PICKED';

export type CreateMatchResult =
    | { ok: true; matchId: string }
    | { ok: false; reason: PvpFailReason };

export type MatchStateResult =
    | { ok: true; match: PvpMatchView }
    | { ok: false; reason: PvpFailReason };

// A serializable view of match state for the card renderer.
export interface PvpMatchView {
    id: string;
    game: PvpGame;
    challengerId: string;
    opponentId: string;
    stake: bigint;
    status: PvpMatch['status'];
    // RPS
    score?: { challenger: number; opponent: number };
    round?: number;
    picked?: { challenger: boolean; opponent: boolean };
    lastRound?: { challenger: RpsPick; opponent: RpsPick; winner: string | 'TIE' } | null;
    bestOf?: number;
    // TicTacToe
    board?: (TttMark | null)[];
    turn?: string;
    lastCell?: number;
    // resolution
    winnerId?: string | 'DRAW' | null;
    payout?: bigint;
}

const matches = new Map<string, PvpMatch>();

function view(m: PvpMatch, extra: Partial<PvpMatchView> = {}): PvpMatchView {
    const base: PvpMatchView = {
        id: m.id,
        game: m.game,
        challengerId: m.challengerId,
        opponentId: m.opponentId,
        stake: m.stake,
        status: m.status,
    };
    if (m.game === 'RPS') {
        base.score = { ...m.score };
        base.round = m.round;
        base.picked = { challenger: m.picks.challenger != null, opponent: m.picks.opponent != null };
        base.bestOf = RPS_BEST_OF;
    } else {
        base.board = [...m.board];
        base.turn = m.turn;
    }
    return { ...base, ...extra };
}

async function guardStake(guildId: string, userId: string, stake: bigint): Promise<{ ok: true } | { ok: false; reason: PvpFailReason }> {
    if (await EconomyService.isBlacklisted(guildId, userId)) return { ok: false, reason: 'BLACKLISTED' };
    const cfg = await EconomyService.getConfig(guildId);
    if (!cfg.gamblingEnabled) return { ok: false, reason: 'GAMBLING_DISABLED' };
    if (stake < cfg.minBet) return { ok: false, reason: 'BET_TOO_LOW' };
    if (cfg.maxBet != null && stake > cfg.maxBet) return { ok: false, reason: 'BET_TOO_HIGH' };
    return { ok: true };
}

export class EconomyPvpService {
    static getMatch(matchId: string): PvpMatchView | null {
        const m = matches.get(matchId);
        return m ? view(m) : null;
    }

    static setMessageId(matchId: string, messageId: string): void {
        const m = matches.get(matchId);
        if (m) m.messageId = messageId;
    }

    /** Challenger opens a match; their stake is escrowed immediately. */
    static async createMatch(params: {
        guildId: string;
        game: PvpGame;
        challengerId: string;
        opponentId: string;
        stake: bigint;
        channelId: string;
    }): Promise<CreateMatchResult> {
        const { guildId, game, challengerId, opponentId, stake, channelId } = params;
        if (challengerId === opponentId) return { ok: false, reason: 'SELF_MATCH' };

        const guard = await guardStake(guildId, challengerId, stake);
        if (!guard.ok) return guard;

        const debit = await EconomyService.debit({
            guildId, userId: challengerId, account: 'WALLET', amount: stake,
            type: 'DUEL_STAKE', metadata: { game, role: 'challenger' },
        });
        if (!debit.ok) return { ok: false, reason: 'INSUFFICIENT_FUNDS' };

        const id = crypto.randomUUID();
        const common = {
            id, guildId, game, challengerId, opponentId, stake,
            status: 'PENDING' as const, channelId, createdAt: Date.now(),
        };
        const match: PvpMatch = game === 'RPS'
            ? { ...common, game: 'RPS', score: { challenger: 0, opponent: 0 }, round: 1, picks: {} }
            : { ...common, game: 'TICTACTOE', board: Array(9).fill(null), turn: challengerId };
        matches.set(id, match);
        return { ok: true, matchId: id };
    }

    /** Opponent accepts; their stake is escrowed and the game becomes ACTIVE. */
    static async acceptMatch(matchId: string, opponentId: string): Promise<MatchStateResult> {
        const m = matches.get(matchId);
        if (!m) return { ok: false, reason: 'NOT_FOUND' };
        if (m.opponentId !== opponentId) return { ok: false, reason: 'NOT_YOUR_MATCH' };
        if (m.status !== 'PENDING') return { ok: false, reason: 'ALREADY_RESOLVED' };
        if (Date.now() - m.createdAt > MATCH_TTL_MS) {
            await this.refundAndClose(m, 'EXPIRED', [m.challengerId]);
            return { ok: false, reason: 'EXPIRED' };
        }

        const guard = await guardStake(m.guildId, opponentId, m.stake);
        if (!guard.ok) return guard;

        const debit = await EconomyService.debit({
            guildId: m.guildId, userId: opponentId, account: 'WALLET', amount: m.stake,
            type: 'DUEL_STAKE', metadata: { game: m.game, role: 'opponent' },
        });
        if (!debit.ok) return { ok: false, reason: 'INSUFFICIENT_FUNDS' };

        m.status = 'ACTIVE';
        return { ok: true, match: view(m) };
    }

    static async declineMatch(matchId: string, opponentId: string): Promise<MatchStateResult> {
        const m = matches.get(matchId);
        if (!m) return { ok: false, reason: 'NOT_FOUND' };
        if (m.opponentId !== opponentId) return { ok: false, reason: 'NOT_YOUR_MATCH' };
        if (m.status !== 'PENDING') return { ok: false, reason: 'ALREADY_RESOLVED' };
        await this.refundAndClose(m, 'DECLINED', [m.challengerId]);
        return { ok: true, match: view(m, { status: 'DECLINED' }) };
    }

    // ── Rock-Paper-Scissors ──────────────────────────────────────────────────
    static async rpsPick(matchId: string, userId: string, pick: RpsPick): Promise<MatchStateResult> {
        const m = matches.get(matchId);
        if (!m || m.game !== 'RPS') return { ok: false, reason: 'NOT_FOUND' };
        if (m.status !== 'ACTIVE') return { ok: false, reason: 'ALREADY_RESOLVED' };
        if (userId !== m.challengerId && userId !== m.opponentId) return { ok: false, reason: 'NOT_YOUR_MATCH' };

        const isChallenger = userId === m.challengerId;
        if ((isChallenger && m.picks.challenger) || (!isChallenger && m.picks.opponent)) {
            return { ok: false, reason: 'ALREADY_PICKED' };
        }
        if (isChallenger) m.picks.challenger = pick;
        else m.picks.opponent = pick;

        // Wait for both picks.
        if (!m.picks.challenger || !m.picks.opponent) {
            return { ok: true, match: view(m) };
        }

        const cPick = m.picks.challenger;
        const oPick = m.picks.opponent;
        const roundWinner = rpsWinner(cPick, oPick, m.challengerId, m.opponentId);
        if (roundWinner === m.challengerId) m.score.challenger += 1;
        else if (roundWinner === m.opponentId) m.score.opponent += 1;

        const lastRound = { challenger: cPick, opponent: oPick, winner: roundWinner };
        m.picks = {};
        m.round += 1;

        const needed = Math.ceil(RPS_BEST_OF / 2);
        if (m.score.challenger >= needed || m.score.opponent >= needed) {
            const winnerId = m.score.challenger > m.score.opponent ? m.challengerId : m.opponentId;
            const payout = await this.payWinner(m, winnerId);
            m.status = 'RESOLVED';
            const v = view(m, { status: 'RESOLVED', winnerId, payout, lastRound });
            matches.delete(m.id);
            return { ok: true, match: v };
        }

        return { ok: true, match: view(m, { lastRound }) };
    }

    // ── Tic-Tac-Toe ──────────────────────────────────────────────────────────
    static async tttMove(matchId: string, userId: string, cell: number): Promise<MatchStateResult> {
        const m = matches.get(matchId);
        if (!m || m.game !== 'TICTACTOE') return { ok: false, reason: 'NOT_FOUND' };
        if (m.status !== 'ACTIVE') return { ok: false, reason: 'ALREADY_RESOLVED' };
        if (userId !== m.challengerId && userId !== m.opponentId) return { ok: false, reason: 'NOT_YOUR_MATCH' };
        if (m.turn !== userId) return { ok: false, reason: 'NOT_YOUR_TURN' };
        if (cell < 0 || cell > 8 || m.board[cell] !== null) return { ok: false, reason: 'CELL_TAKEN' };

        const mark: TttMark = userId === m.challengerId ? 'X' : 'O';
        m.board[cell] = mark;

        const winMark = tttWinner(m.board);
        if (winMark) {
            const winnerId = winMark === 'X' ? m.challengerId : m.opponentId;
            const payout = await this.payWinner(m, winnerId);
            m.status = 'RESOLVED';
            const v = view(m, { status: 'RESOLVED', winnerId, payout, lastCell: cell });
            matches.delete(m.id);
            return { ok: true, match: v };
        }

        if (m.board.every((c) => c !== null)) {
            // Draw: refund both stakes.
            await this.refundAndClose(m, 'RESOLVED', [m.challengerId, m.opponentId]);
            const v = view(m, { status: 'RESOLVED', winnerId: 'DRAW', lastCell: cell });
            matches.delete(m.id);
            return { ok: true, match: v };
        }

        m.turn = userId === m.challengerId ? m.opponentId : m.challengerId;
        return { ok: true, match: view(m, { lastCell: cell }) };
    }

    /** Pay the pot (both stakes) minus house rake to the winner. Returns the payout. */
    private static async payWinner(m: PvpMatch, winnerId: string): Promise<bigint> {
        const cfg = await EconomyService.getConfig(m.guildId);
        const pot = m.stake * BigInt(2);
        const payout = (pot * BigInt(10000 - cfg.houseEdgeBps)) / BigInt(10000);
        await EconomyService.credit({
            guildId: m.guildId, userId: winnerId, account: 'WALLET', amount: payout,
            type: 'DUEL_WIN', metadata: { game: m.game },
        }).catch(() => null);
        return payout;
    }

    /** Refund escrowed stakes to the listed players and set the match status. */
    private static async refundAndClose(m: PvpMatch, status: PvpMatch['status'], refundUserIds: string[]): Promise<void> {
        m.status = status;
        for (const userId of refundUserIds) {
            await EconomyService.credit({
                guildId: m.guildId, userId, account: 'WALLET', amount: m.stake,
                type: 'DUEL_STAKE', metadata: { game: m.game, refund: true },
            }).catch(() => null);
        }
    }

    /** Refund and drop matches that were never accepted or went idle. Called by the lifecycle sweep. */
    static async expireStaleMatches(): Promise<number> {
        const now = Date.now();
        let count = 0;
        for (const m of Array.from(matches.values())) {
            if (now - m.createdAt <= MATCH_TTL_MS) continue;
            if (m.status === 'PENDING') {
                await this.refundAndClose(m, 'EXPIRED', [m.challengerId]);
            } else if (m.status === 'ACTIVE') {
                await this.refundAndClose(m, 'EXPIRED', [m.challengerId, m.opponentId]);
            }
            matches.delete(m.id);
            count += 1;
        }
        return count;
    }
}

function rpsWinner(a: RpsPick, b: RpsPick, aId: string, bId: string): string | 'TIE' {
    if (a === b) return 'TIE';
    const beats: Record<RpsPick, RpsPick> = { ROCK: 'SCISSORS', PAPER: 'ROCK', SCISSORS: 'PAPER' };
    return beats[a] === b ? aId : bId;
}

const TTT_LINES = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6],
];

function tttWinner(board: (TttMark | null)[]): TttMark | null {
    for (const [a, b, c] of TTT_LINES) {
        if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
    }
    return null;
}
