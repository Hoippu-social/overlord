import { ButtonStyle } from 'discord.js';
import type { LocaleCode } from './i18n';
import { ecoCopy, fmt } from './economyI18n';
import { ACCENT, money, type CardSpec, type CardButton } from './economyCards';
import type { PvpMatchView, RpsPick } from '../services/EconomyPvpService';

export type Currency = { name: string; emoji: string | null };

// ── customId scheme (prefix `eco:` so the interaction event can guard cheaply) ──
export const ECO_PREFIX = 'eco:';
export const cid = (...parts: (string | number)[]): string => ['eco', ...parts].join(':');

const RPS_EMOJI: Record<RpsPick, string> = { ROCK: '🪨', PAPER: '📄', SCISSORS: '✂️' };

function rpsLabel(pick: RpsPick, locale: LocaleCode): string {
    const c = ecoCopy(locale).rps;
    return pick === 'ROCK' ? c.rock : pick === 'PAPER' ? c.paper : c.scissors;
}

// ── Blackjack ───────────────────────────────────────────────────────────────
export function renderBlackjack(
    state: {
        sessionId: string;
        playerHand: number[];
        playerTotal: number;
        dealerUpCard?: number;
        dealerHand?: number[];
        dealerTotal?: number;
        bet: bigint;
        outcome?: 'WIN' | 'LOSE' | 'PUSH' | 'BUST';
        payout?: bigint;
    },
    locale: LocaleCode,
    currency: Currency
): CardSpec {
    const c = ecoCopy(locale);
    const done = state.outcome != null;
    const dealerLine = state.dealerHand
        ? `${state.dealerHand.join(' + ')} = **${state.dealerTotal}**`
        : `${state.dealerUpCard} + ?`;

    const playerCards = state.playerHand.length ? `${state.playerHand.join(' + ')} = ` : '';
    const body = [
        `**${c.blackjack.your}:** ${playerCards}**${state.playerTotal}**`,
        `**${c.blackjack.dealer}:** ${dealerLine}`,
    ];

    let footer = fmt(c.game.bet, { amount: money(state.bet, currency) });
    let accent: number = ACCENT.info;
    if (done) {
        if (state.outcome === 'WIN') { body.push(`\n🎉 **${c.blackjack.youWin}** ${fmt(c.game.won, { amount: money(state.payout ?? 0n, currency) })}`); accent = ACCENT.primary; }
        else if (state.outcome === 'PUSH') { body.push(`\n➖ **${c.blackjack.push}** ${c.game.push}`); accent = ACCENT.gold; }
        else if (state.outcome === 'BUST') { body.push(`\n💥 **${c.blackjack.bust}**`); accent = ACCENT.danger; }
        else { body.push(`\n😔 **${c.blackjack.youLose}**`); accent = ACCENT.danger; }
    }

    const spec: CardSpec = { accent, title: `🃏 ${c.blackjack.title}`, body, footer };
    if (!done) {
        // Carry bet + dealer up-card in the customId so hit/stand re-renders keep full context
        // (the service's hit/stand results don't echo the bet or the dealer's shown card back).
        const up = String(state.dealerUpCard ?? '');
        const bet = state.bet.toString();
        spec.buttonRows = [[
            { id: cid('bj', 'hit', state.sessionId, bet, up), label: c.blackjack.hit, style: ButtonStyle.Primary, emoji: '➕' },
            { id: cid('bj', 'stand', state.sessionId, bet, up), label: c.blackjack.stand, style: ButtonStyle.Secondary, emoji: '✋' },
        ]];
    }
    return spec;
}

// ── Coinflip ────────────────────────────────────────────────────────────────
export function renderCoinflipPrompt(bet: bigint, ownerId: string, locale: LocaleCode, currency: Currency): CardSpec {
    const c = ecoCopy(locale);
    return {
        accent: ACCENT.gold,
        title: `🪙 ${c.coinflip.title}`,
        footer: fmt(c.game.bet, { amount: money(bet, currency) }),
        buttonRows: [[
            { id: cid('cf', 'HEADS', bet.toString(), ownerId), label: c.coinflip.heads, style: ButtonStyle.Primary },
            { id: cid('cf', 'TAILS', bet.toString(), ownerId), label: c.coinflip.tails, style: ButtonStyle.Secondary },
        ]],
    };
}

export function renderCoinflipResult(
    r: { won: boolean; result: 'HEADS' | 'TAILS'; payout?: bigint },
    bet: bigint, ownerId: string, locale: LocaleCode, currency: Currency
): CardSpec {
    const c = ecoCopy(locale);
    const side = r.result === 'HEADS' ? c.coinflip.heads : c.coinflip.tails;
    const body = [fmt(c.coinflip.result, { side: `**${side}**` })];
    body.push(r.won ? `🎉 ${fmt(c.game.won, { amount: money(r.payout ?? 0n, currency) })}` : `😔 ${fmt(c.game.lost, { amount: money(bet, currency) })}`);
    return {
        accent: r.won ? ACCENT.primary : ACCENT.danger,
        title: `🪙 ${c.coinflip.title}`,
        body,
        buttonRows: [[{ id: cid('cf', r.result, bet.toString(), ownerId), label: c.game.playAgain, style: ButtonStyle.Secondary, emoji: '🔁' }]],
    };
}

// ── Slots ───────────────────────────────────────────────────────────────────
export function renderSlotsPrompt(bet: bigint, ownerId: string, locale: LocaleCode, currency: Currency): CardSpec {
    const c = ecoCopy(locale);
    return {
        accent: ACCENT.violet,
        title: `🎰 ${c.slots.title}`,
        body: ['` ❓ ❓ ❓ `'],
        footer: fmt(c.game.bet, { amount: money(bet, currency) }),
        buttonRows: [[{ id: cid('slots', 'spin', bet.toString(), ownerId), label: c.slots.spin, style: ButtonStyle.Primary, emoji: '🎰' }]],
    };
}

export function renderSlotsResult(
    r: { won: boolean; symbols: [string, string, string]; payout: bigint },
    bet: bigint, ownerId: string, locale: LocaleCode, currency: Currency
): CardSpec {
    const c = ecoCopy(locale);
    const body = [`\`  ${r.symbols.join('  ')}  \``];
    body.push(r.won ? `🎉 ${fmt(c.game.won, { amount: money(r.payout, currency) })}` : `😔 ${fmt(c.game.lost, { amount: money(bet, currency) })}`);
    return {
        accent: r.won ? ACCENT.primary : ACCENT.danger,
        title: `🎰 ${c.slots.title}`,
        body,
        buttonRows: [[{ id: cid('slots', 'spin', bet.toString(), ownerId), label: c.game.playAgain, style: ButtonStyle.Secondary, emoji: '🔁' }]],
    };
}

// ── Roulette ────────────────────────────────────────────────────────────────
export function renderRoulettePrompt(bet: bigint, ownerId: string, locale: LocaleCode, currency: Currency): CardSpec {
    const c = ecoCopy(locale);
    return {
        accent: ACCENT.danger,
        title: `🎡 ${c.roulette.title}`,
        footer: fmt(c.game.bet, { amount: money(bet, currency) }),
        selects: [{
            id: cid('rl', bet.toString(), ownerId),
            placeholder: c.roulette.pickBet,
            options: [
                { label: c.roulette.red, value: 'RED', emoji: '🔴' },
                { label: c.roulette.black, value: 'BLACK', emoji: '⚫' },
                { label: c.roulette.green, value: 'GREEN', emoji: '🟢' },
            ],
        }],
    };
}

export function renderRouletteResult(
    r: { won: boolean; roll: number; color: 'RED' | 'BLACK' | 'GREEN'; payout: bigint },
    bet: bigint, ownerId: string, locale: LocaleCode, currency: Currency
): CardSpec {
    const c = ecoCopy(locale);
    const colorLabel = r.color === 'RED' ? `🔴 ${c.roulette.red}` : r.color === 'BLACK' ? `⚫ ${c.roulette.black}` : `🟢 ${c.roulette.green}`;
    const body = [fmt(c.roulette.result, { roll: `**${r.roll}**`, color: colorLabel })];
    body.push(r.won ? `🎉 ${fmt(c.game.won, { amount: money(r.payout, currency) })}` : `😔 ${fmt(c.game.lost, { amount: money(bet, currency) })}`);
    return {
        accent: r.won ? ACCENT.primary : ACCENT.danger,
        title: `🎡 ${c.roulette.title}`,
        body,
        buttonRows: [[{ id: cid('rlnew', bet.toString(), ownerId), label: c.game.playAgain, style: ButtonStyle.Secondary, emoji: '🔁' }]],
    };
}

// ── PvP: challenge / RPS / Tic-Tac-Toe ────────────────────────────────────────
export function renderPvpChallenge(
    m: { id: string; game: 'RPS' | 'TICTACTOE'; challengerId: string; opponentId: string; stake: bigint },
    locale: LocaleCode, currency: Currency
): CardSpec {
    const c = ecoCopy(locale);
    const gameName = c.pvp.games[m.game];
    const key = m.game === 'RPS' ? 'rps' : 'ttt';
    return {
        accent: ACCENT.violet,
        title: `⚔️ ${gameName}`,
        body: [
            fmt(c.pvp.challenge, { challenger: `<@${m.challengerId}>`, opponent: `<@${m.opponentId}>`, game: `**${gameName}**` }),
            fmt(c.pvp.stake, { amount: money(m.stake, currency) }),
        ],
        footer: fmt(c.pvp.waiting, { opponent: `@${m.opponentId}` }),
        buttonRows: [[
            { id: cid(key, 'accept', m.id), label: c.pvp.accept, style: ButtonStyle.Success, emoji: '✅' },
            { id: cid(key, 'decline', m.id), label: c.pvp.decline, style: ButtonStyle.Danger, emoji: '✖️' },
        ]],
    };
}

export function renderRps(m: PvpMatchView, locale: LocaleCode, currency: Currency): CardSpec {
    const c = ecoCopy(locale);
    const body: string[] = [
        fmt(c.rps.score, {
            challenger: `<@${m.challengerId}>`, cScore: m.score?.challenger ?? 0,
            opponent: `<@${m.opponentId}>`, oScore: m.score?.opponent ?? 0,
        }),
    ];
    if (m.lastRound) {
        const winnerTxt = m.lastRound.winner === 'TIE' ? c.rps.tie : `<@${m.lastRound.winner}>`;
        body.push(fmt(c.rps.roundResult, {
            cPick: `${RPS_EMOJI[m.lastRound.challenger]} ${rpsLabel(m.lastRound.challenger, locale)}`,
            oPick: `${RPS_EMOJI[m.lastRound.opponent]} ${rpsLabel(m.lastRound.opponent, locale)}`,
            winner: winnerTxt,
        }));
    }

    if (m.status === 'RESOLVED') {
        return renderPvpResult(m, locale, currency, `✂️ ${c.pvp.games.RPS}`, body);
    }

    body.push(`\n${fmt(c.rps.round, { n: m.round ?? 1 })} — ${c.rps.pickPrompt}`);
    const picked = m.picked ?? { challenger: false, opponent: false };
    const suffix = picked.challenger && picked.opponent ? '' : ` (${picked.challenger ? '✅' : '⬜'} ${picked.opponent ? '✅' : '⬜'})`;
    const btn = (pick: RpsPick): CardButton => ({ id: cid('rps', 'pick', m.id, pick), label: rpsLabel(pick, locale), emoji: RPS_EMOJI[pick], style: ButtonStyle.Primary });
    return {
        accent: ACCENT.violet,
        title: `✂️ ${c.pvp.games.RPS}${suffix}`,
        body,
        footer: fmt(c.pvp.stake, { amount: money(m.stake, currency) }),
        buttonRows: [[btn('ROCK'), btn('PAPER'), btn('SCISSORS')]],
    };
}

const TTT_CELL_EMPTY = '⬜';
const TTT_MARK = { X: '❌', O: '⭕' } as const;

export function renderTicTacToe(m: PvpMatchView, locale: LocaleCode, currency: Currency): CardSpec {
    const c = ecoCopy(locale);
    const board: (('X' | 'O') | null)[] = m.board ?? new Array<('X' | 'O') | null>(9).fill(null);

    if (m.status === 'RESOLVED') {
        const body = [renderTttBoardText(board)];
        return renderPvpResult(m, locale, currency, `⭕ ${c.pvp.games.TICTACTOE}`, body, board);
    }

    const turnUser = m.turn ?? m.challengerId;
    const legend = `<@${m.challengerId}> ${TTT_MARK.X} · <@${m.opponentId}> ${TTT_MARK.O}`;
    const rows: CardButton[][] = [];
    for (let r = 0; r < 3; r++) {
        const row: CardButton[] = [];
        for (let col = 0; col < 3; col++) {
            const idx = r * 3 + col;
            const mark = board[idx];
            row.push({
                id: cid('ttt', 'cell', m.id, idx),
                label: '​',
                emoji: mark ? TTT_MARK[mark] : TTT_CELL_EMPTY,
                style: mark === 'X' ? ButtonStyle.Danger : mark === 'O' ? ButtonStyle.Primary : ButtonStyle.Secondary,
                disabled: mark != null,
            });
        }
        rows.push(row);
    }
    return {
        accent: ACCENT.violet,
        title: `⭕ ${c.pvp.games.TICTACTOE}`,
        body: [legend, fmt(c.pvp.yourTurn, { user: `<@${turnUser}>` })],
        footer: fmt(c.pvp.stake, { amount: money(m.stake, currency) }),
        buttonRows: rows,
    };
}

function renderTttBoardText(board: (('X' | 'O') | null)[]): string {
    const cellStr = (i: number) => (board[i] ? TTT_MARK[board[i] as 'X' | 'O'] : TTT_CELL_EMPTY);
    return [0, 3, 6].map((r) => `${cellStr(r)}${cellStr(r + 1)}${cellStr(r + 2)}`).join('\n');
}

function renderPvpResult(
    m: PvpMatchView, locale: LocaleCode, currency: Currency, title: string, body: string[], board?: (('X' | 'O') | null)[]
): CardSpec {
    void board;
    const c = ecoCopy(locale);
    let accent: number = ACCENT.gold;
    if (m.winnerId === 'DRAW') {
        body.push(`\n➖ **${c.pvp.draw}**`);
    } else if (m.winnerId) {
        body.push(`\n${fmt(c.pvp.winner, { user: `<@${m.winnerId}>`, amount: money(m.payout ?? 0n, currency) })}`);
        accent = ACCENT.primary;
    }
    return { accent, title, body, footer: fmt(c.pvp.stake, { amount: money(m.stake, currency) }) };
}
