import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthToken } from '@/lib/auth';
import { canAccessGuild } from '@/lib/discordAccess';
import { parseChannels } from '@/lib/discord-api';

type RawChannel = {
    id: string | number;
    name?: string | null;
    parentId?: string | number | null;
    type?: string | number | null;
    position?: number | null;
};

type ParsedChannels = {
    categories: RawChannel[];
    text: RawChannel[];
    voice: RawChannel[];
};

const enrichChannels = (channels: ParsedChannels) => {
    const categories = channels.categories.map((channel) => ({
        ...channel,
        id: String(channel.id),
        name: channel.name || String(channel.id),
        parentId: null,
        isCategory: true,
        categoryName: null,
    }));

    const categoryNames = new Map(categories.map((channel) => [channel.id, channel.name]));

    const enrichList = (items: RawChannel[]) =>
        items.map((channel) => ({
            ...channel,
            id: String(channel.id),
            name: channel.name || String(channel.id),
            parentId: channel.parentId ? String(channel.parentId) : null,
            isCategory: false,
            categoryName: channel.parentId ? (categoryNames.get(String(channel.parentId)) ?? null) : null,
        }));

    return {
        categories,
        text: enrichList(channels.text),
        voice: enrichList(channels.voice),
    };
};

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ guildId: string }> },
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

        const guild = await prisma.guild.findUnique({
            where: { id: guildId },
            select: { channels: true },
        });

        if (!guild?.channels) {
            return NextResponse.json({ categories: [], text: [], voice: [] });
        }

        let parsedChannels: RawChannel[] = [];
        try {
            const raw = JSON.parse(guild.channels);
            if (Array.isArray(raw)) {
                parsedChannels = raw;
            }
        } catch (error) {
            console.error('Failed to parse channel tree JSON:', error);
            return NextResponse.json({ error: 'Invalid channels payload' }, { status: 500 });
        }

        return NextResponse.json(enrichChannels(parseChannels(parsedChannels)));
    } catch (error) {
        console.error('Error fetching channel tree:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
