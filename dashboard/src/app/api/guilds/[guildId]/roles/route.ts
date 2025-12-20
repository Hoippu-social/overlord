import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthToken } from '@/lib/auth';
import { canAccessGuild } from '@/lib/discordAccess';

const normalizeColor = (color: any) => {
    if (typeof color === 'number') {
        return `#${color.toString(16).padStart(6, '0')}`;
    }
    if (typeof color === 'string') {
        return color.startsWith('#') ? color : `#${color}`;
    }
    return '#000000';
};

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ guildId: string }> }
) {
    const token = await getAuthToken(request);
    const accessToken = typeof token?.accessToken === 'string' ? token.accessToken : null;
    if (!accessToken) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { guildId } = await params;
        const allowedGuilds = Array.isArray(token?.allowedGuilds) ? token.allowedGuilds : null;
        const hasAccess = allowedGuilds ? allowedGuilds.includes(guildId) : await canAccessGuild(accessToken, guildId);
        if (!hasAccess) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const guild = await prisma.guild.findUnique({
            where: { id: guildId },
            select: { roles: true }
        });

        if (!guild?.roles) {
            return NextResponse.json([]);
        }

        let roles: any[] = [];

        try {
            const parsed = JSON.parse(guild.roles);
            if (Array.isArray(parsed)) {
                roles = parsed;
            }
        } catch (error) {
            console.error('Failed to parse roles JSON:', error);
            return NextResponse.json({ error: 'Invalid roles payload' }, { status: 500 });
        }

        const normalizedRoles = roles
            .map((role: any) => ({
                ...role,
                color: normalizeColor(role.color)
            }))
            .sort((a: any, b: any) => (parseInt(b.position) || 0) - (parseInt(a.position) || 0));

        return NextResponse.json(normalizedRoles);
    } catch (error) {
        console.error('Error fetching roles:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
