import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request, { params }: { params: Promise<{ guildId: string }> }) {
    const { guildId } = await params;
    const config = await prisma.musicConfig.findUnique({
        where: { guildId },
    });

    const guild = await prisma.guild.findUnique({
        where: { id: guildId },
        select: { channels: true, roles: true }
    });

    return NextResponse.json({ config, guild });
}

export async function POST(request: Request, { params }: { params: Promise<{ guildId: string }> }) {
    const { guildId } = await params;
    const body = await request.json();

    const config = await prisma.musicConfig.upsert({
        where: { guildId },
        update: {
            channelMode: body.channelMode,
            allowedChannels: JSON.stringify(body.allowedChannels),
            djMode: body.djMode,
            djRoles: JSON.stringify(body.djRoles),
        },
        create: {
            guildId,
            channelMode: body.channelMode,
            allowedChannels: JSON.stringify(body.allowedChannels),
            djMode: body.djMode,
            djRoles: JSON.stringify(body.djRoles),
        },
    });

    return NextResponse.json(config);
}
