import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';

const isTextChannel = (channel: any) =>
    channel?.type === 0 || channel?.type === 'text' || channel?.type === 'GUILD_TEXT';

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ guildId: string }> }
) {
    const session = (await cookies()).get('session');
    if (!session?.value) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { guildId } = await params;

        const guild = await prisma.guild.findUnique({
            where: { id: guildId },
            select: { channels: true }
        });

        if (!guild?.channels) {
            return NextResponse.json([]);
        }

        let channels: any[] = [];
        try {
            const parsed = JSON.parse(guild.channels);
            if (Array.isArray(parsed)) {
                channels = parsed;
            }
        } catch (error) {
            console.error('Failed to parse channels JSON:', error);
            return NextResponse.json({ error: 'Invalid channels payload' }, { status: 500 });
        }

        const categories = channels.filter((c: any) => c.type === 4 || c.type === 'category');
        const categoryMap = new Map();
        categories.forEach((c: any) => categoryMap.set(c.id, parseInt(c.position) || 0));

        const textChannels = channels.filter(isTextChannel);

        textChannels.sort((a: any, b: any) => {
            const catPosA = a.parentId ? (categoryMap.get(a.parentId) ?? -1) : -1;
            const catPosB = b.parentId ? (categoryMap.get(b.parentId) ?? -1) : -1;

            if (catPosA !== catPosB) {
                return catPosA - catPosB;
            }

            return (parseInt(a.position) || 0) - (parseInt(b.position) || 0);
        });

        return NextResponse.json(textChannels);
    } catch (error) {
        console.error('Error fetching text channels:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
