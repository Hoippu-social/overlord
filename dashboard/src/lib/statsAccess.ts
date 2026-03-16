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

type AccessResult =
    | { ok: true; context: AccessContext }
    | { ok: false; response: NextResponse };

export async function requireGuildStatsAccess(
    request: NextRequest,
    guildId: string
): Promise<AccessResult> {
    const token = (await getAuthToken(request)) as AuthTokenLike | null;
    const accessToken = typeof token?.accessToken === 'string' ? token.accessToken : null;

    if (!accessToken) {
        return {
            ok: false,
            response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
        };
    }

    const isAdmin = accessToken === 'admin' || token?.role === 'admin';
    if (isAdmin) {
        return {
            ok: true,
            context: { accessToken, isAdmin: true },
        };
    }

    const allowedGuilds = Array.isArray(token?.allowedGuilds) ? token.allowedGuilds : null;
    const hasAccess =
        (allowedGuilds?.includes(guildId) ?? false) || (await canAccessGuild(accessToken, guildId));

    if (!hasAccess) {
        return {
            ok: false,
            response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
        };
    }

    return {
        ok: true,
        context: { accessToken, isAdmin: false },
    };
}
