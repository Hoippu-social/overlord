import { fetchGuildChannels, fetchGuildEmojis, parseChannels } from '@/lib/discord-api';
import type { DiscordRoleRef, DiscordChannelRef, DiscordEmojiRef } from '@/lib/economy/types';
import { prisma } from '@/lib/prisma';

const BOT_API_PORT = process.env.DASHBOARD_API_PORT || '3002';
export const BOT_API_URL = process.env.DASHBOARD_API_URL || `http://127.0.0.1:${BOT_API_PORT}`;
const BOT_API_KEY = process.env.DASHBOARD_API_KEY || '';

export function botHeaders(): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (BOT_API_KEY) headers['x-dashboard-key'] = BOT_API_KEY;
    return headers;
}

// POST to a bot bridge endpoint. Returns parsed { ok, error? } or throws on transport failure.
export async function botPost(path: string, payload: unknown): Promise<{ ok: boolean; error?: string }> {
    const res = await fetch(`${BOT_API_URL}${path}`, {
        method: 'POST',
        headers: botHeaders(),
        body: JSON.stringify(payload),
    });
    const data = (await res.json()) as { ok: boolean; error?: string };
    if (!res.ok) {
        return { ok: false, error: data?.error || `Bot responded ${res.status}` };
    }
    return data;
}

// Best-effort cache invalidation — never throws.
export async function invalidateEconomyCache(guildId: string): Promise<void> {
    try {
        await botPost('/api/economy/invalidate-cache', { guildId });
    } catch {
        // Bridge outage is non-fatal; the bot's 5-min TTL will pick up changes eventually.
    }
}

const normalizeColor = (color: unknown): string => {
    if (typeof color === 'number') return `#${color.toString(16).padStart(6, '0')}`;
    if (typeof color === 'string') return color.startsWith('#') ? color : `#${color}`;
    return '#0e0e0e';
};

export async function loadRoles(guildId: string): Promise<DiscordRoleRef[]> {
    const guild = await prisma.guild.findUnique({ where: { id: guildId }, select: { roles: true } });
    if (!guild?.roles) return [];
    let parsed: unknown;
    try {
        parsed = JSON.parse(guild.roles);
    } catch {
        return [];
    }
    if (!Array.isArray(parsed)) return [];
    return parsed
        .map((r: { id: string; name: string; color?: unknown; position?: number }) => ({
            id: String(r.id),
            name: String(r.name),
            color: normalizeColor(r.color),
            position: typeof r.position === 'number' ? r.position : Number(r.position) || 0,
        }))
        .sort((a, b) => (b.position ?? 0) - (a.position ?? 0));
}

export async function loadChannels(guildId: string): Promise<DiscordChannelRef[]> {
    try {
        const parsed = parseChannels((await fetchGuildChannels(guildId)) || []);
        // parseChannels returns raw Discord channel objects; the DiscordChannel type it's
        // declared against omits `name`, so read it through a loose record view.
        const all = [...parsed.categories, ...parsed.text, ...parsed.voice] as Array<{
            id: string | number;
            name?: string;
            type?: string | number | null;
            parentId?: string | number | null;
        }>;
        return all.map((c) => ({
            id: String(c.id),
            name: c.name ?? String(c.id),
            type: c.type ?? undefined,
            parentId: c.parentId != null ? String(c.parentId) : null,
        }));
    } catch {
        return [];
    }
}

export async function loadEmojis(guildId: string): Promise<DiscordEmojiRef[]> {
    try {
        const emojis = await fetchGuildEmojis(guildId);
        return emojis
            .filter((emoji) => emoji.id != null && emoji.name)
            .map((emoji) => {
                const id = String(emoji.id);
                const name = String(emoji.name);
                const animated = Boolean(emoji.animated);
                const extension = animated ? 'gif' : 'png';
                return {
                    id,
                    name,
                    animated,
                    available: emoji.available ?? true,
                    url: `https://cdn.discordapp.com/emojis/${id}.${extension}?size=48&quality=lossless`,
                    value: `<${animated ? 'a' : ''}:${name}:${id}>`,
                };
            })
            .sort((a, b) => a.name.localeCompare(b.name));
    } catch {
        return [];
    }
}

type EnrichedUser = { name?: string; username?: string; avatar?: string | null };

// Resolve userId -> { displayName, avatar } via the bot bridge. Degrades gracefully to {} on failure.
export async function enrichUsers(
    guildId: string,
    userIds: string[]
): Promise<Record<string, { displayName: string | null; avatar: string | null }>> {
    const unique = Array.from(new Set(userIds)).filter(Boolean);
    if (unique.length === 0) return {};
    try {
        const res = await fetch(`${BOT_API_URL}/api/enrich`, {
            method: 'POST',
            headers: botHeaders(),
            body: JSON.stringify({ guildId, userIds: unique, channelIds: [] }),
        });
        if (!res.ok) return {};
        const data = (await res.json()) as { users?: Record<string, EnrichedUser> };
        const out: Record<string, { displayName: string | null; avatar: string | null }> = {};
        for (const id of unique) {
            const u = data.users?.[id];
            out[id] = {
                displayName: u?.name ?? u?.username ?? null,
                avatar: u?.avatar ?? null,
            };
        }
        return out;
    } catch {
        return {};
    }
}
