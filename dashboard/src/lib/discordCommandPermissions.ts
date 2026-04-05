import { COMMAND_CATALOG } from '@/lib/commandCatalog';
import { getBotToken } from '@/lib/discord-api';

const DISCORD_API = 'https://discord.com/api/v10';
const CATEGORY_CHANNEL_TYPES = new Set([4, 'category', 'GUILD_CATEGORY']);
const MAX_COMMAND_PERMISSIONS = 100;
const DISCORD_CHAT_INPUT_COMMAND = 1;

type GuildChannelRecord = {
    id?: string | number | null;
    type?: string | number | null;
    parentId?: string | number | null;
};

type CommandChannelRule = {
    commandKey: string;
    enabled?: boolean;
    channelMode?: 'WHITELIST' | 'BLACKLIST' | string | null;
    channelIds?: string[] | null;
};

type SyncGuildCommandVisibilityOptions = {
    guildId: string;
    accessToken: string;
    mode: 'whitelist' | 'blacklist';
    selectedChannelIds: string[];
    commandRules?: CommandChannelRule[];
    guildChannelsJson?: string | null;
};

type DiscordApplicationCommand = {
    id: string;
    name: string;
    type?: number;
};

function parseGuildChannels(value: string | null | undefined): GuildChannelRecord[] {
    if (!value) {
        return [];
    }

    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function normalizeChannelMode(value: string | null | undefined, fallback: 'whitelist' | 'blacklist') {
    if (typeof value !== 'string') {
        return fallback;
    }

    return value.toLowerCase() === 'whitelist' ? 'whitelist' : 'blacklist';
}

function getLeafGuildChannelIds(guildChannels: GuildChannelRecord[]) {
    return guildChannels
        .filter((channel) => channel.id && !CATEGORY_CHANNEL_TYPES.has(channel.type ?? ''))
        .map((channel) => String(channel.id));
}

function resolveEffectiveChannelIds(selectedChannelIds: string[], guildChannels: GuildChannelRecord[]) {
    const selectedSet = new Set(selectedChannelIds);
    const categoryIds = new Set(
        guildChannels
            .filter((channel) => CATEGORY_CHANNEL_TYPES.has(channel.type ?? ''))
            .map((channel) => String(channel.id ?? ''))
            .filter((channelId) => selectedSet.has(channelId)),
    );

    const effectiveIds = new Set<string>();

    for (const channelId of selectedSet) {
        const channel = guildChannels.find((entry) => String(entry.id ?? '') === channelId);
        if (!channel || !CATEGORY_CHANNEL_TYPES.has(channel.type ?? '')) {
            effectiveIds.add(channelId);
        }
    }

    for (const channel of guildChannels) {
        const channelId = String(channel.id ?? '');
        const parentId = channel.parentId ? String(channel.parentId) : null;
        if (parentId && categoryIds.has(parentId) && !CATEGORY_CHANNEL_TYPES.has(channel.type ?? '')) {
            effectiveIds.add(channelId);
        }
    }

    return Array.from(effectiveIds);
}

function buildAllowedChannelSet(
    allChannelIds: string[],
    mode: 'whitelist' | 'blacklist',
    selectedChannelIds: string[],
) {
    const universe = new Set(allChannelIds);
    if (selectedChannelIds.length === 0) {
        return universe;
    }

    const selected = new Set(selectedChannelIds.filter((channelId) => universe.has(channelId)));
    if (mode === 'whitelist') {
        return selected;
    }

    const allowed = new Set<string>();
    for (const channelId of universe) {
        if (!selected.has(channelId)) {
            allowed.add(channelId);
        }
    }

    return allowed;
}

function intersectSets(left: Set<string>, right: Set<string>) {
    const intersection = new Set<string>();
    for (const value of left) {
        if (right.has(value)) {
            intersection.add(value);
        }
    }
    return intersection;
}

function getAllChannelsPermissionConstant(guildId: string) {
    return (BigInt(guildId) - BigInt(1)).toString();
}

function buildPermissionsForAllowedChannels(guildId: string, allChannelIds: string[], allowedChannelIds: Set<string>) {
    if (allChannelIds.length === 0 || allowedChannelIds.size === allChannelIds.length) {
        return [];
    }

    const blockedChannelIds = allChannelIds.filter((channelId) => !allowedChannelIds.has(channelId));
    const whitelistPayload = [
        {
            id: getAllChannelsPermissionConstant(guildId),
            type: 3,
            permission: false,
        },
        ...Array.from(allowedChannelIds).map((channelId) => ({
            id: channelId,
            type: 3,
            permission: true,
        })),
    ];
    const blacklistPayload = blockedChannelIds.map((channelId) => ({
        id: channelId,
        type: 3,
        permission: false,
    }));

    return whitelistPayload.length <= blacklistPayload.length ? whitelistPayload : blacklistPayload;
}

function buildCommandRuleMap(commandRules: CommandChannelRule[] | undefined) {
    return new Map((commandRules ?? []).map((rule) => [rule.commandKey, rule]));
}

function getCommandNameCandidates(commandKey: string) {
    const entry = COMMAND_CATALOG.find((command) => command.commandKey === commandKey);
    const candidates = new Set<string>([commandKey]);

    if (entry?.kind !== 'slash' && entry?.label.en) {
        candidates.add(entry.label.en);
    }

    return candidates;
}

function findCommandRuleForRegisteredCommand(
    command: DiscordApplicationCommand,
    ruleMap: Map<string, CommandChannelRule>,
) {
    if (command.type === DISCORD_CHAT_INPUT_COMMAND && ruleMap.has(command.name)) {
        return ruleMap.get(command.name) ?? null;
    }

    for (const [commandKey, rule] of ruleMap.entries()) {
        const candidates = getCommandNameCandidates(commandKey);
        if (candidates.has(command.name)) {
            return rule;
        }
    }

    return null;
}

async function fetchRegisteredCommands(applicationId: string, guildId: string) {
    const botToken = getBotToken();
    const headers = {
        Authorization: `Bot ${botToken}`,
        'Content-Type': 'application/json',
    };

    const [globalResponse, guildResponse] = await Promise.all([
        fetch(`${DISCORD_API}/applications/${applicationId}/commands`, {
            headers,
            cache: 'no-store',
        }),
        fetch(`${DISCORD_API}/applications/${applicationId}/guilds/${guildId}/commands`, {
            headers,
            cache: 'no-store',
        }),
    ]);

    if (!globalResponse.ok) {
        const errorText = await globalResponse.text().catch(() => '');
        throw new Error(errorText || `Failed to fetch global application commands (${globalResponse.status}).`);
    }

    if (!guildResponse.ok) {
        const errorText = await guildResponse.text().catch(() => '');
        throw new Error(errorText || `Failed to fetch guild application commands (${guildResponse.status}).`);
    }

    const [globalCommands, guildCommands] = await Promise.all([
        globalResponse.json() as Promise<DiscordApplicationCommand[]>,
        guildResponse.json() as Promise<DiscordApplicationCommand[]>,
    ]);

    const deduped = new Map<string, DiscordApplicationCommand>();
    for (const command of globalCommands) {
        deduped.set(`${command.type ?? 0}:${command.name}`, command);
    }

    for (const command of guildCommands) {
        deduped.set(`${command.type ?? 0}:${command.name}`, command);
    }

    return Array.from(deduped.values());
}

async function updateCommandPermissions(
    applicationId: string,
    guildId: string,
    commandId: string,
    accessToken: string,
    permissions: Array<{ id: string; type: number; permission: boolean }>,
) {
    const response = await fetch(
        `${DISCORD_API}/applications/${applicationId}/guilds/${guildId}/commands/${commandId}/permissions`,
        {
            method: 'PUT',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ permissions }),
            cache: 'no-store',
        },
    );

    if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        if (response.status === 401 || response.status === 403) {
            throw new Error('Re-login via Discord is required to grant command visibility permissions.');
        }

        throw new Error(errorText || `Discord command permissions request failed (${response.status}).`);
    }
}

export async function syncGuildCommandVisibility({
    guildId,
    accessToken,
    mode,
    selectedChannelIds,
    commandRules,
    guildChannelsJson,
}: SyncGuildCommandVisibilityOptions) {
    if (accessToken === 'admin') {
        throw new Error('Discord OAuth login is required to sync command visibility.');
    }

    const applicationId = process.env.DISCORD_CLIENT_ID || process.env.CLIENT_ID;
    if (!applicationId) {
        throw new Error('DISCORD_CLIENT_ID is not configured.');
    }

    const guildChannels = parseGuildChannels(guildChannelsJson);
    const allChannelIds = getLeafGuildChannelIds(guildChannels);
    const globalSelectedChannelIds = resolveEffectiveChannelIds(selectedChannelIds, guildChannels);
    const globalAllowedChannels = buildAllowedChannelSet(allChannelIds, mode, globalSelectedChannelIds);
    const commandRuleMap = buildCommandRuleMap(commandRules);
    const registeredCommands = await fetchRegisteredCommands(applicationId, guildId);
    const globalPermissions = buildPermissionsForAllowedChannels(guildId, allChannelIds, globalAllowedChannels);

    if (globalPermissions.length > MAX_COMMAND_PERMISSIONS) {
        throw new Error(`Discord allows at most ${MAX_COMMAND_PERMISSIONS} command permission entries per command. Simplify the global channel rules for this guild.`);
    }

    await updateCommandPermissions(applicationId, guildId, applicationId, accessToken, globalPermissions);

    for (const command of registeredCommands) {
        const rule = findCommandRuleForRegisteredCommand(command, commandRuleMap);
        const ruleMode = normalizeChannelMode(rule?.channelMode ?? null, 'blacklist');
        const ruleSelectedChannelIds = resolveEffectiveChannelIds(rule?.channelIds ?? [], guildChannels);
        const commandAllowedChannels = rule?.enabled === false
            ? new Set<string>()
            : buildAllowedChannelSet(allChannelIds, ruleMode, ruleSelectedChannelIds);
        const effectiveAllowedChannels = intersectSets(globalAllowedChannels, commandAllowedChannels);
        const permissions = buildPermissionsForAllowedChannels(guildId, allChannelIds, effectiveAllowedChannels);

        if (permissions.length > MAX_COMMAND_PERMISSIONS) {
            throw new Error(`Discord allows at most ${MAX_COMMAND_PERMISSIONS} command permission entries per command. Simplify the channel rules for /${command.name}.`);
        }

        await updateCommandPermissions(applicationId, guildId, command.id, accessToken, permissions);
    }
}
