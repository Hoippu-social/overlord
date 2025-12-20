import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthToken } from '@/lib/auth';
import { canAccessGuild } from '@/lib/discordAccess';

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

        // Create a map of categories for sorting
        // Type 4 is GuildCategory
        const categories = channels.filter((c: any) => c.type === 4 || c.type === 'category');
        const categoryMap = new Map();
        categories.forEach((c: any) => categoryMap.set(c.id, parseInt(c.position) || 0));

        // Filter only voice channels (Type 2 is GuildVoice)
        const voiceChannels = channels.filter((c: any) => c.type === 'voice' || c.type === 2);

        // Sort by Category Position then Channel Position
        voiceChannels.sort((a: any, b: any) => {
            // Get category positions (default to -1 for channels without category, putting them at top)
            // Or check Discord behavior: channels without category usually at top
            const catPosA = a.parentId ? (categoryMap.get(a.parentId) ?? -1) : -1;
            const catPosB = b.parentId ? (categoryMap.get(b.parentId) ?? -1) : -1;

            // Compare categories first
            if (catPosA !== catPosB) {
                return catPosA - catPosB;
            }

            // Compare channel positions within the same category (or no category)
            return (parseInt(a.position) || 0) - (parseInt(b.position) || 0);
        });

        return NextResponse.json(voiceChannels);
    } catch (error) {
        console.error('Error fetching channels:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
