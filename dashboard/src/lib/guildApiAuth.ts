import { NextRequest, NextResponse } from 'next/server';
import { getAuthToken } from '@/lib/auth';
import { canAccessGuild } from '@/lib/discordAccess';

type AuthorizeGuildApiRequestOptions = {
    live?: boolean;
};

type GuildApiAuthSuccess = {
    accessToken: string;
    token: Awaited<ReturnType<typeof getAuthToken>>;
};

type GuildApiAuthFailure = {
    response: NextResponse;
};

const SUPER_USER_ROLES = new Set(['admin', 'owner', 'master']);

export async function authorizeGuildApiRequest(
    request: NextRequest,
    guildId: string,
    options: AuthorizeGuildApiRequestOptions = {}
): Promise<GuildApiAuthSuccess | GuildApiAuthFailure> {
    const token = await getAuthToken(request);
    const accessToken = typeof token?.accessToken === 'string' ? token.accessToken : null;

    if (!accessToken) {
        return {
            response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
        };
    }

    const role = typeof token?.role === 'string' ? token.role : null;
    if (accessToken === 'admin' || (role && SUPER_USER_ROLES.has(role))) {
        return { accessToken: 'admin', token };
    }

    const allowedGuilds = Array.isArray(token?.allowedGuilds) ? token.allowedGuilds : null;
    const hasAccess = options.live
        ? await canAccessGuild(accessToken, guildId, { forceRefresh: true })
        : allowedGuilds
            ? allowedGuilds.includes(guildId)
            : await canAccessGuild(accessToken, guildId);

    if (!hasAccess) {
        return {
            response: NextResponse.json(
                { error: 'Forbidden', code: 'guild_access_revoked' },
                { status: 403 }
            ),
        };
    }

    return { accessToken, token };
}

export const isGuildApiAuthFailure = (
    result: GuildApiAuthSuccess | GuildApiAuthFailure
): result is GuildApiAuthFailure => 'response' in result;
