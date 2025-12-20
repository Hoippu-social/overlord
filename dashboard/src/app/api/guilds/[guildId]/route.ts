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

        let channels: any[] = [];
        let roles: any[] = [];

        try {
            const parsedChannels = guild.channels ? JSON.parse(guild.channels) : [];
            if (Array.isArray(parsedChannels)) {
                channels = parsedChannels;
            }
        } catch (error) {
            console.error('Failed to parse channels JSON for guild', guildId, error);
        }

        try {
            const parsedRoles = guild.roles ? JSON.parse(guild.roles) : [];
            if (Array.isArray(parsedRoles)) {
                roles = parsedRoles;
            }
        } catch (error) {
            console.error('Failed to parse roles JSON for guild', guildId, error);
        }

        const counts = {
            roles: roles.length,
            voiceChannels: channels.filter(isVoiceChannel).length,
            textChannels: channels.filter(isTextChannel).length,
            totalChannels: channels.length,
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
