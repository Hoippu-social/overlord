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

    if (token?.role === 'master') {
        return { accessToken, token };
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
