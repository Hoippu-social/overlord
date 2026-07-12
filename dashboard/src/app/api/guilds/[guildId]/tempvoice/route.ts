import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import dotenv from 'dotenv';
import path from 'path';
import { authorizeGuildApiRequest, isGuildApiAuthFailure } from '@/lib/guildApiAuth';

const DISCORD_API = 'https://discord.com/api/v10';

const parseChannels = (channelsJson?: string | null) => {
    let channels: any[] = [];
    try {
        const parsed = channelsJson ? JSON.parse(channelsJson) : [];
        if (Array.isArray(parsed)) channels = parsed;
    } catch {
        channels = [];
    }

    // Helper to map category positions
    const categoryMap = new Map<string, number>();
    channels
        .filter((c: any) => c.type === 4 || c.type === 'category')
        .forEach((c: any) => categoryMap.set(c.id, typeof c.position === 'number' ? c.position : 0));

    const sortWithCategory = (a: any, b: any) => {
        const catPosA = a.parentId ? (categoryMap.get(a.parentId) ?? -1) : -1;
        const catPosB = b.parentId ? (categoryMap.get(b.parentId) ?? -1) : -1;

        if (catPosA !== catPosB) return catPosA - catPosB;

        const posA = typeof a.position === 'number' ? a.position : 0;
        const posB = typeof b.position === 'number' ? b.position : 0;
        return posA - posB;
    };

    const sortSimple = (a: any, b: any) => {
        const posA = typeof a.position === 'number' ? a.position : 0;
        const posB = typeof b.position === 'number' ? b.position : 0;
        return posA - posB;
    };

    const categories = channels
        .filter((c) => c.type === 4 || c.type === 'category')
        .sort(sortSimple);

    // Sort voice/text by category position then own position
    const voice = channels
        .filter((c) => c.type === 2 || c.type === 'voice')
        .sort(sortWithCategory);

    const text = channels
        .filter((c) => c.type === 0 || c.type === 'text')
        .sort(sortWithCategory);

    return { categories, voice, text };
};

function getToken() {
    if (process.env.DISCORD_TOKEN) return process.env.DISCORD_TOKEN;

    // Try multiple paths for .env
    const paths = [
        path.resolve(process.cwd(), '.env'),
        path.resolve(process.cwd(), '../bot/.env'),
        path.resolve('d:/discord_bot/Dev/bot/.env') // Fallback absolute path
    ];

    for (const p of paths) {
        try {
            if (require('fs').existsSync(p)) {
                dotenv.config({ path: p, override: true });
                if (process.env.DISCORD_TOKEN) return process.env.DISCORD_TOKEN;
            }
        } catch {
            // Best-effort: this candidate .env path is unreadable, try the next one.
        }
    }

    throw new Error('DISCORD_TOKEN is not configured on dashboard');
}

async function discordRequest(method: string, path: string, token: string, body?: any, reason?: string) {
    const headers: any = { Authorization: `Bot ${token}` };
    if (body) headers['Content-Type'] = 'application/json';
    if (reason) headers['X-Audit-Log-Reason'] = encodeURIComponent(reason);

    const res = await fetch(`${DISCORD_API}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
    });

    if (res.status === 204) return null;
    if (!res.ok && res.status !== 404) {
        const text = await res.text();
        throw new Error(`Discord API ${res.status}: ${text}`);
    }
    try {
        return await res.json();
    } catch {
        return null;
    }
}

async function fetchDiscordChannel(token: string, channelId: string) {
    const channel = await discordRequest('GET', `/channels/${channelId}`, token);
    return channel && typeof channel === 'object' ? channel as { guild_id?: string; type?: number } : null;
}

async function assertGuildChannel(token: string, guildId: string, channelId: string, allowedTypes: number[], label: string) {
    const channel = await fetchDiscordChannel(token, channelId);
    if (!channel || channel.guild_id !== guildId || !allowedTypes.includes(Number(channel.type))) {
        throw new Error(`${label} must belong to the selected guild`);
    }
}

async function sendTempVoicePanel(token: string, interfaceChannelId: string, hubChannelId: string) {
    const hubMention = `<#${hubChannelId}>`;

    const embed = {
        title: 'Управление приватными комнатами',
        description: [
            `Зайдите в голосовой канал 🔊 ${hubMention}, чтобы получить личную комнату.`,
            'Используйте кнопки ниже для управления своей комнатой:',
            '',
            '👑 — назначить нового создателя',
            '👥 — выдать доступ в комнату',
            '🚫 — ограничить доступ в комнату',
            '🔢 — задать лимит участников',
            '🔒 — закрыть/открыть комнату',
            '📝 — изменить название комнаты',
            '👁️ — скрыть/показать комнату',
            '🚪 — выгнать участника из комнаты',
            '🎤 — ограничить/выдать право говорить',
        ].join('\n'),
        color: 0x9b8cff,
    };

    const row1 = {
        type: 1,
        components: [
            { type: 2, style: 2, custom_id: 'tv_claim', emoji: { name: '👑' } },
            { type: 2, style: 2, custom_id: 'tv_permit', emoji: { name: '👥' } },
            { type: 2, style: 2, custom_id: 'tv_block', emoji: { name: '🚫' } },
            { type: 2, style: 2, custom_id: 'tv_limit', emoji: { name: '🔢' } },
            { type: 2, style: 2, custom_id: 'tv_lock', emoji: { name: '🔒' } },
        ],
    };

    const row2 = {
        type: 1,
        components: [
            { type: 2, style: 2, custom_id: 'tv_rename', emoji: { name: '📝' } },
            { type: 2, style: 2, custom_id: 'tv_hide', emoji: { name: '👁️' } },
            { type: 2, style: 2, custom_id: 'tv_kick', emoji: { name: '🚪' } },
            { type: 2, style: 2, custom_id: 'tv_speak', emoji: { name: '🎤' } },
        ],
    };

    await discordRequest('POST', `/channels/${interfaceChannelId}/messages`, token, {
        embeds: [embed],
        components: [row1, row2],
        allowed_mentions: { parse: [] },
    }, 'Temp voice panel from dashboard');
}

async function deleteChannel(token: string, channelId: string, reason: string) {
    try {
        await discordRequest('DELETE', `/channels/${channelId}`, token, undefined, reason);
    } catch {
        // ignore errors during cleanup
    }
}

async function deleteRooms(token: string, guildId: string) {
    const rooms = await prisma.tempVoiceRoom.findMany({ where: { guildId } });
    for (const room of rooms) {
        await deleteChannel(token, room.channelId, 'Temp voice cleanup');
    }
    await prisma.tempVoiceRoom.deleteMany({ where: { guildId } });
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ guildId: string }> }) {
    try {
        const { guildId } = await params;
        const auth = await authorizeGuildApiRequest(request, guildId);
        if (isGuildApiAuthFailure(auth)) {
            return auth.response;
        }

        const config = await prisma.tempVoiceConfig.findUnique({ where: { guildId } });
        const roomsCount = await prisma.tempVoiceRoom.count({ where: { guildId } });
        const guild = await prisma.guild.findUnique({ where: { id: guildId } });
        const channels = parseChannels(guild?.channels);

        return NextResponse.json({ config, roomsCount, channels });
    } catch (error: any) {
        if (error instanceof Response) return error;
        return NextResponse.json({ error: error?.message || 'Failed to load temp voice config' }, { status: 500 });
    }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ guildId: string }> }) {
    try {
        const { guildId } = await params;
        const auth = await authorizeGuildApiRequest(request, guildId, { live: true });
        if (isGuildApiAuthFailure(auth)) {
            return auth.response;
        }
        const body = await request.json();
        const mode: 'create' | 'existing' = body.mode === 'existing' ? 'existing' : 'create';
        const nameTemplate: string = (body.nameTemplate || 'Room {user}').trim();
        const userLimit: number | null = body.userLimit === null || body.userLimit === undefined
            ? null
            : Math.max(0, Math.min(99, parseInt(body.userLimit, 10) || 0));

        if (mode === 'existing') {
            if (!body.categoryId || !body.hubChannelId || !body.interfaceChannelId) {
                return NextResponse.json({ error: 'Укажите категорию, хаб и текстовый канал' }, { status: 400 });
            }

            const botToken = getToken();
            await assertGuildChannel(botToken, guildId, body.categoryId, [4], 'Category channel');
            await assertGuildChannel(botToken, guildId, body.hubChannelId, [2], 'Hub voice channel');
            await assertGuildChannel(botToken, guildId, body.interfaceChannelId, [0, 5], 'Interface text channel');

            const previous = await prisma.tempVoiceConfig.findUnique({ where: { guildId } });

            const config = await prisma.tempVoiceConfig.upsert({
                where: { guildId },
                update: {
                    categoryId: body.categoryId,
                    hubChannelId: body.hubChannelId,
                    interfaceChannelId: body.interfaceChannelId,
                    nameTemplate,
                    userLimit,
                },
                create: {
                    guildId,
                    categoryId: body.categoryId,
                    hubChannelId: body.hubChannelId,
                    interfaceChannelId: body.interfaceChannelId,
                    nameTemplate,
                    userLimit,
                },
            });

            if (body.sendPanel || !previous || previous.interfaceChannelId !== body.interfaceChannelId) {
                await sendTempVoicePanel(botToken, body.interfaceChannelId, body.hubChannelId);
            }

            return NextResponse.json({ config });
        }

        const botToken = getToken();

        // Clean old setup
        const existing = await prisma.tempVoiceConfig.findUnique({ where: { guildId } });
        if (existing) {
            if (existing.hubChannelId) await deleteChannel(botToken, existing.hubChannelId, 'Replacing temp voice hub');
            if (existing.interfaceChannelId) await deleteChannel(botToken, existing.interfaceChannelId, 'Replacing temp voice interface');
            if (existing.categoryId) await deleteChannel(botToken, existing.categoryId, 'Replacing temp voice category');
            await deleteRooms(botToken, guildId);
        }

        const categoryName: string = (body.categoryName || 'Temporary Voice').trim();
        const hubName: string = (body.hubName || 'Join to Create').trim();
        const interfaceName: string = (body.interfaceName || 'temp-voice-control').trim();

        const category: any = await discordRequest('POST', `/guilds/${guildId}/channels`, botToken, {
            name: categoryName,
            type: 4,
        }, 'Temp voice category from dashboard');

        const hub: any = await discordRequest('POST', `/guilds/${guildId}/channels`, botToken, {
            name: hubName,
            type: 2,
            parent_id: category.id,
            user_limit: userLimit || 0,
        }, 'Temp voice hub from dashboard');

        const iface: any = await discordRequest('POST', `/guilds/${guildId}/channels`, botToken, {
            name: interfaceName,
            type: 0,
            parent_id: category.id,
        }, 'Temp voice interface from dashboard');

        await sendTempVoicePanel(botToken, iface.id, hub.id);

        const config = await prisma.tempVoiceConfig.upsert({
            where: { guildId },
            update: {
                categoryId: category.id,
                hubChannelId: hub.id,
                interfaceChannelId: iface.id,
                nameTemplate,
                userLimit,
            },
            create: {
                guildId,
                categoryId: category.id,
                hubChannelId: hub.id,
                interfaceChannelId: iface.id,
                nameTemplate,
                userLimit,
            },
        });

        return NextResponse.json({ config });
    } catch (error: any) {
        if (error instanceof Response) return error;
        return NextResponse.json({ error: error?.message || 'Failed to save temp voice config' }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ guildId: string }> }) {
    try {
        const { guildId } = await params;
        const auth = await authorizeGuildApiRequest(request, guildId, { live: true });
        if (isGuildApiAuthFailure(auth)) {
            return auth.response;
        }
        const body = await request.json().catch(() => ({}));
        if (!body.confirm) {
            return NextResponse.json({ error: 'Нужно подтверждение удаления' }, { status: 400 });
        }

        const botToken = getToken();
        const config = await prisma.tempVoiceConfig.findUnique({ where: { guildId } });

        await deleteRooms(botToken, guildId);

        if (config?.hubChannelId) await deleteChannel(botToken, config.hubChannelId, 'Temp voice removal');
        if (config?.interfaceChannelId) await deleteChannel(botToken, config.interfaceChannelId, 'Temp voice removal');
        if (config?.categoryId) await deleteChannel(botToken, config.categoryId, 'Temp voice removal');

        await prisma.tempVoiceConfig.deleteMany({ where: { guildId } });
        await prisma.tempVoiceRoom.deleteMany({ where: { guildId } });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        if (error instanceof Response) return error;
        return NextResponse.json({ error: error?.message || 'Failed to delete temp voice setup' }, { status: 500 });
    }
}
