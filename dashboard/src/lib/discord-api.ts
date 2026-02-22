
import dotenv from 'dotenv';
import path from 'path';

const DISCORD_API = 'https://discord.com/api/v10';

export function getBotToken() {
    if (process.env.DISCORD_TOKEN) return process.env.DISCORD_TOKEN;

    // Try multiple paths for .env
    const paths = [
        path.resolve(process.cwd(), '.env'),
        path.resolve(process.cwd(), '../bot/.env'),
        path.resolve('d:/discord_bot/Dev/bot/.env') // Fallback absolute path
    ];

    for (const p of paths) {
        try {
            if (require('fs').existsSync(p)) {
                dotenv.config({ path: p, override: true });
                if (process.env.DISCORD_TOKEN) return process.env.DISCORD_TOKEN;
            }
        } catch { }
    }

    throw new Error('DISCORD_TOKEN is not configured on dashboard');
}

export async function discordRequest(method: string, path: string, token: string, body?: any, reason?: string) {
    const headers: any = { Authorization: `Bot ${token}` };
    if (body) headers['Content-Type'] = 'application/json';
    if (reason) headers['X-Audit-Log-Reason'] = encodeURIComponent(reason);

    const res = await fetch(`${DISCORD_API}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
    });

    if (res.status === 204) return null;
    if (!res.ok && res.status !== 404) {
        const text = await res.text();
        throw new Error(`Discord API ${res.status}: ${text}`);
    }
    try {
        return await res.json();
    } catch {
        return null;
    }
}

export async function fetchGuildChannels(guildId: string) {
    const token = getBotToken();
    return await discordRequest('GET', `/guilds/${guildId}/channels`, token);
}

export function parseChannels(channels: any[]) {
    if (!Array.isArray(channels)) return { categories: [], voice: [], text: [] };

    // Helper to map category positions
    const categoryMap = new Map<string, number>();
    channels
        .filter((c: any) => c.type === 4) // Category
        .forEach((c: any) => categoryMap.set(c.id, typeof c.position === 'number' ? c.position : 0));

    const sortWithCategory = (a: any, b: any) => {
        const catPosA = a.parentId ? (categoryMap.get(a.parentId) ?? -1) : -1;
        const catPosB = b.parentId ? (categoryMap.get(b.parentId) ?? -1) : -1;

        if (catPosA !== catPosB) return catPosA - catPosB;

        const posA = typeof a.position === 'number' ? a.position : 0;
        const posB = typeof b.position === 'number' ? b.position : 0;
        return posA - posB;
    };

    const sortSimple = (a: any, b: any) => {
        const posA = typeof a.position === 'number' ? a.position : 0;
        const posB = typeof b.position === 'number' ? b.position : 0;
        return posA - posB;
    };

    const categories = channels
        .filter((c) => c.type === 4)
        .sort(sortSimple);

    const voice = channels
        .filter((c) => c.type === 2)
        .sort(sortWithCategory);

    const text = channels
        .filter((c) => c.type === 0)
        .sort(sortWithCategory);

    return { categories, voice, text };
}
