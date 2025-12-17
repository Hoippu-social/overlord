import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';

const normalizeColor = (color: any) => {
    if (typeof color === 'number') return `#${color.toString(16).padStart(6, '0')}`;
    if (typeof color === 'string') return color.startsWith('#') ? color : `#${color}`;
    return '#000000';
};

const isVoiceChannel = (channel: any) =>
    channel?.type === 2 || channel?.type === 'voice' || channel?.type === 'GUILD_VOICE';

const isTextChannel = (channel: any) =>
    channel?.type === 0 || channel?.type === 'text' || channel?.type === 'GUILD_TEXT';

export async function GET(
    _request: NextRequest,
    { params }: { params: { guildId: string } }
) {
    const session = (await cookies()).get('session');
    if (!session?.value) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { guildId } = params;
        const guild = await prisma.guild.findUnique({
            where: { id: guildId },
            select: { id: true, name: true, icon: true, prefix: true, channels: true, roles: true, updatedAt: true }
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
            totalChannels: channels.length
        };

        const topRoles = roles
            .filter((role: any) => role.id !== guildId) // exclude @everyone
            .sort((a: any, b: any) => (parseInt(b.position) || 0) - (parseInt(a.position) || 0))
            .slice(0, 5)
            .map((role: any) => ({
                id: role.id,
                name: role.name,
                color: normalizeColor(role.color)
            }));

        return NextResponse.json({
            guild: {
                id: guild.id,
                name: guild.name,
                icon: guild.icon,
                prefix: guild.prefix
            },
            counts,
            topRoles,
            lastSyncedAt: guild.updatedAt
        });
    } catch (error) {
        console.error('Failed to fetch guild summary:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
