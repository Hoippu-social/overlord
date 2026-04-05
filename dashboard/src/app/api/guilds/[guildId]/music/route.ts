import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorizeGuildApiRequest, isGuildApiAuthFailure } from '@/lib/guildApiAuth';

export async function GET(request: NextRequest, { params }: { params: Promise<{ guildId: string }> }) {
    const { guildId } = await params;
    const auth = await authorizeGuildApiRequest(request, guildId);
    if (isGuildApiAuthFailure(auth)) {
        return auth.response;
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
    const { guildId } = await params;
    const auth = await authorizeGuildApiRequest(request, guildId, { live: true });
    if (isGuildApiAuthFailure(auth)) {
        return auth.response;
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
