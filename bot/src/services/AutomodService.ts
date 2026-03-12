import { GuildMember, Message } from 'discord.js';
import { logAuditEvent } from '../utils/auditLog';
import { prisma } from '../utils/database';
import {
    createModerationCase,
    getModerationRuntimeSnapshot,
    isMissingModerationTableError,
    muteMember,
    parseJsonArray,
    timeoutMember,
} from './ModerationService';

type RecentMessage = {
    content: string;
    createdAt: number;
};

type TriggeredRule = {
    key: string;
    strikeWeight: number;
};

const DEFAULTS = {
    floodCount: 6,
    floodWindowMs: 10_000,
    duplicateCount: 3,
    duplicateWindowMs: 60_000,
    mentionsLimit: 5,
    emojiLimit: 8,
    zalgoLimit: 6,
    strikeTtlMs: 24 * 60 * 60 * 1000,
};

const recentMessages = new Map<string, RecentMessage[]>();
const strikeState = new Map<string, { count: number; updatedAt: number; lastAppliedThreshold: number }>();

function normalizeContent(content: string) {
    return content
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .replace(/[^\p{L}\p{N}\s:/._-]+/gu, '')
        .trim();
}

function getRuleNumber(config: Record<string, unknown> | null, key: string, fallback: number) {
    const raw = config?.[key];
    return typeof raw === 'number' && Number.isFinite(raw) ? raw : fallback;
}

function getRuleString(config: Record<string, unknown> | null, key: string, fallback: string) {
    const raw = config?.[key];
    return typeof raw === 'string' && raw.trim().length ? raw.trim() : fallback;
}

function getRuleStringArray(config: Record<string, unknown> | null, key: string) {
    const raw = config?.[key];
    if (Array.isArray(raw)) {
        return raw.filter((item): item is string => typeof item === 'string');
    }

    if (typeof raw === 'string') {
        return parseJsonArray(raw);
    }

    return [];
}

function recordRecentMessage(guildId: string, userId: string, content: string, createdAt: number) {
    const key = `${guildId}:${userId}`;
    const bucket = recentMessages.get(key) ?? [];
    bucket.push({ content, createdAt });
    recentMessages.set(
        key,
        bucket.filter((entry) => createdAt - entry.createdAt <= DEFAULTS.duplicateWindowMs)
    );

    return recentMessages.get(key) ?? [];
}

function countEmoji(content: string) {
    const unicode = content.match(/[\p{Extended_Pictographic}]/gu) ?? [];
    const custom = content.match(/<a?:\w+:\d+>/g) ?? [];
    return unicode.length + custom.length;
}

function countZalgo(content: string) {
    return (content.match(/[\u0300-\u036f]/g) ?? []).length;
}

function hasRepeatedStrings(content: string) {
    return /(.)\1{14,}/i.test(content) || /\b(\w+)(?:\s+\1){4,}\b/i.test(content);
}

function hasLink(content: string) {
    return /(https?:\/\/|www\.|discord\.gg\/|discord\.com\/invite\/)/i.test(content);
}

function hasAdvertising(content: string) {
    return /(subscribe|follow|promo|advert|bitcoin|crypto|ethereum|invest|earn money|легкие деньги|быстрый заработок)/i.test(content);
}

function detectImageViolation(message: Message, config: Record<string, unknown> | null) {
    if (!message.attachments.size) return false;

    const blockAll = config?.blockAll === true;
    const maxSizeMb = getRuleNumber(config, 'maxSizeMb', 0);
    const blockedExtensions = new Set(
        getRuleStringArray(config, 'blockedExtensions').map((value) => value.toLowerCase())
    );

    return message.attachments.some((attachment) => {
        const extension = attachment.name?.split('.').pop()?.toLowerCase() ?? '';
        const sizeMb = attachment.size / (1024 * 1024);
        if (blockAll) return true;
        if (maxSizeMb > 0 && sizeMb > maxSizeMb) return true;
        if (extension && blockedExtensions.has(extension)) return true;
        return false;
    });
}

async function safeCreateAutomodCase(input: {
    guildId: string;
    targetUserId: string;
    actionType: string;
    reason: string;
    metadata?: Record<string, unknown>;
}) {
    try {
        return await createModerationCase({
            guildId: input.guildId,
            actionType: input.actionType,
            source: 'automod',
            targetUserId: input.targetUserId,
            reason: input.reason,
            metadata: input.metadata ?? null,
        });
    } catch (error) {
        if (isMissingModerationTableError(error)) {
            return null;
        }

        throw error;
    }
}

async function applyEscalation(member: GuildMember, strikeCount: number, triggeredRules: string[]) {
    const stateKey = `${member.guild.id}:${member.id}`;
    const strikeInfo = strikeState.get(stateKey);
    const snapshot = await getModerationRuntimeSnapshot(member.guild.id);
    if (!snapshot) return;

    const nextStep = snapshot.sanctionSteps.find(
        (step) =>
            step.enabled &&
            step.triggerStrikeCount <= strikeCount &&
            step.triggerStrikeCount > (strikeInfo?.lastAppliedThreshold ?? 0)
    );

    if (!nextStep) return;

    const reason = `AutoMod escalation at ${strikeCount} strikes (${triggeredRules.join(', ')})`;

    try {
        switch (nextStep.actionType.toUpperCase()) {
            case 'TIMEOUT':
                if (nextStep.durationMinutes && nextStep.durationMinutes > 0) {
                    await timeoutMember({
                        member,
                        actorUserId: 'automod',
                        durationMinutes: nextStep.durationMinutes,
                        reason,
                    });
                }
                break;
            case 'MUTE':
                await muteMember({ member, actorUserId: 'automod', reason });
                break;
            case 'KICK':
                await member.kick(reason);
                await safeCreateAutomodCase({
                    guildId: member.guild.id,
                    targetUserId: member.id,
                    actionType: 'AUTOMOD_KICK',
                    reason,
                    metadata: { triggerStrikeCount: strikeCount, rules: triggeredRules },
                });
                break;
            case 'BAN':
                await member.guild.members.ban(member.id, { reason });
                await safeCreateAutomodCase({
                    guildId: member.guild.id,
                    targetUserId: member.id,
                    actionType: 'AUTOMOD_BAN',
                    reason,
                    metadata: { triggerStrikeCount: strikeCount, rules: triggeredRules },
                });
                break;
            default:
                await safeCreateAutomodCase({
                    guildId: member.guild.id,
                    targetUserId: member.id,
                    actionType: 'AUTOMOD_WARN',
                    reason,
                    metadata: { triggerStrikeCount: strikeCount, rules: triggeredRules },
                });
                break;
        }

        strikeState.set(stateKey, {
            count: strikeCount,
            updatedAt: Date.now(),
            lastAppliedThreshold: nextStep.triggerStrikeCount,
        });
    } catch (error) {
        if (!isMissingModerationTableError(error)) {
            console.error('[AutomodService] Failed to apply escalation:', error);
        }
    }
}

async function applyStrikeState(member: GuildMember, triggeredRules: TriggeredRule[]) {
    const strikeWeight = triggeredRules.reduce((sum, rule) => sum + rule.strikeWeight, 0);
    const strikeKey = `${member.guild.id}:${member.id}`;
    const currentStrikeState = strikeState.get(strikeKey);
    const expired = !currentStrikeState || Date.now() - currentStrikeState.updatedAt > DEFAULTS.strikeTtlMs;
    const nextStrikeCount = (expired ? 0 : currentStrikeState.count) + strikeWeight;

    strikeState.set(strikeKey, {
        count: nextStrikeCount,
        updatedAt: Date.now(),
        lastAppliedThreshold: expired ? 0 : currentStrikeState.lastAppliedThreshold,
    });

    await applyEscalation(member, nextStrikeCount, triggeredRules.map((rule) => rule.key));
    return { strikeWeight, strikeCount: nextStrikeCount };
}

async function applyCustomRuleActions(member: GuildMember, matchedRules: Array<{ name: string; action: string }>) {
    const normalizedActions = matchedRules.map((rule) => rule.action.toUpperCase());
    const reason = `Matched custom rules: ${matchedRules.map((rule) => rule.name).join(', ')}`;

    if (normalizedActions.includes('KICK')) {
        await member.kick(reason);
        return 'KICK';
    }

    if (normalizedActions.includes('MUTE')) {
        await muteMember({
            member,
            actorUserId: 'automod',
            reason,
        });
        return 'MUTE';
    }

    if (normalizedActions.includes('TIMEOUT')) {
        await timeoutMember({
            member,
            actorUserId: 'automod',
            durationMinutes: 60,
            reason,
        });
        return 'TIMEOUT';
    }

    if (normalizedActions.includes('WARN')) {
        await safeCreateAutomodCase({
            guildId: member.guild.id,
            targetUserId: member.id,
            actionType: 'AUTOMOD_WARN',
            reason,
            metadata: {
                customRules: matchedRules.map((rule) => rule.name),
            },
        });
        return 'WARN';
    }

    return 'DELETE';
}

export async function processMessageForAutomod(message: Message) {
    if (!message.guild || message.author.bot || !message.member) return;

    const snapshot = await getModerationRuntimeSnapshot(message.guild.id).catch((error) => {
        console.error('[AutomodService] Failed to load moderation snapshot:', error);
        return null;
    });
    if (!snapshot) return;

    const roleIds = new Set(message.member.roles.cache.keys());
    if (
        snapshot.moderationConfig.ignoredChannels.includes(message.channel.id) ||
        snapshot.moderationConfig.ignoredUsers.includes(message.author.id) ||
        snapshot.moderationConfig.ignoredRoles.some((roleId) => roleIds.has(roleId))
    ) {
        return;
    }

    const normalized = normalizeContent(message.content);
    const now = message.createdTimestamp;
    const history = recordRecentMessage(message.guild.id, message.author.id, normalized, now);
    const triggeredRules: Array<{ key: string; strikeWeight: number }> = [];

    const pushRule = (key: string, strikeWeight = 1) => {
        if (!triggeredRules.some((rule) => rule.key === key)) {
            triggeredRules.push({ key, strikeWeight });
        }
    };

    const floodRule = snapshot.automodRules.get('flood');
    if (floodRule?.enabled) {
        const floodCount = getRuleNumber(floodRule.config, 'count', DEFAULTS.floodCount);
        const floodWindowMs = getRuleNumber(floodRule.config, 'windowMs', DEFAULTS.floodWindowMs);
        const withinWindow = history.filter((entry) => now - entry.createdAt <= floodWindowMs);
        if (withinWindow.length >= floodCount) {
            pushRule('flood', getRuleNumber(floodRule.config, 'strikeWeight', 1));
        }
    }

    const duplicateRule = snapshot.automodRules.get('duplicate_messages');
    if (duplicateRule?.enabled && normalized.length) {
        const duplicateCount = getRuleNumber(duplicateRule.config, 'count', DEFAULTS.duplicateCount);
        const duplicateWindowMs = getRuleNumber(duplicateRule.config, 'windowMs', DEFAULTS.duplicateWindowMs);
        const duplicates = history.filter(
            (entry) => entry.content === normalized && now - entry.createdAt <= duplicateWindowMs
        );
        if (duplicates.length >= duplicateCount) {
            pushRule('duplicate_messages', getRuleNumber(duplicateRule.config, 'strikeWeight', 1));
        }
    }

    if (snapshot.automodRules.get('repeated_strings')?.enabled && hasRepeatedStrings(message.content)) {
        pushRule('repeated_strings');
    }

    if (
        snapshot.automodRules.get('mentions_spam')?.enabled &&
        message.mentions.users.filter((user) => !user.bot).size >=
            getRuleNumber(snapshot.automodRules.get('mentions_spam')?.config ?? null, 'count', DEFAULTS.mentionsLimit)
    ) {
        pushRule('mentions_spam');
    }

    if (snapshot.automodRules.get('links')?.enabled && hasLink(message.content)) {
        pushRule('links');
    }

    if (snapshot.automodRules.get('advertising')?.enabled && (hasAdvertising(message.content) || hasLink(message.content))) {
        pushRule('advertising');
    }

    if (
        snapshot.automodRules.get('emoji_spam')?.enabled &&
        countEmoji(message.content) >=
            getRuleNumber(snapshot.automodRules.get('emoji_spam')?.config ?? null, 'count', DEFAULTS.emojiLimit)
    ) {
        pushRule('emoji_spam');
    }

    if (
        snapshot.automodRules.get('zalgo')?.enabled &&
        countZalgo(message.content) >=
            getRuleNumber(snapshot.automodRules.get('zalgo')?.config ?? null, 'count', DEFAULTS.zalgoLimit)
    ) {
        pushRule('zalgo');
    }

    if (
        snapshot.automodRules.get('command_only')?.enabled &&
        snapshot.moderationConfig.commandOnlyChannels.includes(message.channel.id) &&
        !message.content.startsWith('/') &&
        !message.content.startsWith(snapshot.prefix)
    ) {
        pushRule('command_only');
    }

    if (snapshot.automodRules.get('image_filter')?.enabled && detectImageViolation(message, snapshot.automodRules.get('image_filter')?.config ?? null)) {
        pushRule('image_filter');
    }

    if (!triggeredRules.length) return;

    const deleted = message.deletable ? await message.delete().then(() => true).catch(() => false) : false;
    const { strikeWeight, strikeCount: nextStrikeCount } = await applyStrikeState(message.member, triggeredRules);

    await safeCreateAutomodCase({
        guildId: message.guild.id,
        targetUserId: message.author.id,
        actionType: deleted ? 'AUTOMOD_DELETE' : 'AUTOMOD_HIT',
        reason: `Triggered rules: ${triggeredRules.map((rule) => rule.key).join(', ')}`,
        metadata: {
            channelId: message.channel.id,
            messageId: message.id,
            rules: triggeredRules.map((rule) => rule.key),
            strikeWeight,
            strikeCount: nextStrikeCount,
            deleted,
        },
    });

    await logAuditEvent(message.client, {
        guildId: message.guild.id,
        tag: 'automod',
        actorId: null,
        targetId: message.author.id,
        channelId: message.channel.id,
        messageId: message.id,
        payload: {
            event: 'automod_trigger',
            rules: triggeredRules.map((rule) => rule.key),
            strikeWeight,
            strikeCount: nextStrikeCount,
            deleted,
            reason: `Triggered rules: ${triggeredRules.map((rule) => rule.key).join(', ')}`,
            contentAfter: message.content,
        },
        severity: 'WARN',
    });

}

export async function processCustomRulesForAutomod(message: Message) {
    if (!message.guild || message.author.bot || !message.member) return;

    try {
        const snapshot = await getModerationRuntimeSnapshot(message.guild.id);
        if (!snapshot) return;

        const roleIds = new Set(message.member.roles.cache.keys());
        if (
            snapshot.moderationConfig.ignoredChannels.includes(message.channel.id) ||
            snapshot.moderationConfig.ignoredUsers.includes(message.author.id) ||
            snapshot.moderationConfig.ignoredRoles.some((roleId) => roleIds.has(roleId))
        ) {
            return;
        }

        const customRules = await prisma.automodCustomRule.findMany({
            where: {
                guildId: message.guild.id,
                enabled: true,
            },
            orderBy: { createdAt: 'asc' },
        });

        if (!customRules.length) return;

        const normalized = normalizeContent(message.content);
        const matched = customRules.filter((rule) => {
            if (rule.ruleType === 'keyword-list') {
                return rule.pattern
                    .split('|')
                    .map((item) => item.trim().toLowerCase())
                    .filter(Boolean)
                    .some((token) => normalized.includes(token));
            }

            try {
                return new RegExp(rule.pattern, 'i').test(message.content);
            } catch {
                return false;
            }
        });

        if (!matched.length) return;

        if (message.deletable) {
            await message.delete().catch(() => null);
        }

        const { strikeWeight, strikeCount } = await applyStrikeState(
            message.member,
            matched.map((rule) => ({
                key: `custom:${rule.name}`,
                strikeWeight: rule.strikeWeight,
            }))
        );
        const appliedAction = await applyCustomRuleActions(
            message.member,
            matched.map((rule) => ({
                name: rule.name,
                action: rule.action,
            }))
        );

        await safeCreateAutomodCase({
            guildId: message.guild.id,
            targetUserId: message.author.id,
            actionType: 'AUTOMOD_CUSTOM_RULE',
            reason: `Matched custom rules: ${matched.map((rule) => rule.name).join(', ')}`,
            metadata: {
                messageId: message.id,
                channelId: message.channel.id,
                appliedAction,
                strikeWeight,
                strikeCount,
                customRules: matched.map((rule) => ({
                    name: rule.name,
                    action: rule.action,
                    strikeWeight: rule.strikeWeight,
                })),
            },
        });

        await logAuditEvent(message.client, {
            guildId: message.guild.id,
            tag: 'automod',
            actorId: null,
            targetId: message.author.id,
            channelId: message.channel.id,
            messageId: message.id,
            payload: {
                event: 'automod_custom_rule',
                reason: `Matched custom rules: ${matched.map((rule) => rule.name).join(', ')}`,
                appliedAction,
                strikeWeight,
                strikeCount,
                contentAfter: message.content,
            },
            severity: 'WARN',
        });
    } catch (error) {
        if (!isMissingModerationTableError(error)) {
            console.error('[AutomodService] Failed to process custom rules:', error);
        }
    }
}
