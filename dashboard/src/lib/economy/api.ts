// Typed fetch adapter for the Economy dashboard workspace.
// All panels talk to the backend exclusively through these functions — swapping the
// transport (or mocking in tests) never touches UI code. Every function targets a
// route under /api/guilds/[guildId]/economy/*.

import type {
    Achievement,
    EarnSource,
    EconomyConfig,
    EconomyWorkspaceData,
    EventWindowType,
    FineRule,
    LedgerPage,
    LedgerType,
    OverviewData,
    QuestTemplate,
    RoleRule,
    SeasonResultRow,
    ShopItem,
    WalletsPage,
} from './types';

async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await fetch(url, {
        ...init,
        headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    });
    if (!res.ok) {
        let message = `Request failed (${res.status})`;
        try {
            const body = await res.json();
            if (body?.error) message = body.error;
        } catch {
            /* non-JSON error body */
        }
        throw new Error(message);
    }
    return res.json() as Promise<T>;
}

const base = (guildId: string) => `/api/guilds/${guildId}/economy`;

// ── Workspace bootstrap ──────────────────────────────────────────────────────

export function loadEconomyWorkspace(guildId: string): Promise<EconomyWorkspaceData> {
    return jsonFetch<EconomyWorkspaceData>(`${base(guildId)}`);
}

// ── Config ───────────────────────────────────────────────────────────────────

export function saveEconomyConfig(guildId: string, config: EconomyConfig): Promise<void> {
    return jsonFetch<void>(`${base(guildId)}`, {
        method: 'PUT',
        body: JSON.stringify(config),
    });
}

// ── Earn sources ─────────────────────────────────────────────────────────────

export function saveEarnSources(guildId: string, sources: EarnSource[]): Promise<void> {
    return jsonFetch<void>(`${base(guildId)}/earn-sources`, {
        method: 'PUT',
        body: JSON.stringify({ sources }),
    });
}

// ── Wallets ──────────────────────────────────────────────────────────────────

export function loadWallets(
    guildId: string,
    opts: { page?: number; pageSize?: number; search?: string } = {}
): Promise<WalletsPage> {
    const params = new URLSearchParams();
    if (opts.page) params.set('page', String(opts.page));
    if (opts.pageSize) params.set('pageSize', String(opts.pageSize));
    if (opts.search) params.set('search', opts.search);
    const qs = params.toString();
    return jsonFetch<WalletsPage>(`${base(guildId)}/wallets${qs ? `?${qs}` : ''}`);
}

/** Grant or deduct balance. `mode` picks the direction; `reason` is mandatory (audited). */
export function adjustBalance(
    guildId: string,
    payload: { userId: string; account: 'WALLET' | 'BANK'; amount: string; reason: string; mode: 'grant' | 'deduct' }
): Promise<void> {
    return jsonFetch<void>(`${base(guildId)}/wallets`, {
        method: 'POST',
        body: JSON.stringify(payload),
    });
}

export function setBlacklist(
    guildId: string,
    payload: { userId: string; blacklisted: boolean; reason?: string }
): Promise<void> {
    return jsonFetch<void>(`${base(guildId)}/wallets`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
    });
}

// ── Shop ─────────────────────────────────────────────────────────────────────

/** Create (no id) or update (with id) a shop item; returns the persisted row. */
export function saveShopItem(guildId: string, item: Partial<ShopItem>): Promise<ShopItem> {
    if (item.id) {
        return jsonFetch<ShopItem>(`${base(guildId)}/shop/${item.id}`, {
            method: 'PUT',
            body: JSON.stringify(item),
        });
    }
    return jsonFetch<ShopItem>(`${base(guildId)}/shop`, {
        method: 'POST',
        body: JSON.stringify(item),
    });
}

export function deleteShopItem(guildId: string, itemId: number): Promise<void> {
    return jsonFetch<void>(`${base(guildId)}/shop/${itemId}`, { method: 'DELETE' });
}

// ── Role rules & fines ───────────────────────────────────────────────────────

export function saveRoleRules(
    guildId: string,
    payload: { roleRules: RoleRule[]; fineRules: FineRule[]; confiscateOnBan: boolean }
): Promise<void> {
    return jsonFetch<void>(`${base(guildId)}/roles`, {
        method: 'PUT',
        body: JSON.stringify(payload),
    });
}

// ── Quests & achievements ────────────────────────────────────────────────────

export function saveQuests(guildId: string, quests: QuestTemplate[]): Promise<void> {
    return jsonFetch<void>(`${base(guildId)}/quests`, {
        method: 'PUT',
        body: JSON.stringify({ quests }),
    });
}

export function saveAchievements(guildId: string, achievements: Achievement[]): Promise<void> {
    return jsonFetch<void>(`${base(guildId)}/achievements`, {
        method: 'PUT',
        body: JSON.stringify({ achievements }),
    });
}

// ── Ledger ───────────────────────────────────────────────────────────────────

export function loadLedger(
    guildId: string,
    opts: { cursor?: string | null; type?: LedgerType | null; userId?: string | null } = {}
): Promise<LedgerPage> {
    const params = new URLSearchParams();
    if (opts.cursor) params.set('cursor', opts.cursor);
    if (opts.type) params.set('type', opts.type);
    if (opts.userId) params.set('userId', opts.userId);
    const qs = params.toString();
    return jsonFetch<LedgerPage>(`${base(guildId)}/ledger${qs ? `?${qs}` : ''}`);
}

// ── Overview aggregates ──────────────────────────────────────────────────────

export function loadOverview(guildId: string, period: '24h' | '7d' | '30d' | '90d'): Promise<OverviewData> {
    return jsonFetch<OverviewData>(`${base(guildId)}/overview?period=${period}`);
}

// ── Events (airdrops, multiplier windows, lottery, seasons) ──────────────────

export function createEventWindow(
    guildId: string,
    payload: {
        type: EventWindowType;
        amount?: string;
        multiplier?: number;
        channelId?: string;
        startsAt: string;
        endsAt: string;
    }
): Promise<void> {
    return jsonFetch<void>(`${base(guildId)}/events`, {
        method: 'POST',
        body: JSON.stringify({ kind: 'event-window', ...payload }),
    });
}

export function createLottery(
    guildId: string,
    payload: { ticketPrice: string; houseCutBps: number; endsAt: string; channelId?: string }
): Promise<void> {
    return jsonFetch<void>(`${base(guildId)}/events`, {
        method: 'POST',
        body: JSON.stringify({ kind: 'lottery', ...payload }),
    });
}

export function drawLottery(guildId: string, lotteryId: number): Promise<void> {
    return jsonFetch<void>(`${base(guildId)}/events`, {
        method: 'POST',
        body: JSON.stringify({ kind: 'lottery-draw', lotteryId }),
    });
}

export function cancelEvent(guildId: string, kind: 'event-window' | 'lottery', id: number): Promise<void> {
    return jsonFetch<void>(`${base(guildId)}/events`, {
        method: 'DELETE',
        body: JSON.stringify({ kind, id }),
    });
}

// ── Seasons ──────────────────────────────────────────────────────────────────

export function endSeason(guildId: string, payload: { resetBalances: boolean }): Promise<void> {
    return jsonFetch<void>(`${base(guildId)}/seasons`, {
        method: 'POST',
        body: JSON.stringify({ action: 'end', ...payload }),
    });
}

export function loadHallOfFame(guildId: string, seasonNumber?: number): Promise<SeasonResultRow[]> {
    const qs = seasonNumber != null ? `?season=${seasonNumber}` : '';
    return jsonFetch<{ results: SeasonResultRow[] }>(`${base(guildId)}/seasons${qs}`).then((r) => r.results);
}
