import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getAuthToken } from '@/lib/auth';
import { canAccessGuild } from '@/lib/discordAccess';

type AuthTokenLike = {
    accessToken?: string;
    allowedGuilds?: string[];
    role?: string;
};

type AccessContext = {
    accessToken: string;
    isAdmin: boolean;
};

type RequireGuildStatsAccessOptions = {
    live?: boolean;
};

type AccessResult =
    | { ok: true; context: AccessContext }
    | { ok: false; response: NextResponse };

export async function requireGuildStatsAccess(
    request: NextRequest,
    guildId: string,
    options: RequireGuildStatsAccessOptions = {}
): Promise<AccessResult> {
    const token = (await getAuthToken(request)) as AuthTokenLike | null;
    const accessToken = typeof token?.accessToken === 'string' ? token.accessToken : null;

    if (!accessToken) {
        return {
            ok: false,
            response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
        };
    }

    const hasGlobalAccess =
        accessToken === 'admin' || token?.role === 'admin' || token?.role === 'master';
    if (hasGlobalAccess) {
        return {
            ok: true,
            context: { accessToken, isAdmin: true },
        };
    }

    const allowedGuilds = Array.isArray(token?.allowedGuilds) ? token.allowedGuilds : null;
    const hasAccess = options.live
        ? await canAccessGuild(accessToken, guildId, { forceRefresh: true })
        : (allowedGuilds?.includes(guildId) ?? false) || (await canAccessGuild(accessToken, guildId));

    if (!hasAccess) {
        return {
            ok: false,
            response: NextResponse.json(
                { error: 'Forbidden', code: 'guild_access_revoked' },
                { status: 403 }
            ),
        };
    }

    return {
        ok: true,
        context: { accessToken, isAdmin: false },
    };
}
