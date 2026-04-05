import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { syncGuildCommandVisibility } from '@/lib/discordCommandPermissions';
import { authorizeGuildApiRequest, isGuildApiAuthFailure } from '@/lib/guildApiAuth';
import { upsertTimezoneRebuildState } from '@/lib/statsControl';

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

const normalizeTimezone = (value: unknown): string | null => {
    if (typeof value !== 'string') return null;
    try {
        Intl.DateTimeFormat(undefined, { timeZone: value });
        return value;
    } catch {
        return null;
    }
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
    const { guildId } = await params;
    const auth = await authorizeGuildApiRequest(request, guildId);
    if (isGuildApiAuthFailure(auth)) {
        return auth.response;
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
    const { guildId } = await params;
    const auth = await authorizeGuildApiRequest(request, guildId, { live: true });
    if (isGuildApiAuthFailure(auth)) {
        return auth.response;
    }
    const { accessToken } = auth;

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
    const commandChannelMode = normalizeChannelMode(body.commandChannelMode);
    const allowedTextChannels = normalizeStringArray(body.allowedTextChannels);
    const locale = normalizeLocale(body.locale);
    const timezone = normalizeTimezone(body.timezone);
    const shouldSyncCommandVisibility = body.syncDiscordCommandPermissions === true;
    const payloadGuildChannels = Array.isArray(body.guildChannels) ? JSON.stringify(body.guildChannels) : null;

    const [guild, moderationConfig] = shouldSyncCommandVisibility
        ? await Promise.all([
            prisma.guild.findUnique({
                where: { id: guildId },
                select: { channels: true },
            }),
            prisma.moderationConfig.findUnique({
                where: { guildId },
                select: { commandRules: true },
            }),
        ])
        : [null, null];
    let syncWarning: string | null = null;

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
            commandChannelMode,
            allowedTextChannels: JSON.stringify(allowedTextChannels),
            adminRoles: JSON.stringify(normalizeStringArray(body.adminRoles)),
            restoreRolesOnRejoin: Boolean(body.restoreRolesOnRejoin),
            restoreNicknameOnRejoin: Boolean(body.restoreNicknameOnRejoin)
        };

        if (locale) {
            updatePayload.locale = locale;
        }
        if (timezone) {
            updatePayload.timezone = timezone;
        }

        const config = await botSettingsClient.upsert({
            where: { guildId },
            update: updatePayload,
            create: {
                guildId,
                prefixCommandsEnabled,
                commandChannelMode,
                allowedTextChannels: JSON.stringify(allowedTextChannels),
                adminRoles: JSON.stringify(normalizeStringArray(body.adminRoles)),
                restoreRolesOnRejoin: Boolean(body.restoreRolesOnRejoin),
                restoreNicknameOnRejoin: Boolean(body.restoreNicknameOnRejoin),
                locale: locale ?? 'ru',
                timezone: timezone ?? 'UTC',
            }
        });

        if (shouldSyncCommandVisibility && accessToken === 'admin') {
            syncWarning = 'discord_oauth_required';
        } else if (shouldSyncCommandVisibility) {
            await syncGuildCommandVisibility({
                guildId,
                accessToken,
                mode: commandChannelMode,
                selectedChannelIds: allowedTextChannels,
                commandRules: (() => {
                    try {
                        const parsed = moderationConfig?.commandRules ? JSON.parse(moderationConfig.commandRules) : [];
                        return Array.isArray(parsed) ? parsed : [];
                    } catch {
                        return [];
                    }
                })(),
                guildChannelsJson: payloadGuildChannels ?? guild?.channels ?? null,
            });
        }

        if (timezone) {
            await upsertTimezoneRebuildState(guildId, timezone);
        }

        return NextResponse.json({ config, syncWarning });
    } catch (error) {
        if (isMissingTableError(error)) {
            return NextResponse.json(
                { error: 'BotSettings table is missing. Run `npx prisma db push`.' },
                { status: 503 }
            );
        }

        console.error('Failed to save bot settings:', error);
        const message = error instanceof Error && error.message ? error.message : 'Failed to save bot settings.';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
