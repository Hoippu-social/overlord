import type { NextAuthOptions } from 'next-auth';
import DiscordProvider from 'next-auth/providers/discord';
import type { JWT } from 'next-auth/jwt';
import { getToken } from 'next-auth/jwt';
import type { NextRequest } from 'next/server';
import { resolveAllowedGuildIds } from '@/lib/discordAccess';

type DiscordToken = JWT & {
    accessToken?: string;
    refreshToken?: string;
    accessTokenExpires?: number;
    allowedGuilds?: string[];
    error?: string;
};

const DISCORD_AUTH_URL = 'https://discord.com/api/oauth2/authorize';
const DISCORD_TOKEN_URL = 'https://discord.com/api/oauth2/token';
const DISCORD_SCOPES = ['identify', 'guilds', 'guilds.members.read'];

async function refreshAccessToken(token: DiscordToken): Promise<DiscordToken> {
    try {
        const params = new URLSearchParams();
        params.set('client_id', process.env.DISCORD_CLIENT_ID || '');
        params.set('client_secret', process.env.DISCORD_CLIENT_SECRET || '');
        params.set('grant_type', 'refresh_token');
        params.set('refresh_token', token.refreshToken || '');

        const response = await fetch(DISCORD_TOKEN_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params.toString()
        });

        const refreshed = await response.json();
        if (!response.ok) {
            throw new Error(refreshed?.error_description || 'Failed to refresh access token');
        }

        return {
            ...token,
            accessToken: refreshed.access_token,
            accessTokenExpires: Date.now() + refreshed.expires_in * 1000,
            refreshToken: refreshed.refresh_token ?? token.refreshToken
        };
    } catch (error) {
        console.error('Failed to refresh Discord access token:', error);
        return { ...token, error: 'RefreshAccessTokenError' };
    }
}

export const authOptions: NextAuthOptions = {
    providers: [
        DiscordProvider({
            clientId: process.env.DISCORD_CLIENT_ID || '',
            clientSecret: process.env.DISCORD_CLIENT_SECRET || '',
            authorization: {
                url: DISCORD_AUTH_URL,
                params: {
                    scope: DISCORD_SCOPES.join(' ')
                }
            }
        })
    ],
    session: {
        strategy: 'jwt'
    },
    secret: process.env.NEXTAUTH_SECRET,
    pages: {
        signIn: '/login'
    },
    callbacks: {
        async jwt({ token, account }) {
            if (account) {
                let allowedGuilds: string[] | undefined;
                if (account.access_token) {
                    try {
                        allowedGuilds = await resolveAllowedGuildIds(account.access_token);
                    } catch (error) {
                        console.error('Failed to resolve allowed guilds:', error);
                    }
                }
                const expiresAt = account.expires_at
                    ? account.expires_at * 1000
                    : Date.now() + Number(account.expires_in ?? 0) * 1000;

                return {
                    ...token,
                    accessToken: account.access_token,
                    refreshToken: account.refresh_token ?? token.refreshToken,
                    accessTokenExpires: expiresAt,
                    allowedGuilds
                } as DiscordToken;
            }

            const discordToken = token as DiscordToken;
            if (discordToken.accessToken && discordToken.accessTokenExpires) {
                const shouldRefresh = Date.now() > discordToken.accessTokenExpires - 60 * 1000;
                if (!shouldRefresh) {
                    return discordToken;
                }
            }

            if (discordToken.refreshToken) {
                return await refreshAccessToken(discordToken);
            }

            return discordToken;
        },
        async session({ session, token }) {
            if (session.user) {
                (session.user as { id?: string }).id = token.sub;
            }
            (session as { accessToken?: string; error?: string }).accessToken = (token as DiscordToken).accessToken;
            (session as { accessToken?: string; error?: string }).error = (token as DiscordToken).error;
            return session;
        }
    }
};

export async function getAuthToken(request: NextRequest) {
    return getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
}
