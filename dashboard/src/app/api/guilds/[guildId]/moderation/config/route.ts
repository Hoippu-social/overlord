import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthToken } from '@/lib/auth';
import { canAccessGuild } from '@/lib/discordAccess';

const AI_CATEGORIES = [
    'toxicity',
    'harassment',
    'hate_discrimination',
    'threats_violence',
    'sexual_explicit',
    'scam_fraud',
    'self_harm_crisis',
    'doxxing_personal_data',
] as const;

const BUILT_IN_RULES = [
    'flood',
    'repeated_messages',
    'banwords',
    'zalgo',
    'repeated_mentions',
    'links',
    'advertising',
    'emoji_spam',
    'emoji',
    'command_channels',
    'lines',
    'image_filter',
] as const;

const LEGACY_BUILT_IN_RULES = new Set([
    'duplicate_messages',
    'repeated_strings',
    'mentions_spam',
    'command_only',
]);

const RETENTION_CATEGORIES = [
    'AI_DISMISSED_INCIDENTS',
    'AI_CONFIRMED_INCIDENTS',
    'AUTOMOD_CASE_METADATA',
    'APPEAL_MESSAGES',
    'APPEAL_RESOLUTION_NOTES',
    'CLEARED_CASE_METADATA',
] as const;

const DEFAULT_RETENTION: Record<(typeof RETENTION_CATEGORIES)[number], { enabled: boolean; strategy: string; ttlDays: number | null }> = {
    AI_DISMISSED_INCIDENTS: { enabled: true, strategy: 'DELETE', ttlDays: 30 },
    AI_CONFIRMED_INCIDENTS: { enabled: true, strategy: 'TRIM', ttlDays: 90 },
    AUTOMOD_CASE_METADATA: { enabled: true, strategy: 'TRIM', ttlDays: 30 },
    APPEAL_MESSAGES: { enabled: false, strategy: 'TRIM', ttlDays: 180 },
    APPEAL_RESOLUTION_NOTES: { enabled: false, strategy: 'TRIM', ttlDays: 180 },
    CLEARED_CASE_METADATA: { enabled: false, strategy: 'TRIM', ttlDays: 90 },
};

const DEFAULT_AI_ENABLED = new Set([
    'hate_discrimination',
    'threats_violence',
    'scam_fraud',
    'doxxing_personal_data',
]);

const parseJsonArray = (value: unknown) => {
    if (Array.isArray(value)) {
        return value.filter((item): item is string => typeof item === 'string');
    }

    if (typeof value !== 'string') {
        return [];
    }

    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
    } catch {
        return [];
    }
};

const parseJsonObject = (value: unknown) => {
    if (typeof value !== 'string') {
        return null;
    }

    try {
        const parsed = JSON.parse(value);
        return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
        return null;
    }
};

const normalizeStringArray = (value: unknown) => {
    if (!Array.isArray(value)) {
        return [];
    }

    return value
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean);
};

const normalizeBoolean = (value: unknown, fallback = false) => {
    if (typeof value === 'boolean') {
        return value;
    }

    return fallback;
};

const normalizeInteger = (value: unknown, fallback: number, min?: number, max?: number) => {
    const raw = typeof value === 'string' ? Number(value) : value;
    if (typeof raw !== 'number' || !Number.isFinite(raw)) {
        return fallback;
    }

    let normalized = Math.round(raw);
    if (typeof min === 'number') normalized = Math.max(min, normalized);
    if (typeof max === 'number') normalized = Math.min(max, normalized);
    return normalized;
};

const normalizeNullableString = (value: unknown) => {
    if (typeof value !== 'string') {
        return null;
    }

    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
};

const normalizeCommandRuleMode = (value: unknown) =>
    value === 'WHITELIST' ? 'WHITELIST' : 'BLACKLIST';

const asRecord = (value: unknown): Record<string, unknown> =>
    value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

const normalizeCommandRules = (value: unknown) => {
    if (!Array.isArray(value)) {
        return [];
    }

    return value
        .map((rule: unknown) => {
            const entry = asRecord(rule);
            const commandKey = normalizeNullableString(entry.commandKey);
            if (!commandKey) {
                return null;
            }

            const requiredAccessLevel = entry.requiredAccessLevel;
            return {
                commandKey,
                enabled: normalizeBoolean(entry.enabled, true),
                roleMode: normalizeCommandRuleMode(entry.roleMode),
                roleIds: normalizeStringArray(entry.roleIds),
                channelMode: normalizeCommandRuleMode(entry.channelMode),
                channelIds: normalizeStringArray(entry.channelIds),
                requiredAccessLevel:
                    requiredAccessLevel === null || requiredAccessLevel === undefined || requiredAccessLevel === ''
                        ? null
                        : normalizeInteger(requiredAccessLevel, 50, 0, 100),
            };
        })
        .filter(Boolean);
};

const parseGuildPayload = (value: string | null) => {
    if (!value) return [];

    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
};

const textChannelTypes = new Set([0, 5, 11, 12, 15, 16, 'text', 'announcement', 'news', 'public_thread', 'private_thread', 'forum', 'media']);
const voiceChannelTypes = new Set([2, 13, 'voice', 'GUILD_VOICE', 'stage_voice', 'GUILD_STAGE_VOICE', 'cast']);
const categoryChannelTypes = new Set([4, 'category', 'GUILD_CATEGORY']);

const sortRolesByServerOrder = (left: { position: number }, right: { position: number }) =>
    right.position - left.position;

const sortChannelsByServerOrder = (
    left: { position: number; parentId: string | null; isCategory: boolean },
    right: { position: number; parentId: string | null; isCategory: boolean },
    categoryMap: Map<string, number>,
) => {
    const leftGroupPosition = left.isCategory
        ? left.position
        : left.parentId
            ? (categoryMap.get(left.parentId) ?? left.position)
            : left.position;
    const rightGroupPosition = right.isCategory
        ? right.position
        : right.parentId
            ? (categoryMap.get(right.parentId) ?? right.position)
            : right.position;

    if (leftGroupPosition !== rightGroupPosition) {
        return leftGroupPosition - rightGroupPosition;
    }

    if (left.isCategory !== right.isCategory) {
        return left.isCategory ? -1 : 1;
    }

    return left.position - right.position;
};

async function ensureModerationDefaults(guildId: string) {
    await prisma.guild.upsert({
        where: { id: guildId },
        update: {},
        create: { id: guildId, prefix: '!' },
    });

    await prisma.moderationConfig.upsert({
        where: { guildId },
        update: {},
        create: { guildId },
    });

    await prisma.aiModerationConfig.upsert({
        where: { guildId },
        update: {},
        create: { guildId },
    });

    await prisma.appealConfig.upsert({
        where: { guildId },
        update: {},
        create: { guildId },
    });

    for (const category of RETENTION_CATEGORIES) {
        await prisma.retentionPolicy.upsert({
            where: { guildId_category: { guildId, category } },
            update: {},
            create: {
                guildId,
                category,
                enabled: DEFAULT_RETENTION[category].enabled,
                strategy: DEFAULT_RETENTION[category].strategy,
                ttlDays: DEFAULT_RETENTION[category].ttlDays,
            },
        });
    }

    for (const [index, category] of AI_CATEGORIES.entries()) {
        await prisma.aiModerationCategoryRule.upsert({
            where: { guildId_category: { guildId, category } },
            update: {},
            create: {
                guildId,
                category,
                enabled: DEFAULT_AI_ENABLED.has(category),
                threshold: 80,
                sortOrder: index,
            },
        });
    }

    const existingRuleConfigs = await prisma.automodRuleConfig.findMany({
        where: { guildId },
        select: { ruleKey: true },
    });

    const hasLegacyBuiltIns = existingRuleConfigs.some((rule) => LEGACY_BUILT_IN_RULES.has(rule.ruleKey));
    if (hasLegacyBuiltIns) {
        await prisma.automodRuleConfig.deleteMany({ where: { guildId } });
    }

    for (const ruleKey of BUILT_IN_RULES) {
        await prisma.automodRuleConfig.upsert({
            where: { guildId_ruleKey: { guildId, ruleKey } },
            update: {},
            create: { guildId, ruleKey, enabled: false },
        });
    }
}

async function authorize(request: NextRequest, guildId: string) {
    const token = await getAuthToken(request);
    const accessToken = typeof token?.accessToken === 'string' ? token.accessToken : null;
    if (!accessToken) {
        return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
    }

    const allowedGuilds = Array.isArray(token?.allowedGuilds) ? token.allowedGuilds : null;
    const hasAccess = allowedGuilds ? allowedGuilds.includes(guildId) : await canAccessGuild(accessToken, guildId);
    if (!hasAccess) {
        return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
    }

    return { error: null };
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ guildId: string }> }) {
    try {
        const { guildId } = await params;
        const auth = await authorize(request, guildId);
        if (auth.error) {
            return auth.error;
        }

        await ensureModerationDefaults(guildId);

        const [guild, config, roleBindings, commandGrants, automodRules, customRules, sanctionSteps, aiConfig, aiCategories, appealConfig, retentionPolicies] =
            await Promise.all([
                prisma.guild.findUnique({
                    where: { id: guildId },
                    select: { roles: true, channels: true },
                }),
                prisma.moderationConfig.findUnique({ where: { guildId } }),
                prisma.moderationRoleBinding.findMany({
                    where: { guildId },
                    orderBy: [{ sortOrder: 'asc' }, { accessLevel: 'desc' }, { id: 'asc' }],
                }),
                prisma.moderationCommandGrant.findMany({
                    where: { guildId },
                    orderBy: [{ scopeType: 'asc' }, { scopeKey: 'asc' }, { roleId: 'asc' }],
                }),
                prisma.automodRuleConfig.findMany({
                    where: { guildId },
                    orderBy: [{ ruleKey: 'asc' }],
                }),
                prisma.automodCustomRule.findMany({
                    where: { guildId },
                    orderBy: [{ createdAt: 'asc' }],
                }),
                prisma.automodSanctionStep.findMany({
                    where: { guildId },
                    orderBy: [{ triggerStrikeCount: 'asc' }, { sortOrder: 'asc' }],
                }),
                prisma.aiModerationConfig.findUnique({ where: { guildId } }),
                prisma.aiModerationCategoryRule.findMany({
                    where: { guildId },
                    orderBy: [{ sortOrder: 'asc' }, { category: 'asc' }],
                }),
                prisma.appealConfig.findUnique({ where: { guildId } }),
                prisma.retentionPolicy.findMany({
                    where: { guildId },
                    orderBy: [{ category: 'asc' }],
                }),
            ]);

        const roles = parseGuildPayload(guild?.roles ?? null).map((role) => ({
            id: String(role.id ?? ''),
            name: String(role.name ?? 'Unknown role'),
            color: role.color ?? '#000000',
            position: Number(role.position ?? 0),
        }));

        const rawChannels = parseGuildPayload(guild?.channels ?? null);
        const categoryEntries = rawChannels
            .filter((channel) => categoryChannelTypes.has(channel?.type))
            .map((channel) => ({
                id: String(channel.id ?? ''),
                name: String(channel.name ?? 'Category'),
                position: Number(channel.position ?? 0),
            }));
        const categoryPositions = new Map(categoryEntries.map((channel) => [channel.id, channel.position]));
        const categoryNames = new Map(categoryEntries.map((channel) => [channel.id, channel.name]));

        const channels = rawChannels
            .filter((channel) => textChannelTypes.has(channel.type) || voiceChannelTypes.has(channel.type) || categoryChannelTypes.has(channel.type))
            .map((channel) => ({
                id: String(channel.id ?? ''),
                name: String(channel.name ?? 'unknown-channel'),
                type: channel.type,
                position: Number(channel.position ?? 0),
                parentId: channel.parentId ? String(channel.parentId) : null,
            }))
            .sort((left, right) => left.position - right.position);

        return NextResponse.json({
            roles,
            channels,
            moderationConfig: config
                ? {
                    muteRoleId: config.muteRoleId,
                    ignoredChannels: parseJsonArray(config.ignoredChannels),
                    ignoredRoles: parseJsonArray(config.ignoredRoles),
                    ignoredUsers: parseJsonArray(config.ignoredUsers),
                    commandOnlyChannels: parseJsonArray(config.commandOnlyChannels),
                }
                : null,
            roleBindings,
            commandGrants,
            automodRules: BUILT_IN_RULES.map((ruleKey) => {
                const existingRule = automodRules.find((rule) => rule.ruleKey === ruleKey);
                return existingRule
                    ? { ...existingRule, config: parseJsonObject(existingRule.config) }
                    : { guildId, ruleKey, enabled: false, config: null };
            }),
            customRules,
            sanctionSteps,
            aiConfig: aiConfig
                ? {
                    enabled: aiConfig.enabled,
                    provider: aiConfig.provider,
                    model: aiConfig.model,
                    defaultThreshold: aiConfig.defaultThreshold,
                    scanEdits: aiConfig.scanEdits,
                    includedChannels: parseJsonArray(aiConfig.includedChannels),
                    excludedChannels: parseJsonArray(aiConfig.excludedChannels),
                    exemptRoles: parseJsonArray(aiConfig.exemptRoles),
                    exemptUsers: parseJsonArray(aiConfig.exemptUsers),
                    customPolicyPrompt: aiConfig.customPolicyPrompt,
                }
                : null,
            aiCategories,
            appealConfig: appealConfig
                ? {
                    enabled: appealConfig.enabled,
                    appealChannelId: appealConfig.appealChannelId,
                    pardonLogChannelId: appealConfig.pardonLogChannelId,
                    allowUserAppeals: appealConfig.allowUserAppeals,
                    allowDirectPardon: appealConfig.allowDirectPardon,
                }
                : null,
            retentionPolicies,
            builtInRuleKeys: Array.from(BUILT_IN_RULES),
            availableAiCategories: Array.from(AI_CATEGORIES),
        });
    } catch (error) {
        console.error('Failed to load moderation config:', error);
        return NextResponse.json({ error: 'Failed to load moderation config.' }, { status: 500 });
    }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ guildId: string }> }) {
    try {
        const { guildId } = await params;
        const auth = await authorize(request, guildId);
        if (auth.error) {
            return auth.error;
        }

        await ensureModerationDefaults(guildId);

        const body = await request.json();
        const moderationConfig = body?.moderationConfig ?? {};
        const roleBindings = Array.isArray(body?.roleBindings) ? body.roleBindings : [];
        const commandGrants = Array.isArray(body?.commandGrants) ? body.commandGrants : [];
        const automodRules = Array.isArray(body?.automodRules) ? body.automodRules : [];
        const customRules = Array.isArray(body?.customRules) ? body.customRules : [];
        const sanctionSteps = Array.isArray(body?.sanctionSteps) ? body.sanctionSteps : [];
        const aiConfig = body?.aiConfig ?? {};
        const aiCategories = Array.isArray(body?.aiCategories) ? body.aiCategories : [];
        const appealConfig = body?.appealConfig ?? {};
        const retentionPolicies = Array.isArray(body?.retentionPolicies) ? body.retentionPolicies : [];

        await prisma.$transaction(async (tx) => {
            await tx.moderationConfig.upsert({
                where: { guildId },
                update: {
                    muteRoleId: normalizeNullableString(moderationConfig.muteRoleId),
                    ignoredChannels: JSON.stringify(normalizeStringArray(moderationConfig.ignoredChannels)),
                    ignoredRoles: JSON.stringify(normalizeStringArray(moderationConfig.ignoredRoles)),
                    ignoredUsers: JSON.stringify(normalizeStringArray(moderationConfig.ignoredUsers)),
                    commandOnlyChannels: JSON.stringify(normalizeStringArray(moderationConfig.commandOnlyChannels)),
                },
                create: {
                    guildId,
                    muteRoleId: normalizeNullableString(moderationConfig.muteRoleId),
                    ignoredChannels: JSON.stringify(normalizeStringArray(moderationConfig.ignoredChannels)),
                    ignoredRoles: JSON.stringify(normalizeStringArray(moderationConfig.ignoredRoles)),
                    ignoredUsers: JSON.stringify(normalizeStringArray(moderationConfig.ignoredUsers)),
                    commandOnlyChannels: JSON.stringify(normalizeStringArray(moderationConfig.commandOnlyChannels)),
                },
            });

            await tx.aiModerationConfig.upsert({
                where: { guildId },
                update: {
                    enabled: normalizeBoolean(aiConfig.enabled, false),
                    provider: normalizeNullableString(aiConfig.provider),
                    model: normalizeNullableString(aiConfig.model),
                    defaultThreshold: normalizeInteger(aiConfig.defaultThreshold, 80, 0, 100),
                    scanEdits: normalizeBoolean(aiConfig.scanEdits, true),
                    includedChannels: JSON.stringify(normalizeStringArray(aiConfig.includedChannels)),
                    excludedChannels: JSON.stringify(normalizeStringArray(aiConfig.excludedChannels)),
                    exemptRoles: JSON.stringify(normalizeStringArray(aiConfig.exemptRoles)),
                    exemptUsers: JSON.stringify(normalizeStringArray(aiConfig.exemptUsers)),
                    customPolicyPrompt: normalizeNullableString(aiConfig.customPolicyPrompt),
                },
                create: {
                    guildId,
                    enabled: normalizeBoolean(aiConfig.enabled, false),
                    provider: normalizeNullableString(aiConfig.provider),
                    model: normalizeNullableString(aiConfig.model),
                    defaultThreshold: normalizeInteger(aiConfig.defaultThreshold, 80, 0, 100),
                    scanEdits: normalizeBoolean(aiConfig.scanEdits, true),
                    includedChannels: JSON.stringify(normalizeStringArray(aiConfig.includedChannels)),
                    excludedChannels: JSON.stringify(normalizeStringArray(aiConfig.excludedChannels)),
                    exemptRoles: JSON.stringify(normalizeStringArray(aiConfig.exemptRoles)),
                    exemptUsers: JSON.stringify(normalizeStringArray(aiConfig.exemptUsers)),
                    customPolicyPrompt: normalizeNullableString(aiConfig.customPolicyPrompt),
                },
            });

            await tx.appealConfig.upsert({
                where: { guildId },
                update: {
                    enabled: normalizeBoolean(appealConfig.enabled, false),
                    appealChannelId: normalizeNullableString(appealConfig.appealChannelId),
                    pardonLogChannelId: normalizeNullableString(appealConfig.pardonLogChannelId),
                    allowUserAppeals: normalizeBoolean(appealConfig.allowUserAppeals, true),
                    allowDirectPardon: normalizeBoolean(appealConfig.allowDirectPardon, true),
                },
                create: {
                    guildId,
                    enabled: normalizeBoolean(appealConfig.enabled, false),
                    appealChannelId: normalizeNullableString(appealConfig.appealChannelId),
                    pardonLogChannelId: normalizeNullableString(appealConfig.pardonLogChannelId),
                    allowUserAppeals: normalizeBoolean(appealConfig.allowUserAppeals, true),
                    allowDirectPardon: normalizeBoolean(appealConfig.allowDirectPardon, true),
                },
            });

            await tx.retentionPolicy.deleteMany({ where: { guildId } });
            for (const category of RETENTION_CATEGORIES) {
                const raw = asRecord(
                    retentionPolicies.find(
                        (entry: unknown) => asRecord(entry).category === category
                    )
                );
                await tx.retentionPolicy.create({
                    data: {
                        guildId,
                        category,
                        enabled: normalizeBoolean(raw.enabled, DEFAULT_RETENTION[category].enabled),
                        strategy: normalizeNullableString(raw.strategy) ?? DEFAULT_RETENTION[category].strategy,
                        ttlDays:
                            raw.ttlDays === null || raw.ttlDays === undefined || raw.ttlDays === ''
                                ? DEFAULT_RETENTION[category].ttlDays
                                : normalizeInteger(raw.ttlDays, DEFAULT_RETENTION[category].ttlDays ?? 30, 1, 3650),
                    },
                });
            }

            await tx.moderationRoleBinding.deleteMany({ where: { guildId } });
            if (roleBindings.length) {
                const normalizedBindings = roleBindings
                    .map((binding: unknown, index: number) => {
                        const entry = asRecord(binding);
                        return {
                            guildId,
                            roleId: normalizeNullableString(entry.roleId),
                            title: typeof entry.title === 'string' ? entry.title.trim() : '',
                            accessLevel: normalizeInteger(entry.accessLevel, 50, 0, 100),
                            enabled: normalizeBoolean(entry.enabled, true),
                            sortOrder: normalizeInteger(entry.sortOrder, index, 0),
                        };
                    })
                    .filter((binding: { roleId: string | null }) => Boolean(binding.roleId)) as Array<{
                        guildId: string;
                        roleId: string;
                        title: string;
                        accessLevel: number;
                        enabled: boolean;
                        sortOrder: number;
                    }>;

                for (const binding of normalizedBindings) {
                    await tx.moderationRoleBinding.create({ data: binding });
                }
            }

            await tx.moderationCommandGrant.deleteMany({ where: { guildId } });
            if (commandGrants.length) {
                const normalizedGrants = commandGrants
                    .map((grant: unknown) => {
                        const entry = asRecord(grant);
                        return {
                            guildId,
                            roleId: normalizeNullableString(entry.roleId),
                            scopeType: entry.scopeType === 'GROUP' ? 'GROUP' : 'COMMAND',
                            scopeKey: normalizeNullableString(entry.scopeKey),
                            effect: entry.effect === 'DENY' ? 'DENY' : 'ALLOW',
                        };
                    })
                    .filter((grant: { roleId: string | null; scopeKey: string | null }) => Boolean(grant.roleId) && Boolean(grant.scopeKey)) as Array<{
                        guildId: string;
                        roleId: string;
                        scopeType: string;
                        scopeKey: string;
                        effect: string;
                    }>;

                for (const grant of normalizedGrants) {
                    await tx.moderationCommandGrant.create({ data: grant });
                }
            }

            await tx.automodRuleConfig.deleteMany({ where: { guildId } });
            for (const ruleKey of BUILT_IN_RULES) {
                const raw = asRecord(
                    automodRules.find((rule: unknown) => asRecord(rule).ruleKey === ruleKey)
                );
                await tx.automodRuleConfig.create({
                    data: {
                        guildId,
                        ruleKey,
                        enabled: normalizeBoolean(raw.enabled, false),
                        config: raw.config && typeof raw.config === 'object' ? JSON.stringify(raw.config) : null,
                    },
                });
            }

            await tx.automodCustomRule.deleteMany({ where: { guildId } });
            if (customRules.length) {
                const normalizedCustomRules = customRules
                    .map((rule: unknown) => {
                        const entry = asRecord(rule);
                        return {
                            guildId,
                            name: normalizeNullableString(entry.name),
                            ruleType: entry.ruleType === 'keyword-list' ? 'keyword-list' : 'regex',
                            pattern: normalizeNullableString(entry.pattern),
                            enabled: normalizeBoolean(entry.enabled, true),
                            action: normalizeNullableString(entry.action) ?? 'DELETE',
                            strikeWeight: normalizeInteger(entry.strikeWeight, 1, 0, 100),
                            notes: normalizeNullableString(entry.notes),
                        };
                    })
                    .filter((rule: { name: string | null; pattern: string | null }) => Boolean(rule.name) && Boolean(rule.pattern)) as Array<{
                        guildId: string;
                        name: string;
                        ruleType: string;
                        pattern: string;
                        enabled: boolean;
                        action: string;
                        strikeWeight: number;
                        notes: string | null;
                    }>;

                for (const rule of normalizedCustomRules) {
                    await tx.automodCustomRule.create({ data: rule });
                }
            }

            await tx.automodSanctionStep.deleteMany({ where: { guildId } });
            if (sanctionSteps.length) {
                const normalizedSteps = sanctionSteps
                    .map((step: unknown, index: number) => {
                        const entry = asRecord(step);
                        return {
                            guildId,
                            triggerStrikeCount: normalizeInteger(entry.triggerStrikeCount, index + 1, 1, 1000),
                            actionType: normalizeNullableString(entry.actionType) ?? 'TIMEOUT',
                            durationMinutes:
                                entry.durationMinutes === null || entry.durationMinutes === undefined
                                    ? null
                                    : normalizeInteger(entry.durationMinutes, 60, 1, 1_000_000),
                            enabled: normalizeBoolean(entry.enabled, true),
                            sortOrder: normalizeInteger(entry.sortOrder, index, 0),
                        };
                    })
                    .filter((step: { triggerStrikeCount: number; actionType: string }, index: number, array: Array<{ triggerStrikeCount: number; actionType: string }>) =>
                        array.findIndex(
                            (candidate) =>
                                candidate.triggerStrikeCount === step.triggerStrikeCount &&
                                candidate.actionType === step.actionType
                        ) === index
                    );

                for (const step of normalizedSteps) {
                    await tx.automodSanctionStep.create({ data: step });
                }
            }

            await tx.aiModerationCategoryRule.deleteMany({ where: { guildId } });
            for (const [index, category] of AI_CATEGORIES.entries()) {
                const raw = asRecord(
                    aiCategories.find((entry: unknown) => asRecord(entry).category === category)
                );
                await tx.aiModerationCategoryRule.create({
                    data: {
                        guildId,
                        category,
                        enabled: normalizeBoolean(raw.enabled, DEFAULT_AI_ENABLED.has(category)),
                        threshold: normalizeInteger(raw.threshold, 80, 0, 100),
                        sortOrder: normalizeInteger(raw.sortOrder, index, 0),
                    },
                });
            }
        });

        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error('Failed to save moderation config:', error);
        return NextResponse.json({ error: 'Failed to save moderation config.' }, { status: 500 });
    }
}
