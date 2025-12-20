import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthToken } from '@/lib/auth';
import { resolveAllowedGuildIds } from '@/lib/discordAccess';

export async function GET(request: NextRequest) {
    const token = await getAuthToken(request);
    const accessToken = typeof token?.accessToken === 'string' ? token.accessToken : null;

    if (!accessToken) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const allowedGuilds = Array.isArray(token?.allowedGuilds)
            ? token.allowedGuilds.filter((id) => typeof id === 'string')
            : null;
        const allowedGuildIds = allowedGuilds?.length ? allowedGuilds : await resolveAllowedGuildIds(accessToken);
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
    } catch (error) {
        console.error('Failed to fetch guilds:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
