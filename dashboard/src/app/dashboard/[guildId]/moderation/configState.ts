import { CommandRule, ConfigState } from './types';
import { createDefaultCommandRules, getDefaultCommandRule } from '@/lib/commandCatalog';

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

export function buildConfigStateFromResponse(cData: any): ConfigState {
    return {
        roles: cData.roles ?? [],
        channels: cData.channels ?? [],
        moderationConfig: {
            muteRoleId: cData.moderationConfig?.muteRoleId ?? '',
            ignoredChannels: cData.moderationConfig?.ignoredChannels ?? [],
            ignoredRoles: cData.moderationConfig?.ignoredRoles ?? [],
            ignoredUsers: cData.moderationConfig?.ignoredUsers ?? [],
            commandOnlyChannels: cData.moderationConfig?.commandOnlyChannels ?? [],
        },
        roleBindings: (cData.roleBindings ?? []).map((binding: any, index: number) => ({
            roleId: binding.roleId ?? '',
            title: binding.title ?? 'Moderator',
            accessLevel: Number(binding.accessLevel ?? 50),
            enabled: binding.enabled !== false,
            sortOrder: Number(binding.sortOrder ?? index),
        })),
        commandGrants: (cData.commandGrants ?? []).map((grant: any) => ({
            roleId: grant.roleId ?? '',
            scopeType: grant.scopeType === 'GROUP' ? 'GROUP' : 'COMMAND',
            scopeKey: grant.scopeKey ?? '',
            effect: grant.effect === 'DENY' ? 'DENY' : 'ALLOW',
        })),
        commandRules: normalizeCommandRules(cData.commandRules, cData.commandGrants),
        automodRules: (cData.automodRules ?? []).map((rule: any) => ({
            ruleKey: rule.ruleKey,
            enabled: rule.enabled === true,
            configText: rule.config ? JSON.stringify(rule.config, null, 2) : '',
        })),
        customRules: (cData.customRules ?? []).map((customRule: any) => ({
            name: customRule.name ?? '',
            ruleType: customRule.ruleType ?? 'regex',
            pattern: customRule.pattern ?? '',
            enabled: customRule.enabled !== false,
            action: customRule.action ?? 'DELETE',
            strikeWeight: Number(customRule.strikeWeight ?? 1),
            notes: customRule.notes ?? '',
        })),
        sanctionSteps: (cData.sanctionSteps ?? []).map((step: any, index: number) => ({
            triggerStrikeCount: Number(step.triggerStrikeCount ?? index + 1),
            actionType: step.actionType ?? 'TIMEOUT',
            durationMinutes: step.durationMinutes === null ? null : Number(step.durationMinutes),
            enabled: step.enabled !== false,
            sortOrder: Number(step.sortOrder ?? index),
        })),
        aiConfig: {
            enabled: cData.aiConfig?.enabled === true,
            provider: cData.aiConfig?.provider ?? '',
            model: cData.aiConfig?.model ?? '',
            defaultThreshold: Number(cData.aiConfig?.defaultThreshold ?? 80),
            scanEdits: cData.aiConfig?.scanEdits !== false,
            includedChannels: cData.aiConfig?.includedChannels ?? [],
            excludedChannels: cData.aiConfig?.excludedChannels ?? [],
            exemptRoles: cData.aiConfig?.exemptRoles ?? [],
            exemptUsers: cData.aiConfig?.exemptUsers ?? [],
            customPolicyPrompt: cData.aiConfig?.customPolicyPrompt ?? '',
        },
        aiCategories: (cData.aiCategories ?? []).map((category: any, index: number) => ({
            category: category.category ?? `category_${index}`,
            enabled: category.enabled === true,
            threshold: Number(category.threshold ?? 80),
            sortOrder: Number(category.sortOrder ?? index),
        })),
        appealConfig: {
            enabled: cData.appealConfig?.enabled === true,
            appealChannelId: cData.appealConfig?.appealChannelId ?? '',
            pardonLogChannelId: cData.appealConfig?.pardonLogChannelId ?? '',
            allowUserAppeals: cData.appealConfig?.allowUserAppeals !== false,
            allowDirectPardon: cData.appealConfig?.allowDirectPardon !== false,
        },
        retentionPolicies: (cData.retentionPolicies ?? []).map((policy: any) => ({
            category: policy.category ?? '',
            strategy: policy.strategy ?? 'KEEP',
            ttlDays: policy.ttlDays === null ? null : Number(policy.ttlDays),
            enabled: policy.enabled === true,
        })),
    };
}

export function buildModerationSavePayload(config: ConfigState) {
    return {
        ...config,
        automodRules: config.automodRules.map((rule) => ({
            ruleKey: rule.ruleKey,
            enabled: rule.enabled,
            config: rule.configText.trim() ? JSON.parse(rule.configText) : null,
        })),
    };
}
