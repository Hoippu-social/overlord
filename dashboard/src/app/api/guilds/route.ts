import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthToken } from '@/lib/auth';
import { resolveAllowedGuildIds } from '@/lib/discordAccess';
import { LOCAL_SESSION_COOKIE_NAME } from '@/lib/authCookies';

export async function GET(request: NextRequest) {
    const token = await getAuthToken(request);
    const accessToken = typeof token?.accessToken === 'string' ? token.accessToken : null;

    const sessionToken = request.cookies.get(LOCAL_SESSION_COOKIE_NAME);

    // Admin login using password
    if (sessionToken && sessionToken.value) {
        try {
            const allGuilds = await prisma.guild.findMany({
                select: {
                    id: true,
                    name: true,
                    icon: true
                }
            });
            return NextResponse.json(allGuilds);
        } catch (error) {
            console.error('Failed to fetch guilds for admin:', error);
            return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
        }
    }

    if (!accessToken) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (token?.role === 'master' && Array.isArray(token.allowedGuilds)) {
        try {
            const guilds = await prisma.guild.findMany({
                where: {
                    id: { in: token.allowedGuilds },
                },
                select: {
                    id: true,
                    name: true,
                    icon: true,
                },
            });

            return NextResponse.json(guilds);
        } catch (error) {
            console.error('Failed to fetch guilds for master mode:', error);
            return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
        }
    }

    try {
        const allowedGuildIds = await resolveAllowedGuildIds(accessToken, { forceRefresh: true });
        if (!allowedGuildIds.length) {
            return NextResponse.json([]);
        }

        const filteredGuilds = await prisma.guild.findMany({
            where: {
                id: { in: allowedGuildIds }
            },
            select: {
                id: true,
                name: true,
                icon: true
            }
        });

        return NextResponse.json(filteredGuilds);
    } catch (error: unknown) {
        console.error('Failed to fetch guilds:', error);
        if (error instanceof Error && error.message.includes('401')) {
            return NextResponse.json({ error: 'Unauthorized Discord Token' }, { status: 401 });
        }
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
