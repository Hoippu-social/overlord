import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthToken } from '@/lib/auth';
import { canAccessGuild } from '@/lib/discordAccess';

const isVoiceChannel = (channel: any) =>
    channel?.type === 2 || channel?.type === 'voice' || channel?.type === 'GUILD_VOICE';

const isTextChannel = (channel: any) =>
    channel?.type === 0 || channel?.type === 'text' || channel?.type === 'GUILD_TEXT';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ guildId: string }> }
) {
    const token = await getAuthToken(request);
    const accessToken = typeof token?.accessToken === 'string' ? token.accessToken : null;
    if (!accessToken) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { guildId } = await params;
        const allowedGuilds = Array.isArray(token?.allowedGuilds) ? token.allowedGuilds : null;
        const hasAccess = allowedGuilds ? allowedGuilds.includes(guildId) : await canAccessGuild(accessToken, guildId);
        if (!hasAccess) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        if (!guildId) {
            return NextResponse.json({ error: 'Guild id is missing in route params' }, { status: 400 });
        }
        const guild = await prisma.guild.findUnique({
            where: { id: guildId },
            select: {
                id: true,
                name: true,
                icon: true,
                prefix: true,
                channels: true,
                roles: true,
                memberCount: true,
                onlineCount: true,
                updatedAt: true
            }
        });

        if (!guild) {
            return NextResponse.json({ error: 'Guild not found' }, { status: 404 });
        }

        let channelsRaw: any[] = [];
        let rolesRaw: any[] = [];

        try {
            if (guild.channels) channelsRaw = JSON.parse(guild.channels);
        } catch { /* silent */ }

        try {
            if (guild.roles) rolesRaw = JSON.parse(guild.roles);
        } catch { /* silent */ }

        const counts = {
            roles: Array.isArray(rolesRaw) ? rolesRaw.length : 0,
            voiceChannels: Array.isArray(channelsRaw) ? channelsRaw.filter(isVoiceChannel).length : 0,
            textChannels: Array.isArray(channelsRaw) ? channelsRaw.filter(isTextChannel).length : 0,
            totalChannels: Array.isArray(channelsRaw) ? channelsRaw.length : 0,
            members: guild.memberCount ?? null,
            onlineMembers: guild.onlineCount ?? null
        };

        return NextResponse.json({
            guild: {
                id: guild.id,
                name: guild.name,
                icon: guild.icon,
                prefix: guild.prefix
            },
            counts,
            lastSyncedAt: guild.updatedAt
        });
    } catch (error: any) {
        console.error('Failed to fetch guild summary:', error);
        return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
    }
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ guildId: string }> }
) {
    const token = await getAuthToken(request);
    const accessToken = typeof token?.accessToken === 'string' ? token.accessToken : null;
    if (!accessToken) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { guildId } = await params;
        const allowedGuilds = Array.isArray(token?.allowedGuilds) ? token.allowedGuilds : null;
        const hasAccess = allowedGuilds ? allowedGuilds.includes(guildId) : await canAccessGuild(accessToken, guildId);
        if (!hasAccess) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const body = await request.json();
        const updateData: any = {};

        if (typeof body.prefix === 'string') {
            updateData.prefix = body.prefix.trim().slice(0, 5);
        }
        if (typeof body.timezone === 'string') {
            updateData.timezone = body.timezone;
        }

        if (Object.keys(updateData).length === 0) {
            return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
        }

        const updated = await prisma.guild.update({
            where: { id: guildId },
            data: updateData
        });

        return NextResponse.json(updated);
    } catch (error: any) {
        console.error('Failed to update guild settings:', error);
        return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
    }
}
