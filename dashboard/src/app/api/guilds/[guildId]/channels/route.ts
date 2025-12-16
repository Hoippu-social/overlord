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
            select: { channels: true }
        });

        if (!guild || !guild.channels) {
            // Mock data if no channels in DB
            const mockChannels = [
                { id: '1', name: 'General', type: 'voice', position: 0 },
                { id: '2', name: 'Music', type: 'voice', position: 1 },
                { id: '3', name: 'Gaming', type: 'voice', position: 2 },
                { id: '4', name: 'AFK', type: 'voice', position: 3 },
                { id: '5', name: 'Private', type: 'voice', position: 4 },
            ];
            return NextResponse.json(mockChannels);
        }

        let channels = JSON.parse(guild.channels);

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
