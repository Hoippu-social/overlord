import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthToken } from '@/lib/auth';
import { canAccessGuild } from '@/lib/discordAccess';

type BotSettingsClient = {
    findUnique: (args: { where: { guildId: string } }) => Promise<unknown>;
    upsert: (args: {
        where: { guildId: string };
        update: Record<string, unknown>;
        create: Record<string, unknown>;
    }) => Promise<unknown>;
};

const normalizeChannelMode = (mode: unknown) => {
    if (typeof mode !== 'string') return 'blacklist';
    const lowered = mode.toLowerCase();
    return lowered === 'whitelist' ? 'whitelist' : 'blacklist';
};

const normalizeStringArray = (value: unknown) => {
    if (Array.isArray(value)) {
        return value.filter((item) => typeof item === 'string');
    }
    return [];
};

const normalizeLocale = (value: unknown) => {
    if (value === 'en' || value === 'ru') return value;
    return null;
};

const getBotSettingsClient = () =>
    (prisma as unknown as { botSettings?: BotSettingsClient }).botSettings;

const isMissingTableError = (error: unknown) => {
    const err = error as { code?: string; message?: string };
    if (err?.code === 'P2021') return true;
    const message = err?.message || '';
    return message.includes('no such table') || message.includes('does not exist');
};

export async function GET(request: NextRequest, { params }: { params: Promise<{ guildId: string }> }) {
    const token = await getAuthToken(request);
    const accessToken = typeof token?.accessToken === 'string' ? token.accessToken : null;
    if (!accessToken) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { guildId } = await params;
    const allowedGuilds = Array.isArray(token?.allowedGuilds) ? token.allowedGuilds : null;
    const hasAccess = allowedGuilds ? allowedGuilds.includes(guildId) : await canAccessGuild(accessToken, guildId);
    if (!hasAccess) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const guild = await prisma.guild.findUnique({
        where: { id: guildId },
        select: { prefix: true }
    });

    const botSettingsClient = getBotSettingsClient();
    if (!botSettingsClient) {
        return NextResponse.json({
            guild,
            config: null,
            warning: 'BotSettings model is unavailable. Run `npx prisma generate`.'
        });
    }

    let config = null;
    let warning: string | null = null;

    try {
        config = await botSettingsClient.findUnique({
            where: { guildId }
        });
    } catch (error) {
        if (isMissingTableError(error)) {
            warning = 'BotSettings table is missing. Run `npx prisma db push`.';
        } else {
            console.error('Failed to load bot settings:', error);
            return NextResponse.json({ error: 'Failed to load bot settings.' }, { status: 500 });
        }
    }

    return NextResponse.json({ guild, config, warning });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ guildId: string }> }) {
    const token = await getAuthToken(request);
    const accessToken = typeof token?.accessToken === 'string' ? token.accessToken : null;
    if (!accessToken) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { guildId } = await params;
    const allowedGuilds = Array.isArray(token?.allowedGuilds) ? token.allowedGuilds : null;
    const hasAccess = allowedGuilds ? allowedGuilds.includes(guildId) : await canAccessGuild(accessToken, guildId);
    if (!hasAccess) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const botSettingsClient = getBotSettingsClient();
    if (!botSettingsClient) {
        return NextResponse.json(
            { error: 'BotSettings model is unavailable. Run `npx prisma generate`.' },
            { status: 500 }
        );
    }

    const body = await request.json();

    const prefixInput = typeof body.prefix === 'string' ? body.prefix.trim() : '';
    const prefix = prefixInput.length > 0 ? prefixInput.slice(0, 5) : null;
    const prefixCommandsEnabled = body.prefixCommandsEnabled === false ? false : true;
    const locale = normalizeLocale(body.locale);

    if (prefix) {
        await prisma.guild.upsert({
            where: { id: guildId },
            update: { prefix },
            create: { id: guildId, prefix }
        });
    }

    try {
        const updatePayload: Record<string, unknown> = {
            prefixCommandsEnabled,
            commandChannelMode: normalizeChannelMode(body.commandChannelMode),
            allowedTextChannels: JSON.stringify(normalizeStringArray(body.allowedTextChannels)),
            adminRoles: JSON.stringify(normalizeStringArray(body.adminRoles)),
            restoreRolesOnRejoin: Boolean(body.restoreRolesOnRejoin),
            restoreNicknameOnRejoin: Boolean(body.restoreNicknameOnRejoin)
        };

        if (locale) {
            updatePayload.locale = locale;
        }

        const config = await botSettingsClient.upsert({
            where: { guildId },
            update: updatePayload,
            create: {
                guildId,
                prefixCommandsEnabled,
                commandChannelMode: normalizeChannelMode(body.commandChannelMode),
                allowedTextChannels: JSON.stringify(normalizeStringArray(body.allowedTextChannels)),
                adminRoles: JSON.stringify(normalizeStringArray(body.adminRoles)),
                restoreRolesOnRejoin: Boolean(body.restoreRolesOnRejoin),
                restoreNicknameOnRejoin: Boolean(body.restoreNicknameOnRejoin),
                locale: locale ?? 'ru',
            }
        });

        return NextResponse.json(config);
    } catch (error) {
        if (isMissingTableError(error)) {
            return NextResponse.json(
                { error: 'BotSettings table is missing. Run `npx prisma db push`.' },
                { status: 503 }
            );
        }

        console.error('Failed to save bot settings:', error);
        return NextResponse.json({ error: 'Failed to save bot settings.' }, { status: 500 });
    }
}
