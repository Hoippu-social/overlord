import { prisma } from '@/lib/prisma';
import { fetchWithTimeout } from '@/lib/requestTimeout';

type DiscordGuild = {
    id: string;
    owner: boolean;
    permissions: string;
};

type DiscordMember = {
    roles: string[];
};

type BotGuild = {
    id: string;
    botSettings?: { adminRoles: string | null } | null;
};

const ADMIN_PERMISSION = BigInt(0x8);
const MANAGE_GUILD_PERMISSION = BigInt(0x20);
const DISCORD_API_TIMEOUT_MS = 4000;
const USER_GUILDS_CACHE_TTL_MS = 10_000;
const MEMBER_ROLES_CACHE_TTL_MS = 10_000;
const ALLOWED_GUILDS_CACHE_TTL_MS = 10_000;
const GUILD_ACCESS_CACHE_TTL_MS = 5_000;
const ROLE_CHECK_CONCURRENCY = 8;

type AccessLookupOptions = {
    forceRefresh?: boolean;
};

type CacheEntry<T> = {
    expiresAt: number;
    value: T;
};

type DiscordAccessCache = {
    allowedGuildIds: Map<string, CacheEntry<string[]>>;
    guildAccess: Map<string, CacheEntry<boolean>>;
    memberRoles: Map<string, CacheEntry<string[] | null>>;
    userGuilds: Map<string, CacheEntry<DiscordGuild[]>>;
};

const globalForDiscordAccess = globalThis as typeof globalThis & {
    __dashboardDiscordAccessCache?: DiscordAccessCache;
};

const discordAccessCache = globalForDiscordAccess.__dashboardDiscordAccessCache ?? {
    allowedGuildIds: new Map<string, CacheEntry<string[]>>(),
    guildAccess: new Map<string, CacheEntry<boolean>>(),
    memberRoles: new Map<string, CacheEntry<string[] | null>>(),
    userGuilds: new Map<string, CacheEntry<DiscordGuild[]>>(),
};

if (!globalForDiscordAccess.__dashboardDiscordAccessCache) {
    globalForDiscordAccess.__dashboardDiscordAccessCache = discordAccessCache;
}

const parseJsonArray = (value: unknown) => {
    if (Array.isArray(value)) {
        return value.filter((item) => typeof item === 'string');
    }
    if (typeof value !== 'string') return [];
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : [];
    } catch {
        return [];
    }
};

const hasGuildPermission = (permissions: string | null | undefined) => {
    if (!permissions) return false;
    try {
        const value = BigInt(permissions);
        return (value & ADMIN_PERMISSION) === ADMIN_PERMISSION || (value & MANAGE_GUILD_PERMISSION) === MANAGE_GUILD_PERMISSION;
    } catch {
        return false;
    }
};

const getCachedValue = <T>(store: Map<string, CacheEntry<T>>, key: string): T | undefined => {
    const entry = store.get(key);
    if (!entry) {
        return undefined;
    }

    if (entry.expiresAt <= Date.now()) {
        store.delete(key);
        return undefined;
    }

    return entry.value;
};

const setCachedValue = <T>(store: Map<string, CacheEntry<T>>, key: string, value: T, ttlMs: number): T => {
    store.set(key, {
        value,
        expiresAt: Date.now() + ttlMs,
    });

    return value;
};

const buildGuildAccessKey = (accessToken: string, guildId: string) => `${accessToken}:${guildId}`;

async function mapWithConcurrency<T, R>(
    values: T[],
    concurrency: number,
    mapper: (value: T) => Promise<R>
): Promise<R[]> {
    if (values.length === 0) {
        return [];
    }

    const results = new Array<R>(values.length);
    let nextIndex = 0;

    const worker = async () => {
        while (nextIndex < values.length) {
            const currentIndex = nextIndex;
            nextIndex += 1;
            results[currentIndex] = await mapper(values[currentIndex]);
        }
    };

    await Promise.all(
        Array.from({ length: Math.max(1, Math.min(concurrency, values.length)) }, () => worker())
    );

    return results;
}

const fetchDiscordGuilds = async (
    accessToken: string,
    options: AccessLookupOptions = {}
): Promise<DiscordGuild[]> => {
    if (!options.forceRefresh) {
        const cached = getCachedValue(discordAccessCache.userGuilds, accessToken);
        if (cached !== undefined) {
            return cached;
        }
    }

    const res = await fetchWithTimeout('https://discord.com/api/users/@me/guilds', {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: 'no-store'
    }, DISCORD_API_TIMEOUT_MS, 'Discord guild list');
    if (!res.ok) {
        throw new Error(`Discord guilds request failed (${res.status})`);
    }
    const data = await res.json();
    return setCachedValue(
        discordAccessCache.userGuilds,
        accessToken,
        Array.isArray(data) ? data : [],
        USER_GUILDS_CACHE_TTL_MS
    );
};

const fetchMemberRoles = async (
    guildId: string,
    accessToken: string,
    options: AccessLookupOptions = {}
): Promise<string[] | null> => {
    const cacheKey = buildGuildAccessKey(accessToken, guildId);
    if (!options.forceRefresh) {
        const cached = getCachedValue(discordAccessCache.memberRoles, cacheKey);
        if (cached !== undefined) {
            return cached;
        }
    }

    const res = await fetchWithTimeout(`https://discord.com/api/users/@me/guilds/${guildId}/member`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: 'no-store'
    }, DISCORD_API_TIMEOUT_MS, `Discord guild member lookup (${guildId})`);
    if (!res.ok) {
        return setCachedValue(discordAccessCache.memberRoles, cacheKey, null, GUILD_ACCESS_CACHE_TTL_MS);
    }
    const data = (await res.json()) as DiscordMember;
    return setCachedValue(
        discordAccessCache.memberRoles,
        cacheKey,
        Array.isArray(data?.roles) ? data.roles : null,
        MEMBER_ROLES_CACHE_TTL_MS
    );
};

const isMissingTableError = (error: unknown) => {
    const err = error as { code?: string; message?: string };
    if (err?.code === 'P2021') return true;
    const message = err?.message || '';
    return message.includes('no such table') || message.includes('does not exist');
};

export async function resolveAllowedGuildIds(
    accessToken: string,
    options: AccessLookupOptions = {}
): Promise<string[]> {
    if (!options.forceRefresh) {
        const cached = getCachedValue(discordAccessCache.allowedGuildIds, accessToken);
        if (cached !== undefined) {
            return cached;
        }
    }

    let guilds: BotGuild[] = [];
    try {
        guilds = await prisma.guild.findMany({
            select: {
                id: true,
                botSettings: {
                    select: { adminRoles: true }
                }
            }
        });
    } catch (error) {
        if (isMissingTableError(error)) {
            guilds = await prisma.guild.findMany({
                select: { id: true }
            });
        } else {
            throw error;
        }
    }

    if (accessToken === 'admin') {
        return setCachedValue(
            discordAccessCache.allowedGuildIds,
            accessToken,
            guilds.map(g => g.id),
            ALLOWED_GUILDS_CACHE_TTL_MS
        );
    }

    const userGuilds = await fetchDiscordGuilds(accessToken, options);
    const userGuildMap = new Map(userGuilds.map((guild) => [guild.id, guild]));
    const directAccessIds = new Set<string>();
    const roleCheckCandidates: Array<{ adminRoles: string[]; guildId: string }> = [];

    for (const guild of guilds) {
        const userGuild = userGuildMap.get(guild.id);
        if (!userGuild) {
            continue;
        }

        if (userGuild.owner || hasGuildPermission(userGuild.permissions)) {
            directAccessIds.add(guild.id);
            continue;
        }

        const adminRoles = parseJsonArray(guild.botSettings?.adminRoles);
        if (!adminRoles.length) {
            continue;
        }

        roleCheckCandidates.push({ adminRoles, guildId: guild.id });
    }

    const roleGrantedIds = await mapWithConcurrency(roleCheckCandidates, ROLE_CHECK_CONCURRENCY, async ({ guildId, adminRoles }) => {
        const memberRoles = await fetchMemberRoles(guildId, accessToken, options);
        if (!memberRoles) {
            return null;
        }

        return memberRoles.some((roleId) => adminRoles.includes(roleId)) ? guildId : null;
    });

    const allowedGuildIds = Array.from(
        new Set([
            ...directAccessIds,
            ...roleGrantedIds.filter((guildId): guildId is string => Boolean(guildId)),
        ])
    );

    return setCachedValue(
        discordAccessCache.allowedGuildIds,
        accessToken,
        allowedGuildIds,
        ALLOWED_GUILDS_CACHE_TTL_MS
    );
}

export async function canAccessGuild(
    accessToken: string,
    guildId: string,
    options: AccessLookupOptions = {}
): Promise<boolean> {
    if (accessToken === 'admin') return true;

    const cacheKey = buildGuildAccessKey(accessToken, guildId);
    if (!options.forceRefresh) {
        const cached = getCachedValue(discordAccessCache.guildAccess, cacheKey);
        if (cached !== undefined) {
            return cached;
        }
    }

    const guilds = await fetchDiscordGuilds(accessToken, options);
    const userGuild = guilds.find((guild) => guild.id === guildId);
    if (!userGuild) {
        return options.forceRefresh
            ? false
            : setCachedValue(discordAccessCache.guildAccess, cacheKey, false, GUILD_ACCESS_CACHE_TTL_MS);
    }

    if (userGuild.owner || hasGuildPermission(userGuild.permissions)) {
        return options.forceRefresh
            ? true
            : setCachedValue(discordAccessCache.guildAccess, cacheKey, true, GUILD_ACCESS_CACHE_TTL_MS);
    }

    let adminRoles: string[] = [];
    try {
        const botSettings = await prisma.botSettings.findUnique({
            where: { guildId },
            select: { adminRoles: true }
        });
        adminRoles = parseJsonArray(botSettings?.adminRoles);
    } catch (error) {
        if (!isMissingTableError(error)) {
            throw error;
        }
    }
    if (!adminRoles.length) {
        return options.forceRefresh
            ? false
            : setCachedValue(discordAccessCache.guildAccess, cacheKey, false, GUILD_ACCESS_CACHE_TTL_MS);
    }

    const memberRoles = await fetchMemberRoles(guildId, accessToken, options);
    if (!memberRoles) {
        return options.forceRefresh
            ? false
            : setCachedValue(discordAccessCache.guildAccess, cacheKey, false, GUILD_ACCESS_CACHE_TTL_MS);
    }

    const hasAccess = memberRoles.some((roleId) => adminRoles.includes(roleId));

    return options.forceRefresh
        ? hasAccess
        : setCachedValue(
            discordAccessCache.guildAccess,
            cacheKey,
            hasAccess,
            GUILD_ACCESS_CACHE_TTL_MS
        );
}
