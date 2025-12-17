import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';

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
    _request: NextRequest,
    { params }: { params: Promise<{ guildId: string }> }
) {
    // Verify session
    const session = (await cookies()).get('session');
    if (!session?.value) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { guildId } = await params;

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
