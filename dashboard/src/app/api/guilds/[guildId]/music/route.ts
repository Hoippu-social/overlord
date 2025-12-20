import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthToken } from '@/lib/auth';
import { canAccessGuild } from '@/lib/discordAccess';

export async function GET(request: NextRequest, { params }: { params: Promise<{ guildId: string }> }) {
    const token = await getAuthToken(request);
    const accessToken = typeof token?.accessToken === 'string' ? token.accessToken : null;
    if (!accessToken) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { guildId } = await params;
    const allowedGuilds = Array.isArray(token?.allowedGuilds) ? token.allowedGuilds : null;
    const hasAccess = allowedGuilds ? allowedGuilds.includes(guildId) : await canAccessGuild(accessToken, guildId);
    if (!hasAccess) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const config = await prisma.musicConfig.findUnique({
        where: { guildId },
    });

    const guild = await prisma.guild.findUnique({
        where: { id: guildId },
        select: { channels: true, roles: true }
    });

    return NextResponse.json({ config, guild });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ guildId: string }> }) {
    const token = await getAuthToken(request);
    const accessToken = typeof token?.accessToken === 'string' ? token.accessToken : null;
    if (!accessToken) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { guildId } = await params;
    const allowedGuilds = Array.isArray(token?.allowedGuilds) ? token.allowedGuilds : null;
    const hasAccess = allowedGuilds ? allowedGuilds.includes(guildId) : await canAccessGuild(accessToken, guildId);
    if (!hasAccess) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const body = await request.json();

    const config = await prisma.musicConfig.upsert({
        where: { guildId },
        update: {
            channelMode: body.channelMode,
            allowedChannels: JSON.stringify(body.allowedChannels),
            djMode: body.djMode,
            djRoles: JSON.stringify(body.djRoles),
            defaultVolume: Math.max(0, Math.min(150, parseInt(body.defaultVolume ?? 50, 10) || 50)),
        },
        create: {
            guildId,
            channelMode: body.channelMode,
            allowedChannels: JSON.stringify(body.allowedChannels),
            djMode: body.djMode,
            djRoles: JSON.stringify(body.djRoles),
            defaultVolume: Math.max(0, Math.min(150, parseInt(body.defaultVolume ?? 50, 10) || 50)),
        },
    });

    return NextResponse.json(config);
}
