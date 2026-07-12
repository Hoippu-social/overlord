import fs from 'fs';
import path from 'path';

type LavalinkTrackInfo = {
    identifier?: string;
    author?: string;
    length?: number;
    duration?: number;
    position?: number;
    title?: string;
    uri?: string;
    artworkUrl?: string | null;
    sourceName?: string;
};

type LavalinkTrack = {
    encoded: string;
    info: LavalinkTrackInfo;
};

type LavalinkPlayer = {
    track?: LavalinkTrack | null;
    volume?: number;
    paused?: boolean;
    state?: {
        time?: number;
        position?: number;
        ping?: number;
        connected?: boolean;
    };
    guildId?: string;
};

type LavalinkSearchResponse = {
    loadType?: string;
    data?: LavalinkTrack[] | LavalinkTrack;
    tracks?: LavalinkTrack[];
    playlistInfo?: {
        name?: string;
        selectedTrack?: number;
    };
    exception?: unknown;
};

const LAVALINK_HOST = process.env.LAVALINK_HOST || 'localhost';
const LAVALINK_PORT = process.env.LAVALINK_PORT || '2334';
const LAVALINK_PASSWORD = process.env.LAVALINK_PASSWORD;
const LAVALINK_SECURE = (process.env.LAVALINK_SECURE || '').toLowerCase() === 'true';
const LAVALINK_SESSION_ID = process.env.LAVALINK_SESSION_ID || '';
const SESSION_FILE_PATH = path.resolve(process.cwd(), '../bot/lavalink.session');

const lavalinkBaseUrl = `${LAVALINK_SECURE ? 'https' : 'http'}://${LAVALINK_HOST}:${LAVALINK_PORT}`;

async function lavalinkFetch(path: string, init: RequestInit = {}) {
    if (!LAVALINK_PASSWORD) {
        throw new Error('LAVALINK_PASSWORD is not configured');
    }

    const url = path.startsWith('http') ? path : `${lavalinkBaseUrl}${path}`;
    const headers = {
        Authorization: LAVALINK_PASSWORD,
        ...(init.headers || {}),
    } as Record<string, string>;

    const res = await fetch(url, { ...init, headers });
    return res;
}

export async function getActiveSessionId(): Promise<string | null> {
    if (LAVALINK_SESSION_ID) return LAVALINK_SESSION_ID;

    const fileSession = readSessionIdFromFile();
    if (fileSession) return fileSession;

    try {
        const res = await lavalinkFetch('/v4/sessions');
        if (!res.ok) return null;
        const parsed = (await res.json().catch(() => null)) as unknown;
        const sessionsRaw = Array.isArray(parsed)
            ? parsed
            : (parsed && typeof parsed === 'object' && Array.isArray((parsed as { data?: unknown }).data))
                ? (parsed as { data: unknown[] }).data
                : (parsed && typeof parsed === 'object' && Array.isArray((parsed as { sessions?: unknown }).sessions))
                    ? (parsed as { sessions: unknown[] }).sessions
                : [];

        const sessions = sessionsRaw.filter((item): item is { id?: string; sessionId?: string } => {
            return typeof item === 'object' && item !== null;
        });

        if (!sessions.length) return null;
        return sessions[0]?.id || sessions[0]?.sessionId || null;
    } catch {
        return null;
    }
}

function readSessionIdFromFile(): string | null {
    try {
        if (!fs.existsSync(SESSION_FILE_PATH)) return null;
        const content = fs.readFileSync(SESSION_FILE_PATH, 'utf8').trim();
        return content || null;
    } catch {
        return null;
    }
}

export async function getPlayerFromLavalink(guildId: string): Promise<(LavalinkPlayer & { sessionId: string }) | null> {
    const sessionId = await getActiveSessionId();
    if (!sessionId) return null;

    const res = await lavalinkFetch(`/v4/sessions/${sessionId}/players/${guildId}`);
    if (res.status === 404) return null;
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Lavalink player request failed (${res.status}): ${text}`);
    }

    const body = await res.json();
    return { ...(body as LavalinkPlayer), sessionId };
}

export async function searchLavalink(identifier: string) {
    const url = `/v4/loadtracks?identifier=${encodeURIComponent(identifier)}`;
    const res = await lavalinkFetch(url);
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Lavalink search failed (${res.status}): ${text || res.statusText}`);
    }

    const payload: LavalinkSearchResponse = await res.json();
    const tracksArray: LavalinkTrack[] = Array.isArray(payload.data)
        ? payload.data
        : payload.data
            ? [payload.data]
            : Array.isArray(payload.tracks)
                ? payload.tracks
                : [];

    return {
        loadType: payload.loadType,
        playlistInfo: payload.playlistInfo,
        tracks: tracksArray,
    };
}

export function buildSearchIdentifier(query: string, platform?: string) {
    const normalized = query.trim();
    if (!normalized) return '';

    const looksLikeUrl = /^https?:\/\//i.test(normalized);
    if (looksLikeUrl) return normalized;

    const platformPrefix = {
        youtube: 'ytsearch:',
        spotify: 'spsearch:',
        soundcloud: 'scsearch:',
    } as const;

    const prefix = platformPrefix[(platform || 'youtube') as keyof typeof platformPrefix] || 'ytsearch:';
    return `${prefix}${normalized}`;
}

export type { LavalinkTrack, LavalinkTrackInfo, LavalinkPlayer };

export async function queueTrackOnLavalink(
    guildId: string,
    encodedTrack: string,
    options?: { replaceCurrent?: boolean }
) {
    const player = await getPlayerFromLavalink(guildId);
    const sessionId = player?.sessionId || (await getActiveSessionId());
    if (!sessionId) throw new Error('Lavalink session not found');

    const replaceCurrent = player?.track ? (options?.replaceCurrent ?? false) : true;
    const noReplace = player?.track ? !replaceCurrent : false;
    const query = noReplace ? '?noReplace=true' : '';

    const res = await lavalinkFetch(`/v4/sessions/${sessionId}/players/${guildId}${query}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            track: {
                encoded: encodedTrack,
            },
        }),
    });

    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Lavalink queue failed (${res.status}): ${text || res.statusText}`);
    }

    const body = await res.json().catch(() => null);
    return body as LavalinkPlayer | null;
}

type LavalinkPlayerUpdate = {
    paused?: boolean;
    volume?: number;
    position?: number;
};

export async function updatePlayerOnLavalink(guildId: string, patch: LavalinkPlayerUpdate) {
    const player = await getPlayerFromLavalink(guildId);
    const sessionId = player?.sessionId || (await getActiveSessionId());
    if (!sessionId) throw new Error('Lavalink session not found');

    const res = await lavalinkFetch(`/v4/sessions/${sessionId}/players/${guildId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
    });

    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Lavalink player update failed (${res.status}): ${text || res.statusText}`);
    }

    const body = await res.json().catch(() => null);
    return body as LavalinkPlayer | null;
}
