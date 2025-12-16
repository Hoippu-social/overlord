import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';

export async function GET(
    request: NextRequest,
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

        if (!guild || !guild.roles) {
            const mockRoles = [
                { id: '1', name: 'Admin', color: 16711680, position: 10, icon: null },
                { id: '2', name: 'Moderator', color: 3447003, position: 9, icon: null },
                { id: '3', name: 'DJ', color: 15105570, position: 8, icon: '🎧' },
                { id: '4', name: 'Member', color: 9807270, position: 1, icon: null },
                { id: '5', name: 'Friend', color: 10181046, position: 2, icon: '💜' },
                { id: '6', name: 'Bot', color: 6323595, position: 0, icon: '🤖' },
            ];
            return NextResponse.json(mockRoles);
        }

        let roles = JSON.parse(guild.roles);
        roles.sort((a: any, b: any) => b.position - a.position);

        return NextResponse.json(roles);
    } catch (error) {
        console.error('Error fetching roles:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
