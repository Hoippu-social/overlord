import { Attachment, GuildMember, Message } from 'discord.js';
import { logAuditEvent } from '../utils/auditLog';
import { prisma } from '../utils/database';
import { parseDurationToMinutes } from '../utils/moderationHelpers';
import {
    banUser,
    createModerationCase,
    getModerationRuntimeSnapshot,
    isMissingModerationTableError,
    kickMember,
    muteMember,
    parseJsonArray,
    tempbanUser,
    timeoutMember,
} from './ModerationService';

type RecentMessage = {
    content: string;
    channelId: string;
    createdAt: number;
};

type TriggeredRule = {
    key: string;
    strikeWeight: number;
};

const DEFAULTS = {
    floodCount: 6,
    floodWindowMs: 60_000,
    duplicateCount: 3,
    duplicateWindowMs: 60_000,
    mentionsLimit: 5,
    linesLimit: 5,
    emojiLimit: 8,
    emojiWindowMs: 60_000,
    zalgoLimit: 6,
    zalgoPercent: 10,
    zalgoWindowMs: 60_000,
    messageHistoryWindowMs: 24 * 60 * 60 * 1000,
    strikeTtlMs: 24 * 60 * 60 * 1000,
};

const recentMessages = new Map<string, RecentMessage[]>();
const recentRuleHits = new Map<string, number[]>();
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

function isRuleIgnoredForMessage(config: Record<string, unknown> | null, channelId: string, roleIds: Set<string>) {
    const ignoredChannels = getRuleStringArray(config, 'ignoredChannels');
    if (ignoredChannels.includes(channelId)) {
        return true;
    }

    const ignoredRoles = getRuleStringArray(config, 'ignoredRoles');
    return ignoredRoles.some((roleId) => roleIds.has(roleId));
}

function getFloodWindowMs(config: Record<string, unknown> | null) {
    const legacyWindowMs = getRuleNumber(config, 'windowMs', 0);
    if (legacyWindowMs > 0) {
        return legacyWindowMs;
    }

    const windowValue = getRuleNumber(config, 'windowValue', 1);
    const windowUnit = typeof config?.windowUnit === 'string' ? config.windowUnit : 'minutes';

    switch (windowUnit) {
        case 'seconds':
            return windowValue * 1000;
        case 'hours':
            return windowValue * 60 * 60 * 1000;
        case 'days':
            return windowValue * 24 * 60 * 60 * 1000;
        case 'minutes':
        default:
            return windowValue * 60 * 1000;
    }
}

type FloodActionConfig = {
    messageCount: number;
    action: string;
    durationText: string;
    durationMinutes: number | null;
};

type TimedActionConfig = {
    action: string;
    durationText: string;
    durationMinutes: number | null;
};

type ExtractedLink = {
    raw: string;
    url: URL;
    domain: string;
};

const ACTION_PRIORITY = ['BAN', 'KICK', 'TIMEOUT', 'MUTE', 'WARN', 'DELETE'];
const DISCORD_INVITE_DOMAINS = new Set(['discord.gg', 'discord.com']);
const REFERRAL_PARAM_KEYS = new Set(['ref', 'reff', 'refer', 'referral', 'aff', 'affiliate', 'invite', 'inviter', 'code', 'coupon', 'promo', 'partner', 'start', 'startapp']);
const REFERRAL_PATH_HINTS = ['/ref', '/refer', '/referral', '/affiliate', '/partner', '/promo', '/coupon', '/invite'];
const REFERRAL_PHRASES = [
    'use my code',
    'my code',
    'ref code',
    'promo code',
    'affiliate',
    'referral',
    'sign up with',
    'register with',
    'bonus',
    'ÃƒÂÃ‚Â¼ÃƒÂÃ‚Â¾ÃƒÂÃ‚Â¹ ÃƒÂÃ‚ÂºÃƒÂÃ‚Â¾ÃƒÂÃ‚Â´',
    'Ãƒâ€˜Ã¢â€šÂ¬ÃƒÂÃ‚ÂµÃƒâ€˜Ã¢â‚¬Å¾',
    'Ãƒâ€˜Ã¢â€šÂ¬ÃƒÂÃ‚ÂµÃƒâ€˜Ã¢â‚¬Å¾ÃƒÂÃ‚ÂµÃƒâ€˜Ã¢â€šÂ¬ÃƒÂÃ‚Â°ÃƒÂÃ‚Â»',
    'Ãƒâ€˜Ã¢â€šÂ¬ÃƒÂÃ‚ÂµÃƒâ€˜Ã¢â‚¬Å¾ÃƒÂÃ‚ÂµÃƒâ€˜Ã¢â€šÂ¬ÃƒÂÃ‚Â°ÃƒÂÃ‚Â»Ãƒâ€˜Ã…â€™',
    'ÃƒÂÃ‚Â¿Ãƒâ€˜Ã¢â€šÂ¬ÃƒÂÃ‚Â¾ÃƒÂÃ‚Â¼ÃƒÂÃ‚Â¾ÃƒÂÃ‚ÂºÃƒÂÃ‚Â¾ÃƒÂÃ‚Â´',
    'ÃƒÂÃ‚Â±ÃƒÂÃ‚Â¾ÃƒÂÃ‚Â½Ãƒâ€˜Ã†â€™Ãƒâ€˜Ã‚Â',
];
const REFERRAL_SERVICE_DOMAINS = ['binance.com', 'bybit.com', 'coinbase.com', 'kucoin.com', 'okx.com', 'temu.com', 'revolut.com'];
const SCAM_PHRASES = [
    'free nitro',
    'claim',
    'gift',
    'connect wallet',
    'wallet',
    'seed phrase',
    'verify',
    'login',
    'airdrop',
    'steam admin',
    'steam support',
    'trade offer',
    'skin giveaway',
    'crypto support',
    'bonus reward',
    'ÃƒÂÃ‚Â½ÃƒÂÃ‚Â¸Ãƒâ€˜Ã¢â‚¬Å¡Ãƒâ€˜Ã¢â€šÂ¬ÃƒÂÃ‚Â¾',
    'ÃƒÂÃ‚Â¿ÃƒÂÃ‚Â¾ÃƒÂÃ‚Â´ÃƒÂÃ‚Â°Ãƒâ€˜Ã¢â€šÂ¬ÃƒÂÃ‚Â¾ÃƒÂÃ‚Âº',
    'ÃƒÂÃ‚Â·ÃƒÂÃ‚Â°ÃƒÂÃ‚Â±ÃƒÂÃ‚ÂµÃƒâ€˜Ã¢â€šÂ¬ÃƒÂÃ‚Â¸',
    'ÃƒÂÃ‚ÂºÃƒÂÃ‚Â¾Ãƒâ€˜Ã‹â€ ÃƒÂÃ‚ÂµÃƒÂÃ‚Â»ÃƒÂÃ‚ÂµÃƒÂÃ‚Âº',
    'Ãƒâ€˜Ã‚ÂÃƒÂÃ‚Â¸ÃƒÂÃ‚Â´ Ãƒâ€˜Ã¢â‚¬Å¾Ãƒâ€˜Ã¢â€šÂ¬ÃƒÂÃ‚Â°ÃƒÂÃ‚Â·',
    'Ãƒâ€˜Ã‚ÂÃƒÂÃ‚Â¸ÃƒÂÃ‚Â´-Ãƒâ€˜Ã¢â‚¬Å¾Ãƒâ€˜Ã¢â€šÂ¬ÃƒÂÃ‚Â°ÃƒÂÃ‚Â·',
    'ÃƒÂÃ‚Â¿Ãƒâ€˜Ã¢â€šÂ¬ÃƒÂÃ‚Â¾ÃƒÂÃ‚Â²ÃƒÂÃ‚ÂµÃƒâ€˜Ã¢â€šÂ¬',
    'ÃƒÂÃ‚Â²ÃƒÂÃ‚Â¾ÃƒÂÃ‚Â¹Ãƒâ€˜Ã¢â‚¬Å¡ÃƒÂÃ‚Â¸',
    'Ãƒâ€˜Ã¢â€šÂ¬ÃƒÂÃ‚Â¾ÃƒÂÃ‚Â·Ãƒâ€˜Ã¢â‚¬Â¹ÃƒÂÃ‚Â³Ãƒâ€˜Ã¢â€šÂ¬Ãƒâ€˜Ã¢â‚¬Â¹Ãƒâ€˜Ã‹â€ ',
    'Ãƒâ€˜Ã‚ÂÃƒÂÃ‚Â¹Ãƒâ€˜Ã¢â€šÂ¬ÃƒÂÃ‚Â´Ãƒâ€˜Ã¢â€šÂ¬ÃƒÂÃ‚Â¾ÃƒÂÃ‚Â¿',
];
const SCAM_DOMAINS = ['dlscord.com', 'discrod.gift', 'discord-login.com', 'steamcommunity.work', 'steamcomminity.com', 'steamcommunnity.com'];
const SHORTENER_DOMAINS = ['bit.ly', 'tinyurl.com', 'cutt.ly', 'is.gd', 'goo.su', 't.co'];
const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'tiff', 'avif', 'heic', 'heif']);

function getFloodActions(config: Record<string, unknown> | null): FloodActionConfig[] {
    const rawActions = Array.isArray(config?.actions) ? config.actions : [];

    return rawActions
        .map((entry) => {
            if (!entry || typeof entry !== 'object') {
                return null;
            }

            const raw = entry as Record<string, unknown>;
            const messageCount =
                typeof raw.messageCount === 'number'
                    ? raw.messageCount
                    : typeof raw.count === 'number'
                        ? raw.count
                        : 0;
            const action = typeof raw.action === 'string' ? raw.action.toUpperCase() : 'DELETE';
            const durationText =
                typeof raw.durationText === 'string'
                    ? raw.durationText.trim()
                    : typeof raw.duration === 'string'
                        ? raw.duration.trim()
                        : '';

            if (!Number.isFinite(messageCount) || messageCount <= 0) {
                return null;
            }

            return {
                messageCount,
                action,
                durationText,
                durationMinutes: durationText ? (parseDurationToMinutes(durationText) ?? null) : null,
            };
        })
        .filter((entry): entry is FloodActionConfig => Boolean(entry))
        .sort((left, right) => right.messageCount - left.messageCount);
}

function pickFloodAction(config: Record<string, unknown> | null, messageCount: number) {
    return getFloodActions(config).find((entry) => messageCount >= entry.messageCount) ?? null;
}

function getTimedActions(config: Record<string, unknown> | null): TimedActionConfig[] {
    const rawActions = Array.isArray(config?.actions) ? config.actions : [];

    return rawActions
        .map((entry) => {
            if (!entry || typeof entry !== 'object') {
                return null;
            }

            const raw = entry as Record<string, unknown>;
            const action = typeof raw.action === 'string' ? raw.action.toUpperCase() : 'DELETE';
            const durationText =
                typeof raw.durationText === 'string'
                    ? raw.durationText.trim()
                    : typeof raw.duration === 'string'
                        ? raw.duration.trim()
                        : '';

            return {
                action,
                durationText,
                durationMinutes: durationText ? (parseDurationToMinutes(durationText) ?? null) : null,
            };
        })
        .filter((entry): entry is TimedActionConfig => Boolean(entry))
        .sort((left, right) => ACTION_PRIORITY.indexOf(left.action) - ACTION_PRIORITY.indexOf(right.action));
}

function pickTimedAction(config: Record<string, unknown> | null) {
    return getTimedActions(config)[0] ?? null;
}

async function applyFloodAction(member: GuildMember, actionConfig: FloodActionConfig, reason: string) {
    switch (actionConfig.action) {
        case 'BAN':
            if (actionConfig.durationMinutes && actionConfig.durationMinutes > 0) {
                await tempbanUser({
                    guild: member.guild,
                    targetUser: member,
                    actorUserId: 'automod',
                    durationMinutes: actionConfig.durationMinutes,
                    reason,
                });
                return 'TEMPBAN';
            }

            await banUser({
                guild: member.guild,
                targetUser: member,
                actorUserId: 'automod',
                reason,
            });
            return 'BAN';
        case 'KICK':
            await kickMember({
                member,
                actorUserId: 'automod',
                reason,
            });
            return 'KICK';
        case 'TIMEOUT':
            await timeoutMember({
                member,
                actorUserId: 'automod',
                durationMinutes: actionConfig.durationMinutes && actionConfig.durationMinutes > 0 ? actionConfig.durationMinutes : 60,
                reason,
            });
            return 'TIMEOUT';
        case 'MUTE':
            await muteMember({
                member,
                actorUserId: 'automod',
                durationMinutes: actionConfig.durationMinutes && actionConfig.durationMinutes > 0 ? actionConfig.durationMinutes : undefined,
                reason,
            });
            return 'MUTE';
        case 'WARN':
            await safeCreateAutomodCase({
                guildId: member.guild.id,
                targetUserId: member.id,
                actionType: 'AUTOMOD_WARN',
                reason,
                expiresAt:
                    actionConfig.durationMinutes && actionConfig.durationMinutes > 0
                        ? new Date(Date.now() + actionConfig.durationMinutes * 60_000)
                        : null,
                metadata:
                    actionConfig.durationMinutes && actionConfig.durationMinutes > 0
                        ? { durationMinutes: actionConfig.durationMinutes }
                        : null,
            });
            return 'WARN';
        default:
            return 'DELETE';
    }
}

function recordRecentMessage(guildId: string, userId: string, content: string, channelId: string, createdAt: number) {
    const key = `${guildId}:${userId}`;
    const bucket = recentMessages.get(key) ?? [];
    bucket.push({ content, channelId, createdAt });
    recentMessages.set(
        key,
        bucket.filter((entry) => createdAt - entry.createdAt <= DEFAULTS.messageHistoryWindowMs)
    );

    return recentMessages.get(key) ?? [];
}

function recordRecentRuleHit(guildId: string, userId: string, ruleKey: string, createdAt: number, windowMs: number) {
    const key = `${guildId}:${userId}:${ruleKey}`;
    const bucket = recentRuleHits.get(key) ?? [];
    bucket.push(createdAt);
    recentRuleHits.set(
        key,
        bucket.filter((entry) => createdAt - entry <= windowMs)
    );

    return recentRuleHits.get(key) ?? [];
}

function countEmoji(content: string) {
    const unicode = content.match(/[\p{Extended_Pictographic}]/gu) ?? [];
    const custom = content.match(/<a?:\w+:\d+>/g) ?? [];
    return unicode.length + custom.length;
}

function countZalgo(content: string) {
    return (content.match(/[\u0300-\u036f]/g) ?? []).length;
}

function getZalgoPercent(content: string) {
    const visibleLength = content.replace(/\s+/g, '').length;
    if (!visibleLength) {
        return 0;
    }

    return (countZalgo(content) / visibleLength) * 100;
}

function countLineBreaks(content: string) {
    return (content.match(/\n/g) ?? []).length;
}

function hasNonEmojiText(content: string) {
    const withoutCustomEmoji = content.replace(/<a?:\w+:\d+>/g, '');
    const withoutUnicodeEmoji = withoutCustomEmoji.replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, '');
    return withoutUnicodeEmoji.trim().length > 0;
}

function normalizeDomain(domain: string) {
    return domain.trim().toLowerCase().replace(/^www\./, '');
}

function extractLinks(content: string): ExtractedLink[] {
    const matches = content.match(/(?:https?:\/\/[^\s]+|www\.[^\s]+|discord\.gg\/[^\s]+|discord\.com\/invite\/[^\s]+)/gi) ?? [];
    const links = matches
        .map((match) => {
            try {
                const normalizedUrl = /^https?:\/\//i.test(match) ? match : `https://${match}`;
                const url = new URL(normalizedUrl);
                return {
                    raw: match,
                    url,
                    domain: normalizeDomain(url.hostname),
                };
            } catch {
                return null;
            }
        })
        .filter((link): link is ExtractedLink => Boolean(link));

    return links.filter((link, index, all) => all.findIndex((candidate) => candidate.raw === link.raw) === index);
}

function isDomainMatch(domain: string, configuredDomain: string) {
    return domain === configuredDomain || domain.endsWith(`.${configuredDomain}`);
}

function containsPhrase(contentLower: string, phrases: string[]) {
    return phrases.some((phrase) => phrase && contentLower.includes(phrase.toLowerCase()));
}

function containsToken(contentLower: string, tokens: string[]) {
    return tokens.some((token) => token && contentLower.includes(token.toLowerCase()));
}

function escapeRegex(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function detectBanwordMatch(content: string, config: Record<string, unknown> | null) {
    const ignoreCase = config?.ignoreCase !== false;
    const matchWholeWordsOnly = config?.matchWholeWordsOnly !== false;
    const normalizedContent = ignoreCase ? content.toLocaleLowerCase() : content;
    const configuredWords = getRuleStringArray(config, 'words')
        .map((word) => ignoreCase ? word.toLocaleLowerCase() : word)
        .map((word) => word.trim())
        .filter(Boolean);

    if (!configuredWords.length) {
        return { matched: false, words: [] as string[] };
    }

    const matchedWords = configuredWords.filter((word) => {
        if (matchWholeWordsOnly) {
            const pattern = word.includes(' ')
                ? `(^|[^\\p{L}\\p{N}_])${escapeRegex(word)}(?=$|[^\\p{L}\\p{N}_])`
                : `(^|[^\\p{L}\\p{N}_])${escapeRegex(word)}(?=$|[^\\p{L}\\p{N}_])`;
            return new RegExp(pattern, 'u').test(normalizedContent);
        }

        return normalizedContent.includes(word);
    });

    return {
        matched: matchedWords.length > 0,
        words: [...new Set(matchedWords)],
    };
}

function getNestedRuleConfig(config: Record<string, unknown> | null, key: string) {
    const value = config?.[key];
    return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function extractDiscordInviteCodes(links: ExtractedLink[]) {
    const codes = links
        .map((link) => {
            if (!DISCORD_INVITE_DOMAINS.has(link.domain)) {
                return null;
            }

            if (link.domain === 'discord.gg') {
                return link.url.pathname.split('/').filter(Boolean)[0] ?? null;
            }

            const parts = link.url.pathname.split('/').filter(Boolean);
            if (parts[0]?.toLowerCase() === 'invite') {
                return parts[1] ?? null;
            }

            return null;
        })
        .filter((code): code is string => Boolean(code))
        .map((code) => code.toLowerCase());

    return [...new Set(codes)];
}

async function detectExternalDiscordInvites(message: Message, links: ExtractedLink[]) {
    const inviteCodes = extractDiscordInviteCodes(links);
    if (!inviteCodes.length) {
        return { matched: false, codes: [] as string[] };
    }

    const vanityCode = message.guild?.vanityURLCode?.toLowerCase() ?? null;
    let guildInviteCodes: Set<string> | null = null;

    try {
        const invites = await message.guild?.invites.fetch();
        guildInviteCodes = new Set((invites ? [...invites.values()] : []).map((invite) => invite.code.toLowerCase()));
    } catch {
        guildInviteCodes = null;
    }

    const externalCodes: string[] = [];
    for (const code of inviteCodes) {
        if (vanityCode && code === vanityCode) {
            continue;
        }

        if (guildInviteCodes?.has(code)) {
            continue;
        }

        try {
            const invite = await message.client.fetchInvite(code);
            if (invite.guild?.id === message.guild?.id) {
                continue;
            }
        } catch {
            // If the invite cannot be resolved back to the current guild, keep it treated as external.
        }

        externalCodes.push(code);
    }

    return { matched: externalCodes.length > 0, codes: externalCodes };
}

function detectReferralLinks(content: string, links: ExtractedLink[], config: Record<string, unknown> | null) {
    const contentLower = content.toLowerCase();
    const customDomains = getRuleStringArray(config, 'customDomains').map(normalizeDomain);
    const customPhrases = getRuleStringArray(config, 'customPhrases').map((phrase) => phrase.toLowerCase());
    const customCodeTokens = getRuleStringArray(config, 'customCodeTokens').map((token) => token.toLowerCase());

    const hasReferralQuery = links.some((link) => [...link.url.searchParams.keys()].some((key) => REFERRAL_PARAM_KEYS.has(key.toLowerCase())));
    const hasReferralPath = links.some((link) => REFERRAL_PATH_HINTS.some((hint) => link.url.pathname.toLowerCase().includes(hint)));
    const hasBuiltInPhrase = containsPhrase(contentLower, REFERRAL_PHRASES);
    const hasCustomPhrase = containsPhrase(contentLower, customPhrases);
    const hasCustomToken = containsToken(contentLower, customCodeTokens);
    const hasReferralCodePattern = /(?:use my code|my code|ref(?:erral)? code|promo code|мой код|реф(?:еральный)? код|промокод)[\s:=-]*[a-z0-9_-]{3,}/i.test(content);
    const hasCustomDomain = links.some((link) => customDomains.some((configuredDomain) => isDomainMatch(link.domain, configuredDomain)));
    const hasReferralServiceDomain = links.some((link) => REFERRAL_SERVICE_DOMAINS.some((configuredDomain) => isDomainMatch(link.domain, configuredDomain)));

    const matched =
        hasReferralQuery ||
        hasReferralPath ||
        hasCustomDomain ||
        (hasReferralServiceDomain && (hasBuiltInPhrase || hasCustomPhrase || hasReferralCodePattern || hasCustomToken)) ||
        ((hasBuiltInPhrase || hasCustomPhrase) && (links.length > 0 || hasReferralCodePattern || hasCustomToken)) ||
        (hasCustomToken && (links.length > 0 || hasBuiltInPhrase || hasCustomPhrase));

    return {
        matched,
        signals: [
            ...(hasReferralQuery ? ['query'] : []),
            ...(hasReferralPath ? ['path'] : []),
            ...(hasCustomDomain ? ['custom_domain'] : []),
            ...(hasReferralServiceDomain ? ['service_domain'] : []),
            ...(hasBuiltInPhrase ? ['phrase'] : []),
            ...(hasCustomPhrase ? ['custom_phrase'] : []),
            ...(hasCustomToken ? ['custom_token'] : []),
            ...(hasReferralCodePattern ? ['code_pattern'] : []),
        ],
    };
}

function detectScamLikeLinks(content: string, links: ExtractedLink[], config: Record<string, unknown> | null) {
    if (!links.length) {
        return { matched: false, score: 0, signals: [] as string[] };
    }

    const contentLower = content.toLowerCase();
    const customDomains = getRuleStringArray(config, 'customDomains').map(normalizeDomain);
    const customPhrases = getRuleStringArray(config, 'customPhrases').map((phrase) => phrase.toLowerCase());

    const hasBuiltInDomain = links.some((link) => SCAM_DOMAINS.some((configuredDomain) => isDomainMatch(link.domain, configuredDomain)));
    const hasCustomDomain = links.some((link) => customDomains.some((configuredDomain) => isDomainMatch(link.domain, configuredDomain)));
    const hasBuiltInPhrase = containsPhrase(contentLower, SCAM_PHRASES);
    const hasCustomPhrase = containsPhrase(contentLower, customPhrases);
    const hasPunycode = links.some((link) => link.domain.includes('xn--') || link.raw.toLowerCase().includes('xn--'));
    const hasShortener = links.some((link) => SHORTENER_DOMAINS.some((configuredDomain) => isDomainMatch(link.domain, configuredDomain)));

    let score = 0;
    if (hasBuiltInDomain || hasCustomDomain) {
        score += 2;
    }
    if (hasBuiltInPhrase || hasCustomPhrase) {
        score += 1;
    }
    if (hasPunycode) {
        score += 1;
    }
    if (hasShortener) {
        score += 1;
    }

    return {
        matched: score >= 2,
        score,
        signals: [
            ...(hasBuiltInDomain ? ['domain'] : []),
            ...(hasCustomDomain ? ['custom_domain'] : []),
            ...(hasBuiltInPhrase ? ['phrase'] : []),
            ...(hasCustomPhrase ? ['custom_phrase'] : []),
            ...(hasPunycode ? ['punycode'] : []),
            ...(hasShortener ? ['shortener'] : []),
        ],
    };
}

function pickStrictestTimedAction(configs: Array<Record<string, unknown> | null>) {
    const actions = configs.flatMap((config) => getTimedActions(config));
    return actions.sort((left, right) => ACTION_PRIORITY.indexOf(left.action) - ACTION_PRIORITY.indexOf(right.action))[0] ?? null;
}

function isImageAttachment(attachment: Attachment) {
    if (attachment.contentType?.toLowerCase().startsWith('image/')) {
        return true;
    }

    const extension = attachment.name?.split('.').pop()?.toLowerCase() ?? '';
    if (extension && IMAGE_EXTENSIONS.has(extension)) {
        return true;
    }

    const lowerUrl = attachment.url.toLowerCase();
    return [...IMAGE_EXTENSIONS].some((candidate) => lowerUrl.includes(`.${candidate}`));
}

function detectImageViolation(message: Message, config: Record<string, unknown> | null) {
    const imageOnlyChannelIds = new Set(getRuleStringArray(config, 'imageOnlyChannelIds'));
    const denyImageChannelIds = new Set(getRuleStringArray(config, 'denyImageChannelIds'));
    const attachments = [...message.attachments.values()];
    const hasImageAttachment = attachments.some((attachment) => isImageAttachment(attachment));
    const hasNonImageAttachment = attachments.some((attachment) => !isImageAttachment(attachment));
    const hasText = message.content.trim().length > 0;

    if (denyImageChannelIds.has(message.channel.id) && hasImageAttachment) {
        return true;
    }

    if (imageOnlyChannelIds.has(message.channel.id)) {
        return !hasImageAttachment || hasText || hasNonImageAttachment;
    }

    return false;
}

async function safeCreateAutomodCase(input: {
    guildId: string;
    targetUserId: string;
    actionType: string;
    reason: string;
    expiresAt?: Date | null;
    metadata?: Record<string, unknown> | null;
}) {
    try {
        return await createModerationCase({
            guildId: input.guildId,
            actionType: input.actionType,
            source: 'automod',
            targetUserId: input.targetUserId,
            reason: input.reason,
            expiresAt: input.expiresAt ?? null,
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
    const history = recordRecentMessage(message.guild.id, message.author.id, normalized, message.channel.id, now);
    const extractedLinks = extractLinks(message.content);
    const triggeredRules: Array<{ key: string; strikeWeight: number }> = [];
    let floodAction: FloodActionConfig | null = null;
    let spamAction: FloodActionConfig | null = null;
    let mentionSpamAction: FloodActionConfig | null = null;
    let linesAction: TimedActionConfig | null = null;
    let linksAction: TimedActionConfig | null = null;
    let banwordsAction: TimedActionConfig | null = null;
    let advertisingAction: TimedActionConfig | null = null;
    const matchedBanwords: string[] = [];
    const advertisingCategories: string[] = [];
    const advertisingSignals: string[] = [];
    let commandChannelsAction: TimedActionConfig | null = null;
    let emojiSpamAction: FloodActionConfig | null = null;
    let imageFilterAction: TimedActionConfig | null = null;
    let emojiAction: FloodActionConfig | null = null;
    let zalgoAction: FloodActionConfig | null = null;

    const pushRule = (key: string, strikeWeight = 1) => {
        if (!triggeredRules.some((rule) => rule.key === key)) {
            triggeredRules.push({ key, strikeWeight });
        }
    };

    const isIgnoredByRule = (ruleConfig: Record<string, unknown> | null) =>
        isRuleIgnoredForMessage(ruleConfig, message.channel.id, roleIds);

    const floodRule = snapshot.automodRules.get('flood');
    if (floodRule?.enabled && !isIgnoredByRule(floodRule.config)) {
        const floodWindowMs = getFloodWindowMs(floodRule.config) || DEFAULTS.floodWindowMs;
        const withinWindow = history.filter((entry) => now - entry.createdAt <= floodWindowMs);
        const matchedFloodAction = pickFloodAction(floodRule.config, withinWindow.length);
        if (matchedFloodAction) {
            pushRule('flood', getRuleNumber(floodRule.config, 'strikeWeight', 1));
            floodAction = matchedFloodAction;
        }
    }

    const repeatedMessagesRule = snapshot.automodRules.get('repeated_messages');
    if (repeatedMessagesRule?.enabled && normalized.length && !isIgnoredByRule(repeatedMessagesRule.config)) {
        const duplicateWindowMs = getFloodWindowMs(repeatedMessagesRule.config) || DEFAULTS.duplicateWindowMs;
        const scope = repeatedMessagesRule.config?.scope === 'channel' ? 'channel' : 'server';
        const duplicates = history.filter(
            (entry) =>
                entry.content === normalized &&
                now - entry.createdAt <= duplicateWindowMs &&
                (scope === 'server' || entry.channelId === message.channel.id)
        );
        const matchedSpamAction = pickFloodAction(repeatedMessagesRule.config, duplicates.length);
        if (matchedSpamAction) {
            pushRule('repeated_messages', getRuleNumber(repeatedMessagesRule.config, 'strikeWeight', 1));
            spamAction = matchedSpamAction;
        }
    }

    const linesRule = snapshot.automodRules.get('lines');
    if (linesRule?.enabled && !isIgnoredByRule(linesRule.config) && countLineBreaks(message.content) >= getRuleNumber(linesRule.config, 'count', DEFAULTS.linesLimit)) {
        pushRule('lines', getRuleNumber(linesRule.config, 'strikeWeight', 1));
        linesAction = pickTimedAction(linesRule.config);
    }

    const repeatedMentionsRule = snapshot.automodRules.get('repeated_mentions');
    if (
        repeatedMentionsRule?.enabled &&
        !isIgnoredByRule(repeatedMentionsRule.config)
    ) {
        const userMentionsEnabled = repeatedMentionsRule.config?.userMentions !== false;
        const roleMentionsEnabled = repeatedMentionsRule.config?.roleMentions !== false;
        const userMentionsCount = message.mentions.users.filter((user) => !user.bot).size;
        const roleMentionsCount = message.mentions.roles.size;
        const hasTrackedMention =
            (userMentionsEnabled && userMentionsCount > 0) ||
            (roleMentionsEnabled && roleMentionsCount > 0);

        if (hasTrackedMention) {
            const mentionWindowMs = getFloodWindowMs(repeatedMentionsRule.config) || DEFAULTS.duplicateWindowMs;
            const recentMentionMessages = recordRecentRuleHit(
                message.guild.id,
                message.author.id,
                'repeated_mentions',
                now,
                mentionWindowMs
            );
            const matchedMentionAction = pickFloodAction(repeatedMentionsRule.config, recentMentionMessages.length);
            if (matchedMentionAction) {
                pushRule('repeated_mentions', getRuleNumber(repeatedMentionsRule.config, 'strikeWeight', 1));
                mentionSpamAction = matchedMentionAction;
            }
        }
    }

    const emojiRule = snapshot.automodRules.get('emoji');
    if (emojiRule?.enabled && !isIgnoredByRule(emojiRule.config)) {
        const denyEmojiChannelIds = new Set(getRuleStringArray(emojiRule.config, 'denyEmojiChannelIds'));
        const emojiOnlyChannelIds = new Set(getRuleStringArray(emojiRule.config, 'emojiOnlyChannelIds'));

        if (denyEmojiChannelIds.size || emojiOnlyChannelIds.size) {
            const hasEmojiInMessage = countEmoji(message.content) > 0;
            const containsNonEmojiText = hasNonEmojiText(message.content);
            const violatesDenyEmoji = denyEmojiChannelIds.has(message.channel.id) && hasEmojiInMessage;
            const violatesEmojiOnly = emojiOnlyChannelIds.has(message.channel.id) && containsNonEmojiText;

            if (violatesDenyEmoji || violatesEmojiOnly) {
                const recentEmojiMessages = recordRecentRuleHit(
                    message.guild.id,
                    message.author.id,
                    'emoji',
                    now,
                    DEFAULTS.emojiWindowMs
                );
                const matchedEmojiAction = pickFloodAction(emojiRule.config, recentEmojiMessages.length);
                if (matchedEmojiAction) {
                    pushRule('emoji', getRuleNumber(emojiRule.config, 'strikeWeight', 1));
                    emojiAction = matchedEmojiAction;
                }
            }
        }
    }

    const linksRule = snapshot.automodRules.get('links');
    if (linksRule?.enabled && !isIgnoredByRule(linksRule.config) && extractedLinks.length) {
        const domains = [...new Set(extractedLinks.map((link) => link.domain))];
        const configuredDomains = getRuleStringArray(linksRule.config, 'domains').map(normalizeDomain);
        const mode = linksRule.config?.mode === 'blocklist' ? 'blocklist' : 'allowlist';
        const violates =
            mode === 'blocklist'
                ? domains.some((domain) => configuredDomains.some((configuredDomain) => isDomainMatch(domain, configuredDomain)))
                : domains.some((domain) => !configuredDomains.some((configuredDomain) => isDomainMatch(domain, configuredDomain)));

        if (violates) {
            pushRule('links');
            linksAction = pickTimedAction(linksRule.config);
        }
    }

    const banwordsRule = snapshot.automodRules.get('banwords');
    if (banwordsRule?.enabled && !isIgnoredByRule(banwordsRule.config)) {
        const banwordsMatch = detectBanwordMatch(message.content, banwordsRule.config);
        if (banwordsMatch.matched) {
            matchedBanwords.push(...banwordsMatch.words);
            pushRule('banwords', getRuleNumber(banwordsRule.config, 'strikeWeight', 1));
            banwordsAction = pickTimedAction(banwordsRule.config);
        }
    }

    const advertisingRule = snapshot.automodRules.get('advertising');
    if (advertisingRule?.enabled && !isIgnoredByRule(advertisingRule.config ?? null)) {
        const discordInvitesConfig = getNestedRuleConfig(advertisingRule.config, 'discordInvites');
        const referralsConfig = getNestedRuleConfig(advertisingRule.config, 'referrals');
        const scamLinksConfig = getNestedRuleConfig(advertisingRule.config, 'scamLinks');
        const matchedActionConfigs: Array<Record<string, unknown> | null> = [];

        if (discordInvitesConfig?.enabled !== false) {
            const inviteMatch = await detectExternalDiscordInvites(message, extractedLinks);
            if (inviteMatch.matched) {
                advertisingCategories.push('discord_invites');
                advertisingSignals.push(...inviteMatch.codes.map((code) => `discord_invite:${code}`));
                matchedActionConfigs.push(discordInvitesConfig);
            }
        }

        if (referralsConfig?.enabled !== false) {
            const referralMatch = detectReferralLinks(message.content, extractedLinks, referralsConfig);
            if (referralMatch.matched) {
                advertisingCategories.push('referrals');
                advertisingSignals.push(...referralMatch.signals.map((signal) => `referral:${signal}`));
                matchedActionConfigs.push(referralsConfig);
            }
        }

        if (scamLinksConfig?.enabled !== false) {
            const scamMatch = detectScamLikeLinks(message.content, extractedLinks, scamLinksConfig);
            if (scamMatch.matched) {
                advertisingCategories.push('scam_links');
                advertisingSignals.push(...scamMatch.signals.map((signal) => `scam:${signal}`));
                matchedActionConfigs.push(scamLinksConfig);
            }
        }

        if (advertisingCategories.length) {
            pushRule('advertising', getRuleNumber(advertisingRule.config, 'strikeWeight', 1));
            advertisingAction = pickStrictestTimedAction(matchedActionConfigs);
        }
    }

    if (
        snapshot.automodRules.get('emoji_spam')?.enabled &&
        !isIgnoredByRule(snapshot.automodRules.get('emoji_spam')?.config ?? null) &&
        countEmoji(message.content) >=
            getRuleNumber(snapshot.automodRules.get('emoji_spam')?.config ?? null, 'count', DEFAULTS.emojiLimit)
    ) {
        const emojiSpamConfig = snapshot.automodRules.get('emoji_spam')?.config ?? null;
        const recentEmojiSpamMessages = recordRecentRuleHit(
            message.guild.id,
            message.author.id,
            'emoji_spam',
            now,
            DEFAULTS.emojiWindowMs
        );
        const matchedEmojiSpamAction = pickFloodAction(emojiSpamConfig, recentEmojiSpamMessages.length);
        if (matchedEmojiSpamAction) {
            pushRule('emoji_spam');
            emojiSpamAction = matchedEmojiSpamAction;
        }
    }

    if (
        snapshot.automodRules.get('zalgo')?.enabled &&
        !isIgnoredByRule(snapshot.automodRules.get('zalgo')?.config ?? null)
    ) {
        const zalgoConfig = snapshot.automodRules.get('zalgo')?.config ?? null;
        const zalgoCount = countZalgo(message.content);
        const requiredPercent = getRuleNumber(zalgoConfig, 'percent', DEFAULTS.zalgoPercent);

        if (zalgoCount > 0 && getZalgoPercent(message.content) >= requiredPercent) {
            const recentZalgoMessages = recordRecentRuleHit(
                message.guild.id,
                message.author.id,
                'zalgo',
                now,
                DEFAULTS.zalgoWindowMs
            );
            const matchedZalgoAction = pickFloodAction(zalgoConfig, recentZalgoMessages.length);
            if (matchedZalgoAction) {
                pushRule('zalgo');
                zalgoAction = matchedZalgoAction;
            }
        }
    }

    if (
        snapshot.automodRules.get('command_channels')?.enabled &&
        !isIgnoredByRule(snapshot.automodRules.get('command_channels')?.config ?? null)
    ) {
        const commandChannelsConfig = snapshot.automodRules.get('command_channels')?.config ?? null;
        const mode = commandChannelsConfig?.mode === 'blocklist' ? 'blocklist' : 'allowlist';
        const configuredChannelIds = getRuleStringArray(commandChannelsConfig, 'channelIds');
        const selectedChannels = configuredChannelIds.length ? configuredChannelIds : snapshot.moderationConfig.commandOnlyChannels;
        const inSelectedChannel = selectedChannels.includes(message.channel.id);
        const isCommandMessage = message.content.startsWith('/') || message.content.startsWith(snapshot.prefix);
        const violates =
            mode === 'allowlist'
                ? inSelectedChannel && !isCommandMessage
                : inSelectedChannel && isCommandMessage;

        if (violates) {
            pushRule('command_channels');
            commandChannelsAction = pickTimedAction(commandChannelsConfig);
        }
    }

    if (snapshot.automodRules.get('image_filter')?.enabled && !isIgnoredByRule(snapshot.automodRules.get('image_filter')?.config ?? null) && detectImageViolation(message, snapshot.automodRules.get('image_filter')?.config ?? null)) {
        pushRule('image_filter');
        imageFilterAction = pickTimedAction(snapshot.automodRules.get('image_filter')?.config ?? null);
    }

    if (!triggeredRules.length) return;

    const deleted = message.deletable ? await message.delete().then(() => true).catch(() => false) : false;
    const { strikeWeight, strikeCount: nextStrikeCount } = await applyStrikeState(message.member, triggeredRules);
    let appliedFloodActionType: string | null = null;
    let appliedBuiltinActionType: string | null = null;
    if (floodAction) {
        appliedFloodActionType = await applyFloodAction(
            message.member,
            floodAction,
            `Flood rule triggered (${triggeredRules.map((rule) => rule.key).join(', ')})`
        );
    }
    if (!appliedFloodActionType && spamAction) {
        appliedBuiltinActionType = await applyFloodAction(
            message.member,
            spamAction,
            `Spam rule triggered (${triggeredRules.map((rule) => rule.key).join(', ')})`
        );
    }
    if (!appliedFloodActionType && !appliedBuiltinActionType && linesAction) {
        appliedBuiltinActionType = await applyFloodAction(
            message.member,
            {
                messageCount: 1,
                action: linesAction.action,
                durationText: linesAction.durationText,
                durationMinutes: linesAction.durationMinutes,
            },
            `Lines rule triggered (${triggeredRules.map((rule) => rule.key).join(', ')})`
        );
    }
    if (!appliedFloodActionType && !appliedBuiltinActionType && linksAction) {
        appliedBuiltinActionType = await applyFloodAction(
            message.member,
            {
                messageCount: 1,
                action: linksAction.action,
                durationText: linksAction.durationText,
                durationMinutes: linksAction.durationMinutes,
            },
            `Links rule triggered (${triggeredRules.map((rule) => rule.key).join(', ')})`
        );
    }
    if (!appliedFloodActionType && !appliedBuiltinActionType && banwordsAction) {
        appliedBuiltinActionType = await applyFloodAction(
            message.member,
            {
                messageCount: 1,
                action: banwordsAction.action,
                durationText: banwordsAction.durationText,
                durationMinutes: banwordsAction.durationMinutes,
            },
            `Banwords rule triggered (${matchedBanwords.join(', ')})`
        );
    }
    if (!appliedFloodActionType && !appliedBuiltinActionType && advertisingAction) {
        appliedBuiltinActionType = await applyFloodAction(
            message.member,
            {
                messageCount: 1,
                action: advertisingAction.action,
                durationText: advertisingAction.durationText,
                durationMinutes: advertisingAction.durationMinutes,
            },
            `Advertising rule triggered (${advertisingCategories.join(', ')})`
        );
    }
    if (!appliedFloodActionType && !appliedBuiltinActionType && commandChannelsAction) {
        appliedBuiltinActionType = await applyFloodAction(
            message.member,
            {
                messageCount: 1,
                action: commandChannelsAction.action,
                durationText: commandChannelsAction.durationText,
                durationMinutes: commandChannelsAction.durationMinutes,
            },
            `Command channels rule triggered (${triggeredRules.map((rule) => rule.key).join(', ')})`
        );
    }
    if (!appliedFloodActionType && !appliedBuiltinActionType && imageFilterAction) {
        appliedBuiltinActionType = await applyFloodAction(
            message.member,
            {
                messageCount: 1,
                action: imageFilterAction.action,
                durationText: imageFilterAction.durationText,
                durationMinutes: imageFilterAction.durationMinutes,
            },
            `Image filter rule triggered (${triggeredRules.map((rule) => rule.key).join(', ')})`
        );
    }
    if (!appliedFloodActionType && !appliedBuiltinActionType && emojiSpamAction) {
        appliedBuiltinActionType = await applyFloodAction(
            message.member,
            emojiSpamAction,
            `Emoji spam rule triggered (${triggeredRules.map((rule) => rule.key).join(', ')})`
        );
    }
    if (!appliedFloodActionType && !appliedBuiltinActionType && mentionSpamAction) {
        appliedBuiltinActionType = await applyFloodAction(
            message.member,
            mentionSpamAction,
            `Mention spam rule triggered (${triggeredRules.map((rule) => rule.key).join(', ')})`
        );
    }
    if (!appliedFloodActionType && !appliedBuiltinActionType && emojiAction) {
        appliedBuiltinActionType = await applyFloodAction(
            message.member,
            emojiAction,
            `Emoji channels rule triggered (${triggeredRules.map((rule) => rule.key).join(', ')})`
        );
    }
    if (!appliedFloodActionType && !appliedBuiltinActionType && zalgoAction) {
        appliedBuiltinActionType = await applyFloodAction(
                message.member,
                zalgoAction,
                `Zalgo rule triggered (${triggeredRules.map((rule) => rule.key).join(', ')})`
            );
    }
    const actionType =
        appliedFloodActionType && appliedFloodActionType !== 'DELETE'
            ? `AUTOMOD_${appliedFloodActionType}`
            : appliedBuiltinActionType && appliedBuiltinActionType !== 'DELETE'
                ? `AUTOMOD_${appliedBuiltinActionType}`
            : deleted
                ? 'AUTOMOD_DELETE'
                : 'AUTOMOD_HIT';

    await safeCreateAutomodCase({
        guildId: message.guild.id,
        targetUserId: message.author.id,
        actionType,
        reason: `Triggered rules: ${triggeredRules.map((rule) => rule.key).join(', ')}`,
        metadata: {
            channelId: message.channel.id,
            messageId: message.id,
            rules: triggeredRules.map((rule) => rule.key),
            floodAction: floodAction?.action ?? null,
            builtinAction: appliedBuiltinActionType,
            spamAction: spamAction?.action ?? null,
            spamDuration: spamAction?.durationText ?? null,
            spamThreshold: spamAction?.messageCount ?? null,
            linesAction: linesAction?.action ?? null,
            linesDuration: linesAction?.durationText ?? null,
            linksAction: linksAction?.action ?? null,
            linksDuration: linksAction?.durationText ?? null,
            banwordsAction: banwordsAction?.action ?? null,
            banwordsDuration: banwordsAction?.durationText ?? null,
            banwordsMatched: matchedBanwords,
            advertisingAction: advertisingAction?.action ?? null,
            advertisingDuration: advertisingAction?.durationText ?? null,
            advertisingCategories,
            advertisingSignals,
            commandChannelsAction: commandChannelsAction?.action ?? null,
            commandChannelsDuration: commandChannelsAction?.durationText ?? null,
            imageFilterAction: imageFilterAction?.action ?? null,
            imageFilterDuration: imageFilterAction?.durationText ?? null,
            emojiSpamAction: emojiSpamAction?.action ?? null,
            emojiSpamDuration: emojiSpamAction?.durationText ?? null,
            emojiSpamThreshold: emojiSpamAction?.messageCount ?? null,
            mentionSpamAction: mentionSpamAction?.action ?? null,
            mentionSpamDuration: mentionSpamAction?.durationText ?? null,
            mentionSpamThreshold: mentionSpamAction?.messageCount ?? null,
            emojiAction: emojiAction?.action ?? null,
            emojiDuration: emojiAction?.durationText ?? null,
            emojiThreshold: emojiAction?.messageCount ?? null,
            zalgoAction: zalgoAction?.action ?? null,
            zalgoDuration: zalgoAction?.durationText ?? null,
            zalgoThreshold: zalgoAction?.messageCount ?? null,
            floodDuration: floodAction?.durationText ?? null,
            floodThreshold: floodAction?.messageCount ?? null,
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
            floodAction: floodAction?.action ?? null,
            builtinAction: appliedBuiltinActionType,
            spamAction: spamAction?.action ?? null,
            spamDuration: spamAction?.durationText ?? null,
            spamThreshold: spamAction?.messageCount ?? null,
            linesAction: linesAction?.action ?? null,
            linesDuration: linesAction?.durationText ?? null,
            linksAction: linksAction?.action ?? null,
            linksDuration: linksAction?.durationText ?? null,
            banwordsAction: banwordsAction?.action ?? null,
            banwordsDuration: banwordsAction?.durationText ?? null,
            banwordsMatched: matchedBanwords,
            advertisingAction: advertisingAction?.action ?? null,
            advertisingDuration: advertisingAction?.durationText ?? null,
            advertisingCategories,
            advertisingSignals,
            commandChannelsAction: commandChannelsAction?.action ?? null,
            commandChannelsDuration: commandChannelsAction?.durationText ?? null,
            imageFilterAction: imageFilterAction?.action ?? null,
            imageFilterDuration: imageFilterAction?.durationText ?? null,
            emojiSpamAction: emojiSpamAction?.action ?? null,
            emojiSpamDuration: emojiSpamAction?.durationText ?? null,
            emojiSpamThreshold: emojiSpamAction?.messageCount ?? null,
            mentionSpamAction: mentionSpamAction?.action ?? null,
            mentionSpamDuration: mentionSpamAction?.durationText ?? null,
            mentionSpamThreshold: mentionSpamAction?.messageCount ?? null,
            emojiAction: emojiAction?.action ?? null,
            emojiDuration: emojiAction?.durationText ?? null,
            emojiThreshold: emojiAction?.messageCount ?? null,
            zalgoAction: zalgoAction?.action ?? null,
            zalgoDuration: zalgoAction?.durationText ?? null,
            zalgoThreshold: zalgoAction?.messageCount ?? null,
            floodDuration: floodAction?.durationText ?? null,
            floodThreshold: floodAction?.messageCount ?? null,
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
