import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';

type BotSettingsClient = {
    findUnique: (args: { where: { guildId: string } }) => Promise<unknown>;
    upsert: (args: {
        where: { guildId: string };
        update: Record<string, unknown>;
        create: Record<string, unknown>;
    }) => Promise<unknown>;
};

async function verifySession() {
    const session = (await cookies()).get('session');
    return session?.value ? true : false;
}

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

const getBotSettingsClient = () =>
    (prisma as unknown as { botSettings?: BotSettingsClient }).botSettings;

const isMissingTableError = (error: unknown) => {
    const err = error as { code?: string; message?: string };
    if (err?.code === 'P2021') return true;
    const message = err?.message || '';
    return message.includes('no such table') || message.includes('does not exist');
};

export async function GET(_request: Request, { params }: { params: Promise<{ guildId: string }> }) {
    if (!(await verifySession())) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { guildId } = await params;

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

export async function POST(request: Request, { params }: { params: Promise<{ guildId: string }> }) {
    if (!(await verifySession())) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const botSettingsClient = getBotSettingsClient();
    if (!botSettingsClient) {
        return NextResponse.json(
            { error: 'BotSettings model is unavailable. Run `npx prisma generate`.' },
            { status: 500 }
        );
    }

    const { guildId } = await params;
    const body = await request.json();

    const prefixInput = typeof body.prefix === 'string' ? body.prefix.trim() : '';
    const prefix = prefixInput.length > 0 ? prefixInput.slice(0, 5) : null;
    const prefixCommandsEnabled = body.prefixCommandsEnabled === false ? false : true;

    if (prefix) {
        await prisma.guild.upsert({
            where: { id: guildId },
            update: { prefix },
            create: { id: guildId, prefix }
        });
    }

    try {
        const config = await botSettingsClient.upsert({
            where: { guildId },
            update: {
                prefixCommandsEnabled,
                commandChannelMode: normalizeChannelMode(body.commandChannelMode),
                allowedTextChannels: JSON.stringify(normalizeStringArray(body.allowedTextChannels)),
                adminRoles: JSON.stringify(normalizeStringArray(body.adminRoles)),
                restoreRolesOnRejoin: Boolean(body.restoreRolesOnRejoin),
                restoreNicknameOnRejoin: Boolean(body.restoreNicknameOnRejoin)
            },
            create: {
                guildId,
                prefixCommandsEnabled,
                commandChannelMode: normalizeChannelMode(body.commandChannelMode),
                allowedTextChannels: JSON.stringify(normalizeStringArray(body.allowedTextChannels)),
                adminRoles: JSON.stringify(normalizeStringArray(body.adminRoles)),
                restoreRolesOnRejoin: Boolean(body.restoreRolesOnRejoin),
                restoreNicknameOnRejoin: Boolean(body.restoreNicknameOnRejoin)
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
