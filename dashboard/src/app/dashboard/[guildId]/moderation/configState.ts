import { AutomodActionConfig, AutomodAdvertisingConfig, AutomodBanwordsConfig, AutomodCommandChannelsConfig, AutomodEmojiConfig, AutomodEmojiSpamConfig, AutomodFloodAction, AutomodFloodConfig, AutomodFloodWindowUnit, AutomodImageFilterConfig, AutomodLinesConfig, AutomodLinksConfig, AutomodMentionSpamConfig, AutomodSpamConfig, AutomodZalgoConfig, CommandRule, ConfigState } from './types';
import { createDefaultCommandRules, getDefaultCommandRule } from '@/lib/commandCatalog';
import { normalizeAppealSettings } from '@/lib/appealsConfig';

type JsonObject = Record<string, unknown>;

function asObject(value: unknown): JsonObject {
    return typeof value === 'object' && value !== null ? (value as JsonObject) : {};
}

function asArray(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
}

function asStringArray(value: unknown): string[] {
    return asArray(value).filter((item): item is string => typeof item === 'string');
}

function asTypedArray<T>(value: unknown): T[] {
    return Array.isArray(value) ? (value as T[]) : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeFloodWindowUnit(value: unknown): AutomodFloodWindowUnit {
    if (value === 'seconds' || value === 'minutes' || value === 'hours' || value === 'days') {
        return value;
    }

    return 'minutes';
}

function convertMsToFloodWindow(ms: number): Pick<AutomodFloodConfig, 'windowValue' | 'windowUnit'> {
    if (ms > 0 && ms % 86_400_000 === 0) {
        return { windowValue: ms / 86_400_000, windowUnit: 'days' };
    }

    if (ms > 0 && ms % 3_600_000 === 0) {
        return { windowValue: ms / 3_600_000, windowUnit: 'hours' };
    }

    if (ms > 0 && ms % 60_000 === 0) {
        return { windowValue: ms / 60_000, windowUnit: 'minutes' };
    }

    return { windowValue: Math.max(1, Math.round(ms / 1000)), windowUnit: 'seconds' };
}

function normalizeFloodActionRow(value: unknown, fallbackCount: number): AutomodFloodAction | null {
    if (typeof value === 'string') {
        return {
            messageCount: fallbackCount,
            action: value,
            durationText: '',
        };
    }

    if (!isRecord(value)) {
        return null;
    }

    const messageCount = Number(value.messageCount ?? value.count ?? fallbackCount);
    const action = typeof value.action === 'string' ? value.action : 'DELETE';
    const durationText = typeof value.durationText === 'string'
        ? value.durationText
        : typeof value.duration === 'string'
            ? value.duration
            : '';

    return {
        messageCount: Number.isFinite(messageCount) && messageCount > 0 ? messageCount : fallbackCount,
        action,
        durationText,
    };
}

function normalizeFloodActionRows(config: Record<string, unknown>) {
    const fallbackCount = Number(config.count ?? 6);
    const normalizedFallbackCount = Number.isFinite(fallbackCount) && fallbackCount > 0 ? fallbackCount : 6;
    const rows = Array.isArray(config.actions)
        ? config.actions
            .map((action) => normalizeFloodActionRow(action, normalizedFallbackCount))
            .filter((action): action is AutomodFloodAction => Boolean(action))
        : [];

    return rows;
}

function normalizeActionConfigRow(value: unknown): AutomodActionConfig | null {
    if (typeof value === 'string') {
        return {
            action: value,
            durationText: '',
        };
    }

    if (!isRecord(value)) {
        return null;
    }

    const action = typeof value.action === 'string' ? value.action : 'DELETE';
    const durationText = typeof value.durationText === 'string'
        ? value.durationText
        : typeof value.duration === 'string'
            ? value.duration
            : '';

    return {
        action,
        durationText,
    };
}

function normalizeFloodConfig(value: unknown): AutomodFloodConfig {
    const config = isRecord(value) ? value : {};
    const legacyWindowMs = typeof config.windowMs === 'number' && Number.isFinite(config.windowMs) ? config.windowMs : null;
    const windowShape = legacyWindowMs !== null
        ? convertMsToFloodWindow(legacyWindowMs)
        : {
            windowValue: Number(config.windowValue ?? 1),
            windowUnit: normalizeFloodWindowUnit(config.windowUnit),
        };

    return {
        windowValue: Number.isFinite(windowShape.windowValue) && windowShape.windowValue > 0 ? windowShape.windowValue : 1,
        windowUnit: windowShape.windowUnit,
        actions: normalizeFloodActionRows(config),
        ignoredChannels: asStringArray(config.ignoredChannels),
        ignoredRoles: asStringArray(config.ignoredRoles),
    };
}

function normalizeZalgoConfig(value: unknown): AutomodZalgoConfig {
    const config = isRecord(value) ? value : {};
    const legacyCount = Number.isFinite(Number(config.count)) && Number(config.count) > 0 ? Math.round(Number(config.count)) : 1;
    const legacyAction = typeof config.action === 'string' && config.action.trim() ? config.action.toUpperCase() : 'DELETE';
    const legacyDurationText =
        typeof config.durationText === 'string'
            ? config.durationText.trim()
            : typeof config.duration === 'string'
                ? config.duration.trim()
                : '';

    const actions = Array.isArray(config.actions)
        ? config.actions
            .map((action) => normalizeFloodActionRow(action, legacyCount))
            .filter((action): action is AutomodFloodAction => Boolean(action))
        : [];

    return {
        percent: Number.isFinite(Number(config.percent)) && Number(config.percent) > 0
            ? Math.min(100, Math.round(Number(config.percent)))
            : 10,
        ignoredChannels: asStringArray(config.ignoredChannels),
        actions: actions.length ? actions : [{
            messageCount: legacyCount,
            action: legacyAction,
            durationText: legacyDurationText,
        }],
    };
}

function normalizeSpamConfig(value: unknown): AutomodSpamConfig {
    const config = isRecord(value) ? value : {};
    const legacyWindowMs = typeof config.windowMs === 'number' && Number.isFinite(config.windowMs) ? config.windowMs : null;
    const windowShape = legacyWindowMs !== null
        ? convertMsToFloodWindow(legacyWindowMs)
        : {
            windowValue: Number(config.windowValue ?? 1),
            windowUnit: normalizeFloodWindowUnit(config.windowUnit),
        };
    const legacyCount = Number.isFinite(Number(config.count)) && Number(config.count) > 0 ? Math.round(Number(config.count)) : 3;
    const legacyAction = typeof config.action === 'string' && config.action.trim() ? config.action.toUpperCase() : 'DELETE';
    const legacyDurationText =
        typeof config.durationText === 'string'
            ? config.durationText.trim()
            : typeof config.duration === 'string'
                ? config.duration.trim()
                : '';

    const actions = Array.isArray(config.actions)
        ? config.actions
            .map((action) => normalizeFloodActionRow(action, legacyCount))
            .filter((action): action is AutomodFloodAction => Boolean(action))
        : [];

    return {
        scope: config.scope === 'channel' ? 'channel' : 'server',
        windowValue: Number.isFinite(windowShape.windowValue) && windowShape.windowValue > 0 ? windowShape.windowValue : 1,
        windowUnit: windowShape.windowUnit,
        ignoredChannels: asStringArray(config.ignoredChannels),
        actions: actions.length ? actions : [{
            messageCount: legacyCount,
            action: legacyAction,
            durationText: legacyDurationText,
        }],
    };
}

function normalizeMentionSpamConfig(value: unknown): AutomodMentionSpamConfig {
    const config = isRecord(value) ? value : {};
    const legacyWindowMs = typeof config.windowMs === 'number' && Number.isFinite(config.windowMs) ? config.windowMs : null;
    const windowShape = legacyWindowMs !== null
        ? convertMsToFloodWindow(legacyWindowMs)
        : {
            windowValue: Number(config.windowValue ?? 1),
            windowUnit: normalizeFloodWindowUnit(config.windowUnit),
        };
    const legacyCount = Number.isFinite(Number(config.count)) && Number(config.count) > 0 ? Math.round(Number(config.count)) : 1;
    const legacyAction = typeof config.action === 'string' && config.action.trim() ? config.action.toUpperCase() : 'DELETE';
    const legacyDurationText =
        typeof config.durationText === 'string'
            ? config.durationText.trim()
            : typeof config.duration === 'string'
                ? config.duration.trim()
                : '';

    const actions = Array.isArray(config.actions)
        ? config.actions
            .map((action) => normalizeFloodActionRow(action, legacyCount))
            .filter((action): action is AutomodFloodAction => Boolean(action))
        : [];

    return {
        userMentions: config.userMentions !== false,
        roleMentions: config.roleMentions !== false,
        ignoredChannels: asStringArray(config.ignoredChannels),
        windowValue: Number.isFinite(windowShape.windowValue) && windowShape.windowValue > 0 ? windowShape.windowValue : 1,
        windowUnit: windowShape.windowUnit,
        actions: actions.length ? actions : [{
            messageCount: legacyCount,
            action: legacyAction,
            durationText: legacyDurationText,
        }],
    };
}

function normalizeEmojiConfig(value: unknown): AutomodEmojiConfig {
    const config = isRecord(value) ? value : {};
    const legacyCount = Number.isFinite(Number(config.count)) && Number(config.count) > 0 ? Math.round(Number(config.count)) : 1;
    const legacyAction = typeof config.action === 'string' && config.action.trim() ? config.action.toUpperCase() : 'DELETE';
    const legacyDurationText =
        typeof config.durationText === 'string'
            ? config.durationText.trim()
            : typeof config.duration === 'string'
                ? config.duration.trim()
                : '';

    const actions = Array.isArray(config.actions)
        ? config.actions
            .map((action) => normalizeFloodActionRow(action, legacyCount))
            .filter((action): action is AutomodFloodAction => Boolean(action))
        : [];

    return {
        emojiOnlyChannelIds: asStringArray(config.emojiOnlyChannelIds),
        denyEmojiChannelIds: asStringArray(config.denyEmojiChannelIds),
        actions: actions.length ? actions : [{
            messageCount: legacyCount,
            action: legacyAction,
            durationText: legacyDurationText,
        }],
    };
}

function normalizeEmojiSpamConfig(value: unknown): AutomodEmojiSpamConfig {
    const config = isRecord(value) ? value : {};
    const legacyCount = Number.isFinite(Number(config.count)) && Number(config.count) > 0 ? Math.round(Number(config.count)) : 8;
    const legacyAction = typeof config.action === 'string' && config.action.trim() ? config.action.toUpperCase() : 'DELETE';
    const legacyDurationText =
        typeof config.durationText === 'string'
            ? config.durationText.trim()
            : typeof config.duration === 'string'
                ? config.duration.trim()
                : '';

    const actions = Array.isArray(config.actions)
        ? config.actions
            .map((action) => normalizeFloodActionRow(action, 1))
            .filter((action): action is AutomodFloodAction => Boolean(action))
        : [];

    return {
        count: legacyCount,
        ignoredChannels: asStringArray(config.ignoredChannels),
        actions: actions.length ? actions : [{
            messageCount: 1,
            action: legacyAction,
            durationText: legacyDurationText,
        }],
    };
}

function normalizeLinesConfig(value: unknown): AutomodLinesConfig {
    const config = isRecord(value) ? value : {};
    const legacyAction = typeof config.action === 'string' && config.action.trim() ? config.action.toUpperCase() : 'DELETE';
    const legacyDurationText =
        typeof config.durationText === 'string'
            ? config.durationText.trim()
            : typeof config.duration === 'string'
                ? config.duration.trim()
                : '';

    const actions = Array.isArray(config.actions)
        ? config.actions
            .map((action) => normalizeActionConfigRow(action))
            .filter((action): action is AutomodActionConfig => Boolean(action))
        : [];

    return {
        count: Number.isFinite(Number(config.count)) && Number(config.count) > 0 ? Math.round(Number(config.count)) : 5,
        ignoredChannels: asStringArray(config.ignoredChannels),
        actions: actions.length ? actions : [{
            action: legacyAction,
            durationText: legacyDurationText,
        }],
    };
}

function normalizeLinksConfig(value: unknown): AutomodLinksConfig {
    const config = isRecord(value) ? value : {};
    const legacyAction = typeof config.action === 'string' && config.action.trim() ? config.action.toUpperCase() : 'DELETE';
    const legacyDurationText =
        typeof config.durationText === 'string'
            ? config.durationText.trim()
            : typeof config.duration === 'string'
                ? config.duration.trim()
                : '';

    const actions = Array.isArray(config.actions)
        ? config.actions
            .map((action) => normalizeActionConfigRow(action))
            .filter((action): action is AutomodActionConfig => Boolean(action))
        : [];

    return {
        mode: config.mode === 'blocklist' ? 'blocklist' : 'allowlist',
        ignoredChannels: asStringArray(config.ignoredChannels),
        domains: asStringArray(config.domains).map((domain) => domain.trim().toLowerCase()).filter(Boolean),
        actions: actions.length ? actions : [{
            action: legacyAction,
            durationText: legacyDurationText,
        }],
    };
}

function normalizeBanwordsConfig(value: unknown): AutomodBanwordsConfig {
    const config = isRecord(value) ? value : {};
    const legacyAction = typeof config.action === 'string' && config.action.trim() ? config.action.toUpperCase() : 'DELETE';
    const legacyDurationText =
        typeof config.durationText === 'string'
            ? config.durationText.trim()
            : typeof config.duration === 'string'
                ? config.duration.trim()
                : '';

    const actions = Array.isArray(config.actions)
        ? config.actions
            .map((action) => normalizeActionConfigRow(action))
            .filter((action): action is AutomodActionConfig => Boolean(action))
        : [];

    return {
        ignoredChannels: asStringArray(config.ignoredChannels),
        ignoredRoles: asStringArray(config.ignoredRoles),
        words: asStringArray(config.words).map((word) => word.trim()).filter(Boolean),
        matchWholeWordsOnly: config.matchWholeWordsOnly !== false,
        ignoreCase: config.ignoreCase !== false,
        actions: actions.length ? actions : [{
            action: legacyAction,
            durationText: legacyDurationText,
        }],
    };
}

function normalizeAdvertisingCategoryConfig(value: unknown): { enabled: boolean; actions: AutomodActionConfig[] } {
    const config = isRecord(value) ? value : {};
    const legacyAction = typeof config.action === 'string' && config.action.trim() ? config.action.toUpperCase() : 'DELETE';
    const legacyDurationText =
        typeof config.durationText === 'string'
            ? config.durationText.trim()
            : typeof config.duration === 'string'
                ? config.duration.trim()
                : '';

    const actions = Array.isArray(config.actions)
        ? config.actions
            .map((action) => normalizeActionConfigRow(action))
            .filter((action): action is AutomodActionConfig => Boolean(action))
        : [];

    return {
        enabled: config.enabled !== false,
        actions: actions.length ? actions : [{
            action: legacyAction,
            durationText: legacyDurationText,
        }],
    };
}

function normalizeAdvertisingConfig(value: unknown): AutomodAdvertisingConfig {
    const config = isRecord(value) ? value : {};

    return {
        ignoredChannels: asStringArray(config.ignoredChannels),
        discordInvites: normalizeAdvertisingCategoryConfig(config.discordInvites),
        referrals: {
            ...normalizeAdvertisingCategoryConfig(config.referrals),
            customDomains: asStringArray(isRecord(config.referrals) ? config.referrals.customDomains : []),
            customPhrases: asStringArray(isRecord(config.referrals) ? config.referrals.customPhrases : []),
            customCodeTokens: asStringArray(isRecord(config.referrals) ? config.referrals.customCodeTokens : []),
        },
        scamLinks: {
            ...normalizeAdvertisingCategoryConfig(config.scamLinks),
            customDomains: asStringArray(isRecord(config.scamLinks) ? config.scamLinks.customDomains : []),
            customPhrases: asStringArray(isRecord(config.scamLinks) ? config.scamLinks.customPhrases : []),
        },
    };
}

function normalizeCommandChannelsConfig(value: unknown): AutomodCommandChannelsConfig {
    const config = isRecord(value) ? value : {};
    const legacyAction = typeof config.action === 'string' && config.action.trim() ? config.action.toUpperCase() : 'DELETE';
    const legacyDurationText =
        typeof config.durationText === 'string'
            ? config.durationText.trim()
            : typeof config.duration === 'string'
                ? config.duration.trim()
                : '';

    const actions = Array.isArray(config.actions)
        ? config.actions
            .map((action) => normalizeActionConfigRow(action))
            .filter((action): action is AutomodActionConfig => Boolean(action))
        : [];

    return {
        mode: config.mode === 'blocklist' ? 'blocklist' : 'allowlist',
        channelIds: asStringArray(config.channelIds ?? config.channels),
        actions: actions.length ? actions : [{
            action: legacyAction,
            durationText: legacyDurationText,
        }],
    };
}

function normalizeImageFilterConfig(value: unknown): AutomodImageFilterConfig {
    const config = isRecord(value) ? value : {};
    const legacyAction = typeof config.action === 'string' && config.action.trim() ? config.action.toUpperCase() : 'DELETE';
    const legacyDurationText =
        typeof config.durationText === 'string'
            ? config.durationText.trim()
            : typeof config.duration === 'string'
                ? config.duration.trim()
                : '';

    const actions = Array.isArray(config.actions)
        ? config.actions
            .map((action) => normalizeActionConfigRow(action))
            .filter((action): action is AutomodActionConfig => Boolean(action))
        : [];

    return {
        ignoredChannels: asStringArray(config.ignoredChannels),
        imageOnlyChannelIds: asStringArray(config.imageOnlyChannelIds),
        denyImageChannelIds: asStringArray(config.denyImageChannelIds),
        actions: actions.length ? actions : [{
            action: legacyAction,
            durationText: legacyDurationText,
        }],
    };
}

export function normalizeCommandRules(rules: unknown, grants: unknown): CommandRule[] {
    const defaults = createDefaultCommandRules();

    if (Array.isArray(rules)) {
        const saved = rules.map((rule) => ({
            commandKey: typeof rule?.commandKey === 'string' ? rule.commandKey : '',
            enabled: rule?.enabled !== false,
            roleMode: rule?.roleMode === 'WHITELIST' ? ('WHITELIST' as const) : ('BLACKLIST' as const),
            roleIds: Array.isArray(rule?.roleIds) ? rule.roleIds.filter((item: unknown): item is string => typeof item === 'string') : [],
            channelMode: rule?.channelMode === 'WHITELIST' ? ('WHITELIST' as const) : ('BLACKLIST' as const),
            channelIds: Array.isArray(rule?.channelIds) ? rule.channelIds.filter((item: unknown): item is string => typeof item === 'string') : [],
            requiredAccessLevel: typeof rule?.requiredAccessLevel === 'number' ? Number(rule.requiredAccessLevel) : null,
        })).filter((rule) => rule.commandKey);

        const savedMap = new Map(saved.map((rule) => [rule.commandKey, rule]));
        return defaults.map((defaultRule) => {
            const savedRule = savedMap.get(defaultRule.commandKey);
            if (!savedRule) {
                return defaultRule;
            }

            return {
                ...defaultRule,
                ...savedRule,
                requiredAccessLevel:
                    typeof savedRule.requiredAccessLevel === 'number'
                        ? savedRule.requiredAccessLevel
                        : defaultRule.requiredAccessLevel,
            };
        });
    }

    if (!Array.isArray(grants)) {
        return defaults;
    }

    const byCommand = new Map<string, CommandRule>();

    for (const grant of grants) {
        if (grant?.scopeType !== 'COMMAND' || typeof grant?.scopeKey !== 'string' || typeof grant?.roleId !== 'string' || !grant.roleId) {
            continue;
        }

        const current: CommandRule = byCommand.get(grant.scopeKey) ?? {
            commandKey: grant.scopeKey,
            enabled: true,
            roleMode: grant.effect === 'ALLOW' ? 'WHITELIST' : 'BLACKLIST',
            roleIds: [],
            channelMode: 'BLACKLIST',
            channelIds: [],
            requiredAccessLevel: getDefaultCommandRule(grant.scopeKey).requiredAccessLevel,
        };

        current.enabled = true;
        current.roleMode = grant.effect === 'ALLOW' ? 'WHITELIST' : 'BLACKLIST';
        if (!current.roleIds.includes(grant.roleId)) {
            current.roleIds.push(grant.roleId);
        }
        byCommand.set(grant.scopeKey, current);
    }

    const legacyMap = new Map(Array.from(byCommand.values()).map((rule) => [rule.commandKey, rule]));
    return defaults.map((defaultRule) => legacyMap.get(defaultRule.commandKey) ?? defaultRule);
}

export function buildConfigStateFromResponse(cData: unknown): ConfigState {
    const data = asObject(cData);
    const moderationConfig = asObject(data.moderationConfig);
    const aiConfig = asObject(data.aiConfig);
    const appealConfig = asObject(data.appealConfig);

    return {
        roles: asTypedArray<ConfigState['roles'][number]>(data.roles),
        channels: asTypedArray<ConfigState['channels'][number]>(data.channels),
        moderationConfig: {
            muteRoleId: typeof moderationConfig.muteRoleId === 'string' ? moderationConfig.muteRoleId : '',
            ignoredChannels: asStringArray(moderationConfig.ignoredChannels),
            ignoredRoles: asStringArray(moderationConfig.ignoredRoles),
            ignoredUsers: asStringArray(moderationConfig.ignoredUsers),
            commandOnlyChannels: asStringArray(moderationConfig.commandOnlyChannels),
        },
        roleBindings: asArray(data.roleBindings).map((rawBinding, index) => {
            const binding = asObject(rawBinding);
            return {
                roleId: typeof binding.roleId === 'string' ? binding.roleId : '',
                title: typeof binding.title === 'string' ? binding.title : '',
                accessLevel: Number(binding.accessLevel ?? 50),
                enabled: binding.enabled !== false,
                sortOrder: Number(binding.sortOrder ?? index),
            };
        }),
        commandGrants: asArray(data.commandGrants).map((rawGrant) => {
            const grant = asObject(rawGrant);
            return {
                roleId: typeof grant.roleId === 'string' ? grant.roleId : '',
                scopeType: grant.scopeType === 'GROUP' ? 'GROUP' : 'COMMAND',
                scopeKey: typeof grant.scopeKey === 'string' ? grant.scopeKey : '',
                effect: grant.effect === 'DENY' ? 'DENY' : 'ALLOW',
            };
        }),
        commandRules: normalizeCommandRules(data.commandRules, data.commandGrants),
        automodRules: asArray(data.automodRules).map((rawRule) => {
            const rule = asObject(rawRule);
            const config = isRecord(rule.config) ? rule.config : null;
            return {
                ruleKey: typeof rule.ruleKey === 'string' ? rule.ruleKey : '',
                enabled: rule.enabled === true,
                configText: config ? JSON.stringify(config, null, 2) : '',
                ...(typeof rule.ruleKey === 'string' && rule.ruleKey === 'flood' ? { floodConfig: normalizeFloodConfig(config) } : {}),
                ...(typeof rule.ruleKey === 'string' && rule.ruleKey === 'zalgo' ? { zalgoConfig: normalizeZalgoConfig(config) } : {}),
                ...(typeof rule.ruleKey === 'string' && rule.ruleKey === 'emoji' ? { emojiConfig: normalizeEmojiConfig(config) } : {}),
                ...(typeof rule.ruleKey === 'string' && rule.ruleKey === 'emoji_spam' ? { emojiSpamConfig: normalizeEmojiSpamConfig(config) } : {}),
                ...(typeof rule.ruleKey === 'string' && rule.ruleKey === 'repeated_messages' ? { spamConfig: normalizeSpamConfig(config) } : {}),
                ...(typeof rule.ruleKey === 'string' && rule.ruleKey === 'repeated_mentions' ? { mentionSpamConfig: normalizeMentionSpamConfig(config) } : {}),
                ...(typeof rule.ruleKey === 'string' && rule.ruleKey === 'lines' ? { linesConfig: normalizeLinesConfig(config) } : {}),
                ...(typeof rule.ruleKey === 'string' && rule.ruleKey === 'links' ? { linksConfig: normalizeLinksConfig(config) } : {}),
                ...(typeof rule.ruleKey === 'string' && rule.ruleKey === 'banwords' ? { banwordsConfig: normalizeBanwordsConfig(config) } : {}),
                ...(typeof rule.ruleKey === 'string' && rule.ruleKey === 'advertising' ? { advertisingConfig: normalizeAdvertisingConfig(config) } : {}),
                ...(typeof rule.ruleKey === 'string' && rule.ruleKey === 'command_channels' ? { commandChannelsConfig: normalizeCommandChannelsConfig(config) } : {}),
                ...(typeof rule.ruleKey === 'string' && rule.ruleKey === 'image_filter' ? { imageFilterConfig: normalizeImageFilterConfig(config) } : {}),
            };
        }),
        customRules: asArray(data.customRules).map((rawCustomRule) => {
            const customRule = asObject(rawCustomRule);
            return {
                name: typeof customRule.name === 'string' ? customRule.name : '',
                ruleType: typeof customRule.ruleType === 'string' ? customRule.ruleType : 'regex',
                pattern: typeof customRule.pattern === 'string' ? customRule.pattern : '',
                enabled: customRule.enabled !== false,
                action: typeof customRule.action === 'string' ? customRule.action : 'DELETE',
                strikeWeight: Number(customRule.strikeWeight ?? 1),
                notes: typeof customRule.notes === 'string' ? customRule.notes : '',
            };
        }),
        sanctionSteps: asArray(data.sanctionSteps).map((rawStep, index) => {
            const step = asObject(rawStep);
            return {
                triggerStrikeCount: Number(step.triggerStrikeCount ?? index + 1),
                actionType: typeof step.actionType === 'string' ? step.actionType : 'TIMEOUT',
                durationMinutes: step.durationMinutes === null ? null : Number(step.durationMinutes),
                enabled: step.enabled !== false,
                sortOrder: Number(step.sortOrder ?? index),
            };
        }),
        aiConfig: {
            enabled: aiConfig.enabled === true,
            provider: typeof aiConfig.provider === 'string' ? aiConfig.provider : '',
            model: typeof aiConfig.model === 'string' ? aiConfig.model : '',
            defaultThreshold: Number(aiConfig.defaultThreshold ?? 80),
            scanEdits: aiConfig.scanEdits !== false,
            includedChannels: asStringArray(aiConfig.includedChannels),
            excludedChannels: asStringArray(aiConfig.excludedChannels),
            exemptRoles: asStringArray(aiConfig.exemptRoles),
            exemptUsers: asStringArray(aiConfig.exemptUsers),
            customPolicyPrompt: typeof aiConfig.customPolicyPrompt === 'string' ? aiConfig.customPolicyPrompt : '',
        },
        aiCategories: asArray(data.aiCategories).map((rawCategory, index) => {
            const category = asObject(rawCategory);
            return {
                category: typeof category.category === 'string' ? category.category : `category_${index}`,
                enabled: category.enabled === true,
                threshold: Number(category.threshold ?? 80),
                sortOrder: Number(category.sortOrder ?? index),
            };
        }),
        appealConfig: {
            enabled: appealConfig.enabled === true,
            appealChannelId: typeof appealConfig.appealChannelId === 'string' ? appealConfig.appealChannelId : '',
            pardonLogChannelId: typeof appealConfig.pardonLogChannelId === 'string' ? appealConfig.pardonLogChannelId : '',
            allowUserAppeals: appealConfig.allowUserAppeals !== false,
            allowDirectPardon: appealConfig.allowDirectPardon !== false,
            ...normalizeAppealSettings(appealConfig),
        },
        retentionPolicies: asArray(data.retentionPolicies).map((rawPolicy) => {
            const policy = asObject(rawPolicy);
            return {
                category: typeof policy.category === 'string' ? policy.category : '',
                strategy: typeof policy.strategy === 'string' ? policy.strategy : 'KEEP',
                ttlDays: policy.ttlDays === null ? null : Number(policy.ttlDays),
                enabled: policy.enabled === true,
            };
        }),
    };
}

export function buildModerationSavePayload(config: ConfigState) {
    return {
        ...config,
        automodRules: config.automodRules.map((rule) => ({
            ruleKey: rule.ruleKey,
            enabled: rule.enabled,
            config:
                rule.ruleKey === 'flood'
                    ? {
                        ...(rule.floodConfig ?? normalizeFloodConfig(null)),
                        actions: rule.floodConfig?.actions ?? [],
                        ignoredChannels: rule.floodConfig?.ignoredChannels ?? [],
                        ignoredRoles: rule.floodConfig?.ignoredRoles ?? [],
                    }
                    : rule.ruleKey === 'zalgo'
                        ? {
                            ...(rule.zalgoConfig ?? normalizeZalgoConfig(null)),
                        }
                    : rule.ruleKey === 'emoji'
                        ? {
                            ...(rule.emojiConfig ?? normalizeEmojiConfig(null)),
                            emojiOnlyChannelIds: rule.emojiConfig?.emojiOnlyChannelIds ?? [],
                            denyEmojiChannelIds: rule.emojiConfig?.denyEmojiChannelIds ?? [],
                            actions: rule.emojiConfig?.actions ?? [],
                        }
                    : rule.ruleKey === 'emoji_spam'
                        ? {
                            ...(rule.emojiSpamConfig ?? normalizeEmojiSpamConfig(null)),
                            count: rule.emojiSpamConfig?.count ?? 8,
                            ignoredChannels: rule.emojiSpamConfig?.ignoredChannels ?? [],
                            actions: rule.emojiSpamConfig?.actions ?? [],
                        }
                    : rule.ruleKey === 'repeated_messages'
                        ? {
                            ...(rule.spamConfig ?? normalizeSpamConfig(null)),
                            scope: rule.spamConfig?.scope ?? 'server',
                            windowValue: rule.spamConfig?.windowValue ?? 1,
                            windowUnit: rule.spamConfig?.windowUnit ?? 'minutes',
                            ignoredChannels: rule.spamConfig?.ignoredChannels ?? [],
                            actions: rule.spamConfig?.actions ?? [],
                        }
                    : rule.ruleKey === 'repeated_mentions'
                        ? {
                            ...(rule.mentionSpamConfig ?? normalizeMentionSpamConfig(null)),
                            userMentions: rule.mentionSpamConfig?.userMentions ?? true,
                            roleMentions: rule.mentionSpamConfig?.roleMentions ?? true,
                            ignoredChannels: rule.mentionSpamConfig?.ignoredChannels ?? [],
                            windowValue: rule.mentionSpamConfig?.windowValue ?? 1,
                            windowUnit: rule.mentionSpamConfig?.windowUnit ?? 'minutes',
                            actions: rule.mentionSpamConfig?.actions ?? [],
                        }
                    : rule.ruleKey === 'lines'
                        ? {
                            ...(rule.linesConfig ?? normalizeLinesConfig(null)),
                            count: rule.linesConfig?.count ?? 5,
                            ignoredChannels: rule.linesConfig?.ignoredChannels ?? [],
                            actions: rule.linesConfig?.actions ?? [],
                        }
                    : rule.ruleKey === 'links'
                        ? {
                            ...(rule.linksConfig ?? normalizeLinksConfig(null)),
                            mode: rule.linksConfig?.mode ?? 'allowlist',
                            ignoredChannels: rule.linksConfig?.ignoredChannels ?? [],
                            domains: rule.linksConfig?.domains ?? [],
                            actions: rule.linksConfig?.actions ?? [],
                        }
                    : rule.ruleKey === 'banwords'
                        ? {
                            ...(rule.banwordsConfig ?? normalizeBanwordsConfig(null)),
                            ignoredChannels: rule.banwordsConfig?.ignoredChannels ?? [],
                            ignoredRoles: rule.banwordsConfig?.ignoredRoles ?? [],
                            words: rule.banwordsConfig?.words ?? [],
                            actions: rule.banwordsConfig?.actions ?? [],
                        }
                    : rule.ruleKey === 'advertising'
                        ? {
                            ...(rule.advertisingConfig ?? normalizeAdvertisingConfig(null)),
                            ignoredChannels: rule.advertisingConfig?.ignoredChannels ?? [],
                            discordInvites: {
                                ...(rule.advertisingConfig?.discordInvites ?? normalizeAdvertisingConfig(null).discordInvites),
                                actions: rule.advertisingConfig?.discordInvites.actions ?? [],
                            },
                            referrals: {
                                ...(rule.advertisingConfig?.referrals ?? normalizeAdvertisingConfig(null).referrals),
                                customDomains: rule.advertisingConfig?.referrals.customDomains ?? [],
                                customPhrases: rule.advertisingConfig?.referrals.customPhrases ?? [],
                                customCodeTokens: rule.advertisingConfig?.referrals.customCodeTokens ?? [],
                                actions: rule.advertisingConfig?.referrals.actions ?? [],
                            },
                            scamLinks: {
                                ...(rule.advertisingConfig?.scamLinks ?? normalizeAdvertisingConfig(null).scamLinks),
                                customDomains: rule.advertisingConfig?.scamLinks.customDomains ?? [],
                                customPhrases: rule.advertisingConfig?.scamLinks.customPhrases ?? [],
                                actions: rule.advertisingConfig?.scamLinks.actions ?? [],
                            },
                        }
                    : rule.ruleKey === 'command_channels'
                        ? {
                            ...(rule.commandChannelsConfig ?? normalizeCommandChannelsConfig(null)),
                            mode: rule.commandChannelsConfig?.mode ?? 'allowlist',
                            channelIds: rule.commandChannelsConfig?.channelIds ?? [],
                            actions: rule.commandChannelsConfig?.actions ?? [],
                        }
                    : rule.ruleKey === 'image_filter'
                        ? {
                            ...(rule.imageFilterConfig ?? normalizeImageFilterConfig(null)),
                            ignoredChannels: rule.imageFilterConfig?.ignoredChannels ?? [],
                            imageOnlyChannelIds: rule.imageFilterConfig?.imageOnlyChannelIds ?? [],
                            denyImageChannelIds: rule.imageFilterConfig?.denyImageChannelIds ?? [],
                            actions: rule.imageFilterConfig?.actions ?? [],
                        }
                    : (rule.configText.trim() ? JSON.parse(rule.configText) : null),
        })),
    };
}
