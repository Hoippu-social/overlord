import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthToken } from '@/lib/auth';
import { canAccessGuild } from '@/lib/discordAccess';

type GuildChannel = {
    id: string;
    parentId?: string | null;
    type?: string | number | null;
    position?: number | string | null;
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
            select: { channels: true }
        });

        if (!guild?.channels) {
            return NextResponse.json([]);
        }

        let channels: GuildChannel[] = [];
        try {
            const parsed = JSON.parse(guild.channels);
            if (Array.isArray(parsed)) {
                channels = parsed as GuildChannel[];
            }
        } catch (error) {
            console.error('Failed to parse channels JSON:', error);
            return NextResponse.json({ error: 'Invalid channels payload' }, { status: 500 });
        }

        // Create a map of categories for sorting
        // Type 4 is GuildCategory
        const categories = channels.filter((c) => c.type === 4 || c.type === 'category');
        const categoryMap = new Map<string, number>();
        categories.forEach((c) => categoryMap.set(c.id, Number.parseInt(String(c.position ?? 0), 10) || 0));

        // Filter voice-like channels that can still have associated chat
        const voiceChannels = channels.filter((c) =>
            c.type === 'voice' ||
            c.type === 'stage_voice' ||
            c.type === 'cast' ||
            c.type === 2 ||
            c.type === 13
        );

        // Sort by Category Position then Channel Position
        voiceChannels.sort((a, b) => {
            // Get category positions (default to -1 for channels without category, putting them at top)
            // Or check Discord behavior: channels without category usually at top
            const catPosA = a.parentId ? (categoryMap.get(a.parentId) ?? -1) : -1;
            const catPosB = b.parentId ? (categoryMap.get(b.parentId) ?? -1) : -1;

            // Compare categories first
            if (catPosA !== catPosB) {
                return catPosA - catPosB;
            }

            // Compare channel positions within the same category (or no category)
            return (Number.parseInt(String(a.position ?? 0), 10) || 0) - (Number.parseInt(String(b.position ?? 0), 10) || 0);
        });

        return NextResponse.json(voiceChannels);
    } catch (error) {
        console.error('Error fetching channels:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
