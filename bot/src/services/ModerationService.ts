import {
    ChannelType,
    ChatInputCommandInteraction,
    Collection,
    Guild,
    GuildBasedChannel,
    GuildMember,
    Message,
    PermissionFlagsBits,
    PermissionResolvable,
    Snowflake,
    TextBasedChannel,
    User,
} from 'discord.js';
import { prisma } from '../utils/database';
import { getInteractionLocale, t } from '../utils/i18n';

const MAX_CLEAR_FETCH = 1000;

type ModerationTextChannel = TextBasedChannel & {
    messages: {
        fetch: (options?: unknown) => Promise<Collection<Snowflake, Message>>;
    };
    bulkDelete: (
        messages: Collection<Snowflake, Message> | Message[] | readonly Message[],
        filterOld?: boolean
    ) => Promise<Collection<Snowflake, Message>>;
};

type LockableGuildChannel = GuildBasedChannel & {
    permissionOverwrites: {
        edit: (target: Snowflake, permissions: Record<string, boolean | null>, reason?: string) => Promise<unknown>;
    };
};

type SlowmodeChannel = GuildBasedChannel & {
    setRateLimitPerUser: (seconds: number, reason?: string) => Promise<unknown>;
};

export const AI_CATEGORIES = [
    'toxicity',
    'harassment',
    'hate_discrimination',
    'threats_violence',
    'sexual_explicit',
    'scam_fraud',
    'self_harm_crisis',
    'doxxing_personal_data',
] as const;

const AUTOMOD_BUILT_IN_RULES = [
    'flood',
    'zalgo',
    'emoji',
    'repeated_messages',
    'repeated_mentions',
    'lines',
    'links',
    'advertising',
    'emoji_spam',
    'command_channels',
    'image_filter',
] as const;

const LEGACY_AUTOMOD_RULES = new Set([
    'duplicate_messages',
    'repeated_strings',
    'mentions_spam',
    'command_only',
]);

export type AiCategory = typeof AI_CATEGORIES[number];

export function parseJsonArray(value: string | null | undefined): string[] {
    if (!value) return [];
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
    } catch {
        return [];
    }
}

export function stringifyJsonArray(values: Iterable<string>) {
    return JSON.stringify(Array.from(values));
}

export function parseJsonObject<T = Record<string, unknown>>(value: string | null | undefined): T | null {
    if (!value) return null;
    try {
        const parsed = JSON.parse(value);
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as T) : null;
    } catch {
        return null;
    }
}

type CommandRuleMode = 'WHITELIST' | 'BLACKLIST';

type CommandRuleConfig = {
    commandKey: string;
    enabled: boolean;
    roleMode: CommandRuleMode;
    roleIds: string[];
    channelMode: CommandRuleMode;
    channelIds: string[];
    requiredAccessLevel: number | null;
};

export type CommandAccessOptions = {
    accessGroup?: string;
    accessKey?: string;
    requiredAccessLevel?: number;
    requiredDiscordPermissions?: PermissionResolvable | null;
    channelId?: string | null;
    parentChannelId?: string | null;
};

type ModeratorAccessContext = {
    member: GuildMember;
    hasOverrideAccess: boolean;
    adminRoleIds: Set<string>;
    roleIds: Set<string>;
    bindingLevel: number;
    commandRules: CommandRuleConfig[];
    grants: Array<{
        roleId: string;
        scopeType: 'GROUP' | 'COMMAND';
        scopeKey: string;
        effect: 'ALLOW' | 'DENY';
    }>;
};

const DEFAULT_COMMAND_ACCESS_LEVELS: Record<string, number> = {
    appeals: 70,
    ban: 80,
    case: 30,
    cases: 30,
    clear: 50,
    kick: 70,
    lock: 50,
    mute: 50,
    note: 30,
    slowmode: 50,
    timeout: 50,
    unban: 80,
    unlock: 50,
    unmute: 50,
    untimeout: 50,
    unwarn: 70,
    voicekick: 50,
    voicemove: 50,
    warns: 30,
    warn: 50,
};

function getDefaultCommandRule(commandKey: string): CommandRuleConfig | null {
    if (!(commandKey in DEFAULT_COMMAND_ACCESS_LEVELS)) {
        return null;
    }

    return {
        commandKey,
        enabled: true,
        roleMode: 'WHITELIST',
        roleIds: [],
        channelMode: 'WHITELIST',
        channelIds: [],
        requiredAccessLevel: DEFAULT_COMMAND_ACCESS_LEVELS[commandKey],
    };
}

function parseCommandRules(value: string | null | undefined): CommandRuleConfig[] {
    if (!value) return [];

    try {
        const parsed = JSON.parse(value);
        if (!Array.isArray(parsed)) return [];

        return parsed
            .map((rule) => {
                if (!rule || typeof rule !== 'object') {
                    return null;
                }

                const entry = rule as Record<string, unknown>;
                if (typeof entry.commandKey !== 'string' || !entry.commandKey.trim()) {
                    return null;
                }

                return {
                    commandKey: entry.commandKey.trim(),
                    enabled: entry.enabled !== false,
                    roleMode: entry.roleMode === 'WHITELIST' ? 'WHITELIST' : 'BLACKLIST',
                    roleIds: Array.isArray(entry.roleIds) ? entry.roleIds.filter((item): item is string => typeof item === 'string' && Boolean(item)) : [],
                    channelMode: entry.channelMode === 'WHITELIST' ? 'WHITELIST' : 'BLACKLIST',
                    channelIds: Array.isArray(entry.channelIds) ? entry.channelIds.filter((item): item is string => typeof item === 'string' && Boolean(item)) : [],
                    requiredAccessLevel:
                        typeof entry.requiredAccessLevel === 'number' && Number.isFinite(entry.requiredAccessLevel)
                            ? Math.max(0, Math.min(100, Math.round(entry.requiredAccessLevel)))
                            : null,
                };
            })
            .filter((rule): rule is CommandRuleConfig => Boolean(rule));
    } catch {
        return [];
    }
}

function evaluateCommandRule(rule: CommandRuleConfig, context: {
    roleIds: Set<string>;
    bindingLevel: number;
    channelId?: string | null;
    parentChannelId?: string | null;
}) {
    const checks: boolean[] = [];

    if (rule.roleIds.length > 0) {
        const hasMatchingRole = rule.roleIds.some((roleId) => context.roleIds.has(roleId));
        checks.push(rule.roleMode === 'WHITELIST' ? hasMatchingRole : !hasMatchingRole);
    }

    if (rule.channelIds.length > 0) {
        const activeChannelIds = new Set<string>();
        if (context.channelId) activeChannelIds.add(context.channelId);
        if (context.parentChannelId) activeChannelIds.add(context.parentChannelId);

        const hasMatchingChannel = rule.channelIds.some((channelId) => activeChannelIds.has(channelId));
        checks.push(rule.channelMode === 'WHITELIST' ? hasMatchingChannel : !hasMatchingChannel);
    }

    if (rule.requiredAccessLevel !== null) {
        checks.push(context.bindingLevel >= rule.requiredAccessLevel);
    }

    if (!checks.length) {
        return null;
    }

    return checks.every(Boolean);
}

export function isMissingModerationTableError(error: unknown) {
    const err = error as { code?: string; message?: string };
    if (err?.code === 'P2021') return true;
    const message = err?.message || '';
    return message.includes('no such table') || message.includes('does not exist');
}

export async function ensureModerationConfig(guildId: string) {
    const config = await prisma.moderationConfig.upsert({
        where: { guildId },
        update: {},
        create: { guildId },
    });

    const aiConfig = await prisma.aiModerationConfig.upsert({
        where: { guildId },
        update: {},
        create: { guildId },
    });

    for (const [index, category] of AI_CATEGORIES.entries()) {
        await prisma.aiModerationCategoryRule.upsert({
            where: { guildId_category: { guildId, category } },
            update: {},
            create: {
                guildId,
                category,
                enabled: ['hate_discrimination', 'threats_violence', 'scam_fraud', 'doxxing_personal_data'].includes(category),
                threshold: 80,
                sortOrder: index,
            },
        });
    }

    const existingRuleConfigs = await prisma.automodRuleConfig.findMany({
        where: { guildId },
        select: { ruleKey: true },
    });

    const hasLegacyBuiltIns = existingRuleConfigs.some((rule) => LEGACY_AUTOMOD_RULES.has(rule.ruleKey));
    if (hasLegacyBuiltIns) {
        await prisma.automodRuleConfig.deleteMany({ where: { guildId } });
    }

    for (const ruleKey of AUTOMOD_BUILT_IN_RULES) {
        await prisma.automodRuleConfig.upsert({
            where: { guildId_ruleKey: { guildId, ruleKey } },
            update: {},
            create: {
                guildId,
                ruleKey,
                enabled: false,
            },
        });
    }

    return { config, aiConfig };
}

async function getNextCaseNumber(guildId: string) {
    const lastCase = await prisma.moderationCase.findFirst({
        where: { guildId },
        orderBy: { caseNumber: 'desc' },
        select: { caseNumber: true },
    });

    return (lastCase?.caseNumber || 0) + 1;
}

export async function createModerationCase(input: {
    guildId: string;
    actionType: string;
    source: string;
    actorUserId?: string | null;
    targetUserId: string;
    reason?: string | null;
    status?: string;
    expiresAt?: Date | null;
    relatedCaseId?: number | null;
    metadata?: Record<string, unknown> | null;
}) {
    const caseNumber = await getNextCaseNumber(input.guildId);

    return prisma.moderationCase.create({
        data: {
            guildId: input.guildId,
            caseNumber,
            actionType: input.actionType,
            source: input.source,
            actorUserId: input.actorUserId ?? null,
            targetUserId: input.targetUserId,
            reason: input.reason ?? null,
            status: input.status ?? 'ACTIVE',
            expiresAt: input.expiresAt ?? null,
            relatedCaseId: input.relatedCaseId ?? null,
            metadata: input.metadata ? JSON.stringify(input.metadata) : null,
        },
    });
}

type ModerationResolutionType = 'manual' | 'expired' | 'appeal_review' | 'pardon';

type ModerationCaseResolutionRecord = {
    id: number;
    status: string;
    expiresAt: Date | null;
    metadata: string | null;
};

function parseModerationCaseMetadata(value: string | null | undefined) {
    return parseJsonObject<Record<string, unknown>>(value) ?? {};
}

function hasResolutionMetadata(value: string | null | undefined) {
    const metadata = parseModerationCaseMetadata(value);
    const resolution = metadata.resolution;
    return Boolean(resolution && typeof resolution === 'object' && !Array.isArray(resolution));
}

function buildResolutionMetadata(
    value: string | null | undefined,
    resolution: {
        type: ModerationResolutionType;
        actorUserId?: string | null;
        reason?: string | null;
    }
) {
    const metadata = parseModerationCaseMetadata(value);

    return {
        ...metadata,
        resolution: {
            type: resolution.type,
            actorUserId: resolution.actorUserId ?? null,
            reason: resolution.reason ?? null,
            resolvedAt: new Date().toISOString(),
        },
    };
}

export async function resolveModerationCase(options: {
    moderationCase: ModerationCaseResolutionRecord;
    nextStatus: 'CLEARED' | 'EXPIRED';
    resolutionType: ModerationResolutionType;
    actorUserId?: string | null;
    reason?: string | null;
}) {
    return prisma.moderationCase.update({
        where: { id: options.moderationCase.id },
        data: {
            status: options.nextStatus,
            metadata: JSON.stringify(
                buildResolutionMetadata(options.moderationCase.metadata, {
                    type: options.resolutionType,
                    actorUserId: options.actorUserId,
                    reason: options.reason,
                })
            ),
        },
    });
}

async function findLatestResolvableCase(options: {
    guildId: string;
    targetUserId: string;
    actionTypes: string[];
    errorMessage: string;
    allowLegacyBanFallback?: boolean;
}) {
    const activeCase = await prisma.moderationCase.findFirst({
        where: {
            guildId: options.guildId,
            targetUserId: options.targetUserId,
            actionType: { in: options.actionTypes },
            status: 'ACTIVE',
        },
        orderBy: [{ createdAt: 'desc' }, { caseNumber: 'desc' }],
    });

    if (activeCase) {
        return activeCase;
    }

    if (options.allowLegacyBanFallback && options.actionTypes.includes('BAN')) {
        const legacyBanCase = await prisma.moderationCase.findFirst({
            where: {
                guildId: options.guildId,
                targetUserId: options.targetUserId,
                actionType: 'BAN',
                status: 'CLEARED',
            },
            orderBy: [{ createdAt: 'desc' }, { caseNumber: 'desc' }],
        });

        if (legacyBanCase && !hasResolutionMetadata(legacyBanCase.metadata)) {
            return legacyBanCase;
        }
    }

    throw new Error(options.errorMessage);
}

export async function getActiveWarnings(guildId: string, targetUserId: string) {
    return prisma.moderationCase.findMany({
        where: {
            guildId,
            targetUserId,
            actionType: 'WARN',
            status: 'ACTIVE',
        },
        orderBy: { caseNumber: 'asc' },
    });
}

export async function clearWarningCase(guildId: string, actorUserId: string, caseNumber: number, reason?: string | null) {
    const warningCase = await prisma.moderationCase.findUnique({
        where: { guildId_caseNumber: { guildId, caseNumber } },
    });

    if (!warningCase || warningCase.actionType !== 'WARN') {
        throw new Error('Warning case not found.');
    }

    if (warningCase.status !== 'ACTIVE') {
        throw new Error(`Warning case #${caseNumber} is already ${warningCase.status.toLowerCase()}.`);
    }

    return resolveModerationCase({
        moderationCase: warningCase,
        nextStatus: 'CLEARED',
        resolutionType: 'manual',
        actorUserId,
        reason: reason ?? `Warning #${caseNumber} cleared`,
    });
}

export async function createModeratorNote(guildId: string, actorUserId: string, targetUserId: string, note: string) {
    return createModerationCase({
        guildId,
        actionType: 'NOTE',
        source: 'manual',
        actorUserId,
        targetUserId,
        reason: note,
        status: 'INFO',
    });
}

export async function clearModeratorNote(guildId: string, actorUserId: string, caseNumber: number) {
    const noteCase = await prisma.moderationCase.findUnique({
        where: { guildId_caseNumber: { guildId, caseNumber } },
    });

    if (!noteCase || noteCase.actionType !== 'NOTE') {
        throw new Error('Note case not found.');
    }

    await prisma.moderationCase.update({
        where: { id: noteCase.id },
        data: { status: 'CLEARED' },
    });

    return createModerationCase({
        guildId,
        actionType: 'NOTE_CLEAR',
        source: 'manual',
        actorUserId,
        targetUserId: noteCase.targetUserId,
        reason: `Note #${caseNumber} cleared`,
        relatedCaseId: noteCase.id,
        status: 'CLEARED',
    });
}

export async function listCasesForUser(guildId: string, targetUserId: string, take = 20) {
    return prisma.moderationCase.findMany({
        where: { guildId, targetUserId },
        orderBy: { caseNumber: 'desc' },
        take,
    });
}

const PUNISHMENT_ACTION_TYPES = ['WARN', 'MUTE', 'TIMEOUT', 'KICK', 'BAN', 'TEMPBAN'] as const;

export async function getPunishmentHistory(guildId: string, targetUserId: string, take = 15) {
    const safeTake = Math.min(Math.max(take, 1), 250);

    const [groupedCounts, recentCases] = await Promise.all([
        prisma.moderationCase.groupBy({
            by: ['actionType'],
            where: {
                guildId,
                targetUserId,
                actionType: { in: [...PUNISHMENT_ACTION_TYPES] },
            },
            _count: {
                _all: true,
            },
        }),
        prisma.moderationCase.findMany({
            where: {
                guildId,
                targetUserId,
                actionType: { in: [...PUNISHMENT_ACTION_TYPES] },
            },
            orderBy: { caseNumber: 'desc' },
            take: safeTake,
        }),
    ]);

    const counts = {
        warns: 0,
        mutes: 0,
        timeouts: 0,
        kicks: 0,
        bans: 0,
    };

    for (const item of groupedCounts) {
        if (item.actionType === 'WARN') counts.warns += item._count._all;
        if (item.actionType === 'MUTE') counts.mutes += item._count._all;
        if (item.actionType === 'TIMEOUT') counts.timeouts += item._count._all;
        if (item.actionType === 'KICK') counts.kicks += item._count._all;
        if (item.actionType === 'BAN' || item.actionType === 'TEMPBAN') counts.bans += item._count._all;
    }

    return {
        counts,
        cases: recentCases.reverse(),
    };
}

export async function timeoutMember(options: {
    member: GuildMember;
    actorUserId: string;
    durationMinutes: number;
    reason?: string | null;
}) {
    const durationMs = options.durationMinutes * 60_000;
    const expiresAt = new Date(Date.now() + durationMs);
    await options.member.timeout(durationMs, options.reason ?? undefined);
    return createModerationCase({
        guildId: options.member.guild.id,
        actionType: 'TIMEOUT',
        source: 'manual',
        actorUserId: options.actorUserId,
        targetUserId: options.member.id,
        reason: options.reason,
        expiresAt,
        metadata: { durationMinutes: options.durationMinutes },
    });
}

export async function untimeoutMember(options: {
    member: GuildMember;
    actorUserId: string;
    reason?: string | null;
}) {
    const moderationCase = await findLatestResolvableCase({
        guildId: options.member.guild.id,
        targetUserId: options.member.id,
        actionTypes: ['TIMEOUT'],
        errorMessage: 'Active timeout case not found.',
    });

    await options.member.timeout(null, options.reason ?? undefined);
    return resolveModerationCase({
        moderationCase,
        nextStatus: 'CLEARED',
        resolutionType: 'manual',
        actorUserId: options.actorUserId,
        reason: options.reason ?? 'Timeout removed manually',
    });
}

export async function kickMember(options: {
    member: GuildMember;
    actorUserId: string;
    reason?: string | null;
}) {
    await options.member.kick(options.reason ?? undefined);
    return createModerationCase({
        guildId: options.member.guild.id,
        actionType: 'KICK',
        source: 'manual',
        actorUserId: options.actorUserId,
        targetUserId: options.member.id,
        reason: options.reason,
        status: 'CLEARED',
    });
}

export async function banUser(options: {
    guild: Guild;
    targetUser: User | GuildMember;
    actorUserId: string;
    reason?: string | null;
    deleteMessageSeconds?: number;
}) {
    const targetId = options.targetUser.id;
    await options.guild.members.ban(targetId, {
        reason: options.reason ?? undefined,
        deleteMessageSeconds: options.deleteMessageSeconds,
    });

    return createModerationCase({
        guildId: options.guild.id,
        actionType: 'BAN',
        source: 'manual',
        actorUserId: options.actorUserId,
        targetUserId: targetId,
        reason: options.reason,
        status: 'ACTIVE',
        metadata: options.deleteMessageSeconds ? { deleteMessageSeconds: options.deleteMessageSeconds } : null,
    });
}

export async function tempbanUser(options: {
    guild: Guild;
    targetUser: User | GuildMember;
    actorUserId: string;
    durationMinutes: number;
    reason?: string | null;
    deleteMessageSeconds?: number;
}) {
    const targetId = options.targetUser.id;
    const expiresAt = new Date(Date.now() + options.durationMinutes * 60_000);

    await options.guild.members.ban(targetId, {
        reason: options.reason ?? undefined,
        deleteMessageSeconds: options.deleteMessageSeconds,
    });

    return createModerationCase({
        guildId: options.guild.id,
        actionType: 'TEMPBAN',
        source: 'manual',
        actorUserId: options.actorUserId,
        targetUserId: targetId,
        reason: options.reason,
        expiresAt,
        metadata: {
            durationMinutes: options.durationMinutes,
            deleteMessageSeconds: options.deleteMessageSeconds ?? null,
        },
    });
}

export async function unbanUser(options: {
    guild: Guild;
    targetUserId: string;
    actorUserId: string;
    reason?: string | null;
}) {
    const moderationCase = await findLatestResolvableCase({
        guildId: options.guild.id,
        targetUserId: options.targetUserId,
        actionTypes: ['BAN', 'TEMPBAN'],
        errorMessage: 'Active ban case not found.',
        allowLegacyBanFallback: true,
    });

    await options.guild.bans.remove(options.targetUserId, options.reason ?? undefined);
    return resolveModerationCase({
        moderationCase,
        nextStatus: 'CLEARED',
        resolutionType: 'manual',
        actorUserId: options.actorUserId,
        reason: options.reason ?? 'Ban removed manually',
    });
}

export async function muteMember(options: {
    member: GuildMember;
    actorUserId: string;
    durationMinutes?: number;
    reason?: string | null;
}) {
    const config = await ensureModerationConfig(options.member.guild.id);
    if (!config.config.muteRoleId) {
        throw new Error('Mute role is not configured.');
    }

    const muteRole = options.member.guild.roles.cache.get(config.config.muteRoleId);
    if (!muteRole) {
        throw new Error('Mute role does not exist.');
    }

    await options.member.roles.add(muteRole, options.reason ?? undefined);
    const expiresAt = options.durationMinutes ? new Date(Date.now() + options.durationMinutes * 60_000) : null;
    return createModerationCase({
        guildId: options.member.guild.id,
        actionType: 'MUTE',
        source: 'manual',
        actorUserId: options.actorUserId,
        targetUserId: options.member.id,
        reason: options.reason,
        expiresAt,
        metadata: options.durationMinutes ? { durationMinutes: options.durationMinutes } : null,
    });
}

export async function unmuteMember(options: {
    member: GuildMember;
    actorUserId: string;
    reason?: string | null;
}) {
    const config = await ensureModerationConfig(options.member.guild.id);
    if (!config.config.muteRoleId) {
        throw new Error('Mute role is not configured.');
    }

    const muteRole = options.member.guild.roles.cache.get(config.config.muteRoleId);
    if (!muteRole) {
        throw new Error('Mute role does not exist.');
    }

    const moderationCase = await findLatestResolvableCase({
        guildId: options.member.guild.id,
        targetUserId: options.member.id,
        actionTypes: ['MUTE'],
        errorMessage: 'Active mute case not found.',
    });

    await options.member.roles.remove(muteRole, options.reason ?? undefined);
    return resolveModerationCase({
        moderationCase,
        nextStatus: 'CLEARED',
        resolutionType: 'manual',
        actorUserId: options.actorUserId,
        reason: options.reason ?? 'Mute removed manually',
    });
}

function assertLockableGuildChannel(channel: GuildBasedChannel): asserts channel is LockableGuildChannel {
    if (!('permissionOverwrites' in channel) || typeof (channel as { permissionOverwrites?: { edit?: unknown } }).permissionOverwrites?.edit !== 'function') {
        throw new Error('Channel does not support permission overwrite edits.');
    }
}

function assertSlowmodeChannel(channel: GuildBasedChannel): asserts channel is SlowmodeChannel {
    if (!('setRateLimitPerUser' in channel) || typeof (channel as { setRateLimitPerUser?: unknown }).setRateLimitPerUser !== 'function') {
        throw new Error('Channel does not support slowmode.');
    }
}

export async function lockChannel(options: {
    channel: GuildBasedChannel;
    actorUserId: string;
    reason?: string | null;
}) {
    assertLockableGuildChannel(options.channel);
    const channelName = (options.channel as GuildBasedChannel & { name?: string }).name ?? options.channel.id;
    await options.channel.permissionOverwrites.edit(
        options.channel.guild.roles.everyone.id,
        { SendMessages: false },
        options.reason ?? undefined
    );

    return createModerationCase({
        guildId: options.channel.guild.id,
        actionType: 'LOCK',
        source: 'manual',
        actorUserId: options.actorUserId,
        targetUserId: `channel:${options.channel.id}`,
        reason: options.reason,
        status: 'CLEARED',
        metadata: {
            channelId: options.channel.id,
            channelName,
        },
    });
}

export async function unlockChannel(options: {
    channel: GuildBasedChannel;
    actorUserId: string;
    reason?: string | null;
}) {
    assertLockableGuildChannel(options.channel);
    const channelName = (options.channel as GuildBasedChannel & { name?: string }).name ?? options.channel.id;
    await options.channel.permissionOverwrites.edit(
        options.channel.guild.roles.everyone.id,
        { SendMessages: null },
        options.reason ?? undefined
    );

    return createModerationCase({
        guildId: options.channel.guild.id,
        actionType: 'UNLOCK',
        source: 'manual',
        actorUserId: options.actorUserId,
        targetUserId: `channel:${options.channel.id}`,
        reason: options.reason,
        status: 'CLEARED',
        metadata: {
            channelId: options.channel.id,
            channelName,
        },
    });
}

export async function setChannelSlowmode(options: {
    channel: GuildBasedChannel;
    actorUserId: string;
    seconds: number;
    reason?: string | null;
}) {
    assertSlowmodeChannel(options.channel);
    const channelName = (options.channel as GuildBasedChannel & { name?: string }).name ?? options.channel.id;
    await options.channel.setRateLimitPerUser(options.seconds, options.reason ?? undefined);

    return createModerationCase({
        guildId: options.channel.guild.id,
        actionType: options.seconds > 0 ? 'SLOWMODE' : 'SLOWMODE_CLEAR',
        source: 'manual',
        actorUserId: options.actorUserId,
        targetUserId: `channel:${options.channel.id}`,
        reason: options.reason,
        status: 'CLEARED',
        metadata: {
            channelId: options.channel.id,
            channelName,
            seconds: options.seconds,
        },
    });
}

export async function voiceKickMember(options: {
    member: GuildMember;
    actorUserId: string;
    reason?: string | null;
}) {
    await options.member.voice.disconnect(options.reason ?? undefined);
    return createModerationCase({
        guildId: options.member.guild.id,
        actionType: 'VOICEKICK',
        source: 'manual',
        actorUserId: options.actorUserId,
        targetUserId: options.member.id,
        reason: options.reason,
        status: 'CLEARED',
    });
}

export async function voiceMoveMember(options: {
    member: GuildMember;
    targetChannelId: string;
    actorUserId: string;
    reason?: string | null;
}) {
    const targetChannel = options.member.guild.channels.cache.get(options.targetChannelId);
    if (!targetChannel || (targetChannel.type !== ChannelType.GuildVoice && targetChannel.type !== ChannelType.GuildStageVoice)) {
        throw new Error('Target channel must be a voice or stage channel.');
    }

    await options.member.voice.setChannel(targetChannel, options.reason ?? undefined);
    return createModerationCase({
        guildId: options.member.guild.id,
        actionType: 'VOICEMOVE',
        source: 'manual',
        actorUserId: options.actorUserId,
        targetUserId: options.member.id,
        reason: options.reason,
        status: 'CLEARED',
        metadata: {
            voiceChannelId: targetChannel.id,
            voiceChannelName: targetChannel.name,
        },
    });
}

export async function getCaseByNumber(guildId: string, caseNumber: number) {
    return prisma.moderationCase.findUnique({
        where: { guildId_caseNumber: { guildId, caseNumber } },
        include: {
            notes: {
                orderBy: { createdAt: 'asc' },
            },
        },
    });
}

function isBulkDeletable(message: Message) {
    return Date.now() - message.createdTimestamp < 14 * 24 * 60 * 60 * 1000;
}

function assertModerationTextChannel(channel: TextBasedChannel): asserts channel is ModerationTextChannel {
    if (!('messages' in channel) || !('bulkDelete' in channel) || typeof (channel as { bulkDelete?: unknown }).bulkDelete !== 'function') {
        throw new Error('Channel does not support message moderation.');
    }
}

async function collectMessagesBefore(channel: ModerationTextChannel, beforeId: Snowflake, limit: number) {
    const batch = await channel.messages.fetch({ limit: Math.min(limit, 100), before: beforeId });
    return batch;
}

export async function clearRecentMessages(options: {
    channel: TextBasedChannel;
    amount: number;
    userId?: string | null;
    query?: string | null;
}) {
    assertModerationTextChannel(options.channel);

    let cursor: Snowflake | undefined;
    const collected: Message[] = [];

    while (collected.length < options.amount && collected.length < MAX_CLEAR_FETCH) {
        const batch = cursor
            ? await options.channel.messages.fetch({ limit: 100, before: cursor })
            : await options.channel.messages.fetch({ limit: 100 });

        if (!batch.size) break;
        const filtered = Array.from(batch.values()).filter((message) => {
            if (options.userId && message.author.id !== options.userId) return false;
            if (options.query && !message.content.toLowerCase().includes(options.query.toLowerCase())) return false;
            return true;
        });

        collected.push(...filtered);
        cursor = batch.last()?.id;
    }

    const selected = collected.slice(0, options.amount);
    return deleteMessages(options.channel, selected);
}

export async function clearMessageRange(options: {
    channel: TextBasedChannel;
    fromMessageId: Snowflake;
    toMessageId: Snowflake;
}) {
    assertModerationTextChannel(options.channel);

    const fromMessage = await options.channel.messages.fetch(options.fromMessageId).catch(() => null);
    const toMessage = await options.channel.messages.fetch(options.toMessageId).catch(() => null);

    if (!fromMessage || !toMessage) {
        throw new Error('One or both messages were not found in this channel.');
    }

    const older = fromMessage.createdTimestamp <= toMessage.createdTimestamp ? fromMessage : toMessage;
    const newer = older.id === fromMessage.id ? toMessage : fromMessage;

    const messages = new Map<string, Message>();
    messages.set(older.id, older);
    messages.set(newer.id, newer);

    let cursor: Snowflake = newer.id;
    let foundOlder = false;

    while (messages.size < MAX_CLEAR_FETCH) {
        const batch = await collectMessagesBefore(options.channel, cursor, 100);
        if (!batch.size) break;

        for (const message of batch.values()) {
            if (message.createdTimestamp < older.createdTimestamp) {
                foundOlder = true;
                break;
            }
            messages.set(message.id, message);
        }

        if (messages.has(older.id) && foundOlder) break;
        const last = batch.last();
        if (!last || last.id === cursor) break;
        cursor = last.id;
        if (batch.has(older.id)) break;
    }

    const selected = Array.from(messages.values())
        .filter((message) =>
            message.createdTimestamp >= older.createdTimestamp &&
            message.createdTimestamp <= newer.createdTimestamp
        )
        .sort((a, b) => a.createdTimestamp - b.createdTimestamp);

    return deleteMessages(options.channel, selected);
}

async function deleteMessages(channel: ModerationTextChannel, messages: Message[]) {
    const bulk = messages.filter(isBulkDeletable);
    const legacy = messages.filter((message) => !isBulkDeletable(message));

    let bulkDeleted = 0;
    for (let index = 0; index < bulk.length; index += 100) {
        const chunk = bulk.slice(index, index + 100);
        if (!chunk.length) continue;
        const deleted = await channel.bulkDelete(chunk, true);
        bulkDeleted += deleted.size;
    }

    let individuallyDeleted = 0;
    for (const message of legacy) {
        await message.delete().catch(() => null);
        individuallyDeleted += 1;
    }

    return {
        requested: messages.length,
        bulkDeleted,
        individuallyDeleted,
        totalDeleted: bulkDeleted + individuallyDeleted,
    };
}

const hasModeratorOverrideAccess = (member: GuildMember) =>
    member.permissions.has(PermissionFlagsBits.Administrator)
    || member.permissions.has(PermissionFlagsBits.ManageGuild)
    || member.guild.ownerId === member.id;

export const hasGuildPermissionAccess = (member: GuildMember, permission: PermissionResolvable) =>
    member.guild.ownerId === member.id || member.permissions.has(permission);

async function buildModeratorAccessContext(guildId: string, member: GuildMember): Promise<ModeratorAccessContext> {
    if (hasModeratorOverrideAccess(member)) {
        return {
            member,
            hasOverrideAccess: true,
            adminRoleIds: new Set<string>(),
            roleIds: new Set(member.roles.cache.keys()),
            bindingLevel: 0,
            commandRules: [],
            grants: [],
        };
    }

    const [botSettings, moderationConfig, bindings, grants] = await Promise.all([
        prisma.botSettings.findUnique({
            where: { guildId },
            select: { adminRoles: true },
        }),
        prisma.moderationConfig.findUnique({
            where: { guildId },
            select: { commandRules: true },
        }),
        prisma.moderationRoleBinding.findMany({
            where: { guildId, enabled: true },
        }),
        prisma.moderationCommandGrant.findMany({
            where: { guildId },
        }),
    ]);

    const roleIds = new Set(member.roles.cache.keys());

    return {
        member,
        hasOverrideAccess: false,
        adminRoleIds: new Set(parseJsonArray(botSettings?.adminRoles)),
        roleIds,
        bindingLevel: bindings
            .filter((binding) => roleIds.has(binding.roleId))
            .reduce((max, binding) => Math.max(max, binding.accessLevel), 0),
        commandRules: parseCommandRules(moderationConfig?.commandRules),
        grants: grants.map((grant) => ({
            roleId: grant.roleId,
            scopeType: grant.scopeType as 'GROUP' | 'COMMAND',
            scopeKey: grant.scopeKey,
            effect: grant.effect as 'ALLOW' | 'DENY',
        })),
    };
}

function evaluateModeratorAccess(context: ModeratorAccessContext, options: CommandAccessOptions) {
    if (context.hasOverrideAccess) {
        return true;
    }

    if (
        options.requiredDiscordPermissions &&
        hasGuildPermissionAccess(context.member, options.requiredDiscordPermissions)
    ) {
        return true;
    }

    if (context.member.roles.cache.some((role) => context.adminRoleIds.has(role.id))) {
        return true;
    }

    const matchingGrants = context.grants.filter((grant) => context.roleIds.has(grant.roleId));
    const groupGrants = matchingGrants.filter((grant) =>
        grant.scopeType === 'GROUP' && (!options.accessGroup || grant.scopeKey === options.accessGroup));
    const commandGrants = matchingGrants.filter((grant) =>
        grant.scopeType === 'COMMAND' && (!options.accessKey || grant.scopeKey === options.accessKey));
    const savedCommandRule = options.accessKey
        ? context.commandRules.find((rule) => rule.commandKey === options.accessKey)
        : null;
    const defaultCommandRule = options.accessKey ? getDefaultCommandRule(options.accessKey) : null;
    const commandRule = savedCommandRule
        ? {
            ...(defaultCommandRule ?? savedCommandRule),
            ...savedCommandRule,
            requiredAccessLevel: savedCommandRule.requiredAccessLevel ?? defaultCommandRule?.requiredAccessLevel ?? null,
        }
        : defaultCommandRule;

    if (savedCommandRule && !savedCommandRule.enabled) {
        return false;
    }

    const commandRuleDecision = commandRule
        ? evaluateCommandRule(commandRule, {
            roleIds: context.roleIds,
            bindingLevel: context.bindingLevel,
            channelId: options.channelId,
            parentChannelId: options.parentChannelId,
        })
        : null;

    if (commandRuleDecision === false) {
        return false;
    }

    if (
        groupGrants.some((grant) => grant.effect === 'DENY') ||
        commandGrants.some((grant) => grant.effect === 'DENY')
    ) {
        return false;
    }

    if (commandRuleDecision === true) {
        return true;
    }

    if (
        groupGrants.some((grant) => grant.effect === 'ALLOW') ||
        commandGrants.some((grant) => grant.effect === 'ALLOW')
    ) {
        return true;
    }

    if (typeof options.requiredAccessLevel === 'number') {
        return context.bindingLevel >= options.requiredAccessLevel;
    }

    if (options.requiredDiscordPermissions) {
        return false;
    }

    return true;
}

export async function createModeratorAccessEvaluator(guildId: string, member: GuildMember) {
    const context = await buildModeratorAccessContext(guildId, member);
    return (options: CommandAccessOptions) => evaluateModeratorAccess(context, options);
}

export async function ensureModeratorAccess(guildId: string, member: GuildMember, options: CommandAccessOptions) {
    const evaluate = await createModeratorAccessEvaluator(guildId, member);
    return evaluate(options);
}

export async function replyWithCases(interaction: ChatInputCommandInteraction, guildId: string, targetUserId: string, take = 10) {
    const locale = await getInteractionLocale(interaction);
    const cases = await listCasesForUser(guildId, targetUserId, take);
    if (!cases.length) {
        await interaction.reply({ content: t(locale, 'staff.cases.empty'), ephemeral: true });
        return;
    }

    const lines = cases.map((row) => `#${row.caseNumber} - ${row.actionType} - ${row.status}${row.reason ? ` - ${row.reason}` : ''}`);
    await interaction.reply({
        content: lines.join('\n').slice(0, 1900),
        ephemeral: true,
    });
}

export type ModerationRuntimeSnapshot = {
    prefix: string;
    moderationConfig: {
        muteRoleId: string | null;
        ignoredChannels: string[];
        ignoredRoles: string[];
        ignoredUsers: string[];
        commandOnlyChannels: string[];
    };
    automodRules: Map<string, { enabled: boolean; config: Record<string, unknown> | null }>;
    sanctionSteps: Array<{
        triggerStrikeCount: number;
        actionType: string;
        durationMinutes: number | null;
        enabled: boolean;
    }>;
    aiConfig: {
        enabled: boolean;
        provider: string | null;
        model: string | null;
        defaultThreshold: number;
        scanEdits: boolean;
        includedChannels: string[];
        excludedChannels: string[];
        exemptRoles: string[];
        exemptUsers: string[];
        customPolicyPrompt: string | null;
    } | null;
    aiCategories: Array<{
        category: string;
        enabled: boolean;
        threshold: number;
        sortOrder: number;
    }>;
};

export async function getModerationRuntimeSnapshot(guildId: string): Promise<ModerationRuntimeSnapshot | null> {
    try {
        await ensureModerationConfig(guildId);

        const [guild, config, rules, sanctionSteps, aiConfig, aiCategories] = await Promise.all([
            prisma.guild.findUnique({
                where: { id: guildId },
                select: { prefix: true },
            }),
            prisma.moderationConfig.findUnique({ where: { guildId } }),
            prisma.automodRuleConfig.findMany({ where: { guildId } }),
            prisma.automodSanctionStep.findMany({
                where: { guildId, enabled: true },
                orderBy: [{ triggerStrikeCount: 'asc' }, { sortOrder: 'asc' }],
            }),
            prisma.aiModerationConfig.findUnique({ where: { guildId } }),
            prisma.aiModerationCategoryRule.findMany({
                where: { guildId },
                orderBy: [{ sortOrder: 'asc' }, { category: 'asc' }],
            }),
        ]);

        return {
            prefix: guild?.prefix || '!',
            moderationConfig: {
                muteRoleId: config?.muteRoleId ?? null,
                ignoredChannels: parseJsonArray(config?.ignoredChannels),
                ignoredRoles: parseJsonArray(config?.ignoredRoles),
                ignoredUsers: parseJsonArray(config?.ignoredUsers),
                commandOnlyChannels: parseJsonArray(config?.commandOnlyChannels),
            },
            automodRules: new Map(
                rules.map((rule) => [rule.ruleKey, { enabled: rule.enabled, config: parseJsonObject(rule.config) }])
            ),
            sanctionSteps: sanctionSteps.map((step) => ({
                triggerStrikeCount: step.triggerStrikeCount,
                actionType: step.actionType,
                durationMinutes: step.durationMinutes,
                enabled: step.enabled,
            })),
            aiConfig: aiConfig
                ? {
                    enabled: aiConfig.enabled,
                    provider: aiConfig.provider ?? null,
                    model: aiConfig.model ?? null,
                    defaultThreshold: aiConfig.defaultThreshold,
                    scanEdits: aiConfig.scanEdits,
                    includedChannels: parseJsonArray(aiConfig.includedChannels),
                    excludedChannels: parseJsonArray(aiConfig.excludedChannels),
                    exemptRoles: parseJsonArray(aiConfig.exemptRoles),
                    exemptUsers: parseJsonArray(aiConfig.exemptUsers),
                    customPolicyPrompt: aiConfig.customPolicyPrompt ?? null,
                }
                : null,
            aiCategories: aiCategories.map((category) => ({
                category: category.category,
                enabled: category.enabled,
                threshold: category.threshold,
                sortOrder: category.sortOrder,
            })),
        };
    } catch (error) {
        if (isMissingModerationTableError(error)) {
            return null;
        }

        throw error;
    }
}
