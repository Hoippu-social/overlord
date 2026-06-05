import React from 'react';
import { ConfigState, AutomodActionConfig, AutomodAdvertisingConfig, AutomodBanwordsConfig, AutomodCommandChannelsConfig, AutomodEmojiConfig, AutomodEmojiSpamConfig, AutomodImageFilterConfig, AutomodLinesConfig, AutomodLinksConfig, AutomodMentionSpamConfig, AutomodRule, AutomodFloodAction, AutomodFloodConfig, AutomodSpamConfig, AutomodZalgoConfig, CustomRule, SanctionStep } from '@/app/dashboard/[guildId]/moderation/types';
import { AnimatedCard, SmoothToggle, InteractiveSelect, MultiSelectField, TextField, TextAreaField, Badge } from '@/components/moderation/ui';
import { Trash, Gear, MagicWand, Plus, Robot, WarningOctagon, X } from '@phosphor-icons/react';
import { updateAtIndex, removeAtIndex, BUILTIN_RULE_LABELS, BUILTIN_RULE_LABELS_RU, BUILTIN_RULE_DESCRIPTIONS, BUILTIN_RULE_DESCRIPTIONS_RU, BUILTIN_RULE_ORDER, AUTOMOD_ACTION_OPTIONS, AUTOMOD_ACTION_LABELS, AUTOMOD_ACTION_LABELS_RU, CUSTOM_RULE_TYPES, CUSTOM_RULE_ACTIONS, CUSTOM_RULE_TEMPLATES, SANCTION_ACTIONS } from '@/app/dashboard/[guildId]/moderation/constants';
import { FLOOD_WINDOW_UNITS } from '@/app/dashboard/[guildId]/moderation/constants';
import { Modal, ModalContent } from '@nextui-org/react';
import zalgoFilterIcon from '../../../../icons/filters_icons/zalgo.svg';
import adsFilterIcon from '../../../../icons/filters_icons/ads.svg';
import commandChannelsFilterIcon from '../../../../icons/filters_icons/commands_chanels.svg';
import emojiChannelsFilterIcon from '../../../../icons/filters_icons/emoji_chanels.svg';
import emojiSpamFilterIcon from '../../../../icons/filters_icons/emoji_spam.svg';
import floodFilterIcon from '../../../../icons/filters_icons/flud.svg';
import imagesFilterIcon from '../../../../icons/filters_icons/images.svg';
import linksFilterIcon from '../../../../icons/filters_icons/links.svg';
import banwordsFilterIcon from '../../../../icons/filters_icons/banwords.svg';
import mentionSpamFilterIcon from '../../../../icons/filters_icons/mention_spam.svg';
import spamFilterIcon from '../../../../icons/filters_icons/spam.svg';
import strokesFilterIcon from '../../../../icons/filters_icons/strokes.svg';

interface AutoModTabProps {
    config: ConfigState;
    setConfig: React.Dispatch<React.SetStateAction<ConfigState>>;
    locale: 'en' | 'ru';
    tr: (ru: string, en: string) => string;
}

type ChipFieldProps = {
    label: string;
    placeholder: string;
    values: string[];
    inputValue: string;
    onInputChange: (value: string) => void;
    onCommit: (rawValue: string) => void;
    onRemove: (value: string) => void;
    onBackspaceEmpty?: () => void;
    onBlurCommit?: boolean;
};

const FILTER_ICON_MAP = {
    flood: floodFilterIcon,
    zalgo: zalgoFilterIcon,
    emoji: emojiChannelsFilterIcon,
    repeated_messages: spamFilterIcon,
    repeated_mentions: mentionSpamFilterIcon,
    lines: strokesFilterIcon,
    links: linksFilterIcon,
    banwords: banwordsFilterIcon,
    advertising: adsFilterIcon,
    emoji_spam: emojiSpamFilterIcon,
    command_channels: commandChannelsFilterIcon,
    image_filter: imagesFilterIcon,
} as const;

function FilterGlyph({ ruleKey, active }: { ruleKey: string; active: boolean }) {
    const icon = FILTER_ICON_MAP[ruleKey as keyof typeof FILTER_ICON_MAP];
    const iconSrc = icon ? (typeof icon === 'string' ? icon : icon.src) : null;

    if (!iconSrc) {
        return <Robot size={24} weight="duotone" />;
    }

    return (
        <span
            aria-hidden="true"
            className={`block h-6 w-6 ${active ? 'text-[var(--color-primary-1)]' : 'text-white/40'}`}
            style={{
                backgroundColor: 'currentColor',
                maskImage: `url(${iconSrc})`,
                maskRepeat: 'no-repeat',
                maskPosition: 'center',
                maskSize: 'contain',
                WebkitMaskImage: `url(${iconSrc})`,
                WebkitMaskRepeat: 'no-repeat',
                WebkitMaskPosition: 'center',
                WebkitMaskSize: 'contain',
            }}
        />
    );
}

function ChipField({
    label,
    placeholder,
    values,
    inputValue,
    onInputChange,
    onCommit,
    onRemove,
    onBackspaceEmpty,
    onBlurCommit = true,
}: ChipFieldProps) {
    return (
        <label className="block space-y-2 group min-w-0">
            <span className="text-sm font-semibold tracking-wide text-white/50 transition-colors group-hover:text-white/80">
                {label}
            </span>
            <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3.5 shadow-inner transition-all duration-300 hover:bg-black/40 hover:border-white/20 focus-within:border-[var(--color-primary-1)] focus-within:ring-2 focus-within:ring-[var(--color-primary-1)]/20">
                <div className="flex flex-wrap items-center gap-2">
                    {values.map((value) => (
                        <span
                            key={value}
                            className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/90 shadow-sm backdrop-blur-md"
                        >
                            <span className="max-w-[220px] truncate">{value}</span>
                            <button
                                type="button"
                                onClick={() => onRemove(value)}
                                className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-black/20 text-white/60 transition-colors hover:bg-rose-500 hover:text-white"
                                aria-label={`Remove ${value}`}
                            >
                                <X size={10} weight="bold" />
                            </button>
                        </span>
                    ))}
                    <input
                        type="text"
                        value={inputValue}
                        onChange={(event) => {
                            const value = event.target.value;
                            if (/\s/.test(value)) {
                                onCommit(value);
                                onInputChange('');
                                return;
                            }
                            onInputChange(value);
                        }}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                                event.preventDefault();
                                onCommit(inputValue);
                                onInputChange('');
                                return;
                            }

                            if (event.key === 'Backspace' && !inputValue && onBackspaceEmpty) {
                                event.preventDefault();
                                onBackspaceEmpty();
                            }
                        }}
                        onBlur={() => {
                            if (!onBlurCommit || !inputValue.trim()) return;
                            onCommit(inputValue);
                            onInputChange('');
                        }}
                        className="min-w-[180px] flex-1 bg-transparent text-sm text-white/90 outline-none placeholder:text-white/30"
                        placeholder={placeholder}
                        aria-label={label}
                    />
                </div>
            </div>
        </label>
    );
}

export function AutoModTab({ config, setConfig, locale, tr }: AutoModTabProps) {
    const builtinLabels = locale === 'ru' ? BUILTIN_RULE_LABELS_RU : BUILTIN_RULE_LABELS;
    const builtinDescriptions = locale === 'ru' ? BUILTIN_RULE_DESCRIPTIONS_RU : BUILTIN_RULE_DESCRIPTIONS;

    const [expandedBuiltin, setExpandedBuiltin] = React.useState<string | null>(null);
    const [isFloodModalOpen, setIsFloodModalOpen] = React.useState(false);
    const [floodDraft, setFloodDraft] = React.useState<AutomodFloodConfig | null>(null);
    const [isZalgoModalOpen, setIsZalgoModalOpen] = React.useState(false);
    const [zalgoDraft, setZalgoDraft] = React.useState<AutomodZalgoConfig | null>(null);
    const [isEmojiModalOpen, setIsEmojiModalOpen] = React.useState(false);
    const [emojiDraft, setEmojiDraft] = React.useState<AutomodEmojiConfig | null>(null);
    const [isEmojiSpamModalOpen, setIsEmojiSpamModalOpen] = React.useState(false);
    const [emojiSpamDraft, setEmojiSpamDraft] = React.useState<AutomodEmojiSpamConfig | null>(null);
    const [isSpamModalOpen, setIsSpamModalOpen] = React.useState(false);
    const [spamDraft, setSpamDraft] = React.useState<AutomodSpamConfig | null>(null);
    const [isMentionSpamModalOpen, setIsMentionSpamModalOpen] = React.useState(false);
    const [mentionSpamDraft, setMentionSpamDraft] = React.useState<AutomodMentionSpamConfig | null>(null);
    const [isLinesModalOpen, setIsLinesModalOpen] = React.useState(false);
    const [linesDraft, setLinesDraft] = React.useState<AutomodLinesConfig | null>(null);
    const [isLinksModalOpen, setIsLinksModalOpen] = React.useState(false);
    const [linksDraft, setLinksDraft] = React.useState<AutomodLinksConfig | null>(null);
    const [linksDomainInput, setLinksDomainInput] = React.useState('');
    const [isBanwordsModalOpen, setIsBanwordsModalOpen] = React.useState(false);
    const [banwordsDraft, setBanwordsDraft] = React.useState<AutomodBanwordsConfig | null>(null);
    const [banwordsInput, setBanwordsInput] = React.useState('');
    const [isAdvertisingModalOpen, setIsAdvertisingModalOpen] = React.useState(false);
    const [advertisingDraft, setAdvertisingDraft] = React.useState<AutomodAdvertisingConfig | null>(null);
    const [isCommandChannelsModalOpen, setIsCommandChannelsModalOpen] = React.useState(false);
    const [commandChannelsDraft, setCommandChannelsDraft] = React.useState<AutomodCommandChannelsConfig | null>(null);
    const [isImageFilterModalOpen, setIsImageFilterModalOpen] = React.useState(false);
    const [imageFilterDraft, setImageFilterDraft] = React.useState<AutomodImageFilterConfig | null>(null);
    const [advertisingInputs, setAdvertisingInputs] = React.useState({
        referralDomain: '',
        referralPhrase: '',
        referralCode: '',
        scamDomain: '',
        scamPhrase: '',
    });

    const defaultFloodConfig = React.useCallback((): AutomodFloodConfig => ({
        windowValue: 1,
        windowUnit: 'minutes',
        actions: [],
        ignoredChannels: [],
        ignoredRoles: [],
    }), []);

    const defaultZalgoConfig = React.useCallback((): AutomodZalgoConfig => ({
        percent: 10,
        ignoredChannels: [],
        actions: [{
            messageCount: 1,
            action: 'DELETE',
            durationText: '',
        }],
    }), []);

    const defaultEmojiConfig = React.useCallback((): AutomodEmojiConfig => ({
        emojiOnlyChannelIds: [],
        denyEmojiChannelIds: [],
        actions: [{
            messageCount: 1,
            action: 'DELETE',
            durationText: '',
        }],
    }), []);

    const defaultSpamConfig = React.useCallback((): AutomodSpamConfig => ({
        scope: 'server',
        windowValue: 1,
        windowUnit: 'minutes',
        ignoredChannels: [],
        actions: [{
            messageCount: 3,
            action: 'DELETE',
            durationText: '',
        }],
    }), []);

    const defaultEmojiSpamConfig = React.useCallback((): AutomodEmojiSpamConfig => ({
        count: 8,
        ignoredChannels: [],
        actions: [{
            messageCount: 1,
            action: 'DELETE',
            durationText: '',
        }],
    }), []);

    const defaultMentionSpamConfig = React.useCallback((): AutomodMentionSpamConfig => ({
        userMentions: true,
        roleMentions: true,
        ignoredChannels: [],
        windowValue: 1,
        windowUnit: 'minutes',
        actions: [{
            messageCount: 1,
            action: 'DELETE',
            durationText: '',
        }],
    }), []);

    const defaultLinesConfig = React.useCallback((): AutomodLinesConfig => ({
        count: 5,
        ignoredChannels: [],
        actions: [{
            action: 'DELETE',
            durationText: '',
        }],
    }), []);

    const defaultLinksConfig = React.useCallback((): AutomodLinksConfig => ({
        mode: 'allowlist',
        ignoredChannels: [],
        domains: [],
        actions: [{
            action: 'DELETE',
            durationText: '',
        }],
    }), []);

    const defaultBanwordsConfig = React.useCallback((): AutomodBanwordsConfig => ({
        ignoredChannels: [],
        ignoredRoles: [],
        words: [],
        matchWholeWordsOnly: true,
        ignoreCase: true,
        actions: [{
            action: 'DELETE',
            durationText: '',
        }],
    }), []);

    const defaultAdvertisingConfig = React.useCallback((): AutomodAdvertisingConfig => ({
        ignoredChannels: [],
        discordInvites: {
            enabled: true,
            actions: [{
                action: 'DELETE',
                durationText: '',
            }],
        },
        referrals: {
            enabled: true,
            customDomains: [],
            customPhrases: [],
            customCodeTokens: [],
            actions: [{
                action: 'DELETE',
                durationText: '',
            }],
        },
        scamLinks: {
            enabled: true,
            customDomains: [],
            customPhrases: [],
            actions: [{
                action: 'DELETE',
                durationText: '',
            }],
        },
    }), []);

    const defaultCommandChannelsConfig = React.useCallback((): AutomodCommandChannelsConfig => ({
        mode: 'allowlist',
        channelIds: [],
        actions: [{
            action: 'DELETE',
            durationText: '',
        }],
    }), []);

    const defaultImageFilterConfig = React.useCallback((): AutomodImageFilterConfig => ({
        ignoredChannels: [],
        imageOnlyChannelIds: [],
        denyImageChannelIds: [],
        actions: [{
            action: 'DELETE',
            durationText: '',
        }],
    }), []);

    const defaultFloodAction = React.useCallback((): AutomodFloodAction => ({
        messageCount: 6,
        action: 'DELETE',
        durationText: '',
    }), []);

    const cloneFloodConfig = React.useCallback((value: AutomodFloodConfig): AutomodFloodConfig => ({
        windowValue: value.windowValue,
        windowUnit: value.windowUnit,
        actions: value.actions.map((action) => ({ ...action })),
        ignoredChannels: [...value.ignoredChannels],
        ignoredRoles: [...value.ignoredRoles],
    }), []);

    const normalizeFloodConfig = React.useCallback((value: AutomodFloodConfig): AutomodFloodConfig => ({
        windowValue: Math.max(1, Math.round(Number(value.windowValue) || 1)),
        windowUnit: value.windowUnit,
        actions: value.actions.map((action) => ({
            messageCount: Math.max(1, Math.round(Number(action.messageCount) || 1)),
            action: action.action,
            durationText: action.durationText.trim(),
        })),
        ignoredChannels: [...new Set(value.ignoredChannels)],
        ignoredRoles: [...new Set(value.ignoredRoles)],
    }), []);

    const normalizeZalgoConfig = React.useCallback((value: AutomodZalgoConfig): AutomodZalgoConfig => ({
        percent: Math.min(100, Math.max(1, Math.round(Number(value.percent) || 1))),
        ignoredChannels: [...new Set(value.ignoredChannels)],
        actions: value.actions.length
            ? value.actions.map((action) => ({
                messageCount: Math.max(1, Math.round(Number(action.messageCount) || 1)),
                action: typeof action.action === 'string' && action.action.trim() ? action.action.toUpperCase() : 'DELETE',
                durationText: typeof action.durationText === 'string' ? action.durationText.trim() : '',
            }))
            : [{
                messageCount: 1,
                action: 'DELETE',
                durationText: '',
            }],
    }), []);

    const normalizeEmojiConfig = React.useCallback((value: AutomodEmojiConfig): AutomodEmojiConfig => ({
        emojiOnlyChannelIds: [...new Set(value.emojiOnlyChannelIds)],
        denyEmojiChannelIds: [...new Set(value.denyEmojiChannelIds)],
        actions: value.actions.length
            ? value.actions.map((action) => ({
                messageCount: Math.max(1, Math.round(Number(action.messageCount) || 1)),
                action: typeof action.action === 'string' && action.action.trim() ? action.action.toUpperCase() : 'DELETE',
                durationText: typeof action.durationText === 'string' ? action.durationText.trim() : '',
            }))
            : [{
                messageCount: 1,
                action: 'DELETE',
                durationText: '',
            }],
    }), []);

    const normalizeSpamConfig = React.useCallback((value: AutomodSpamConfig): AutomodSpamConfig => ({
        scope: value.scope === 'channel' ? 'channel' : 'server',
        windowValue: Math.max(1, Math.round(Number(value.windowValue) || 1)),
        windowUnit: value.windowUnit,
        ignoredChannels: [...new Set(value.ignoredChannels)],
        actions: value.actions.length
            ? value.actions.map((action) => ({
                messageCount: Math.max(1, Math.round(Number(action.messageCount) || 1)),
                action: typeof action.action === 'string' && action.action.trim() ? action.action.toUpperCase() : 'DELETE',
                durationText: typeof action.durationText === 'string' ? action.durationText.trim() : '',
            }))
            : [{
                messageCount: 3,
                action: 'DELETE',
                durationText: '',
            }],
    }), []);

    const normalizeEmojiSpamConfig = React.useCallback((value: AutomodEmojiSpamConfig): AutomodEmojiSpamConfig => ({
        count: Math.max(1, Math.round(Number(value.count) || 1)),
        ignoredChannels: [...new Set(value.ignoredChannels)],
        actions: value.actions.length
            ? value.actions.map((action) => ({
                messageCount: Math.max(1, Math.round(Number(action.messageCount) || 1)),
                action: typeof action.action === 'string' && action.action.trim() ? action.action.toUpperCase() : 'DELETE',
                durationText: typeof action.durationText === 'string' ? action.durationText.trim() : '',
            }))
            : [{
                messageCount: 1,
                action: 'DELETE',
                durationText: '',
            }],
    }), []);

    const normalizeMentionSpamConfig = React.useCallback((value: AutomodMentionSpamConfig): AutomodMentionSpamConfig => ({
        userMentions: value.userMentions !== false,
        roleMentions: value.roleMentions !== false,
        ignoredChannels: [...new Set(value.ignoredChannels)],
        windowValue: Math.max(1, Math.round(Number(value.windowValue) || 1)),
        windowUnit: value.windowUnit,
        actions: value.actions.length
            ? value.actions.map((action) => ({
                messageCount: Math.max(1, Math.round(Number(action.messageCount) || 1)),
                action: typeof action.action === 'string' && action.action.trim() ? action.action.toUpperCase() : 'DELETE',
                durationText: typeof action.durationText === 'string' ? action.durationText.trim() : '',
            }))
            : [{
                messageCount: 1,
                action: 'DELETE',
                durationText: '',
            }],
    }), []);

    const normalizeLinesConfig = React.useCallback((value: AutomodLinesConfig): AutomodLinesConfig => ({
        count: Math.max(1, Math.round(Number(value.count) || 1)),
        ignoredChannels: [...new Set(value.ignoredChannels)],
        actions: value.actions.length
            ? value.actions.map((action) => ({
                action: typeof action.action === 'string' && action.action.trim() ? action.action.toUpperCase() : 'DELETE',
                durationText: typeof action.durationText === 'string' ? action.durationText.trim() : '',
            }))
            : [{
                action: 'DELETE',
                durationText: '',
            }],
    }), []);

    const normalizeLinksConfig = React.useCallback((value: AutomodLinksConfig): AutomodLinksConfig => ({
        mode: value.mode === 'blocklist' ? 'blocklist' : 'allowlist',
        ignoredChannels: [...new Set(value.ignoredChannels)],
        domains: [...new Set(value.domains.map((domain) => domain.trim().toLowerCase()).filter(Boolean))],
        actions: value.actions.length
            ? value.actions.map((action) => ({
                action: typeof action.action === 'string' && action.action.trim() ? action.action.toUpperCase() : 'DELETE',
                durationText: typeof action.durationText === 'string' ? action.durationText.trim() : '',
            }))
            : [{
                action: 'DELETE',
                durationText: '',
            }],
    }), []);

    const normalizeAdvertisingConfig = React.useCallback((value: AutomodAdvertisingConfig): AutomodAdvertisingConfig => {
        const normalizeTimedActions = (actions: AutomodActionConfig[]) => (
            actions.length
                ? actions.map((action) => ({
                    action: typeof action.action === 'string' && action.action.trim() ? action.action.toUpperCase() : 'DELETE',
                    durationText: typeof action.durationText === 'string' ? action.durationText.trim() : '',
                }))
                : [{
                    action: 'DELETE',
                    durationText: '',
                }]
        );

        return {
            ignoredChannels: [...new Set(value.ignoredChannels)],
            discordInvites: {
                enabled: value.discordInvites.enabled !== false,
                actions: normalizeTimedActions(value.discordInvites.actions),
            },
            referrals: {
                enabled: value.referrals.enabled !== false,
                customDomains: [...new Set(value.referrals.customDomains.map((item) => item.trim().toLowerCase()).filter(Boolean))],
                customPhrases: [...new Set(value.referrals.customPhrases.map((item) => item.trim()).filter(Boolean))],
                customCodeTokens: [...new Set(value.referrals.customCodeTokens.map((item) => item.trim()).filter(Boolean))],
                actions: normalizeTimedActions(value.referrals.actions),
            },
            scamLinks: {
                enabled: value.scamLinks.enabled !== false,
                customDomains: [...new Set(value.scamLinks.customDomains.map((item) => item.trim().toLowerCase()).filter(Boolean))],
                customPhrases: [...new Set(value.scamLinks.customPhrases.map((item) => item.trim()).filter(Boolean))],
                actions: normalizeTimedActions(value.scamLinks.actions),
            },
        };
    }, []);

    const normalizeCommandChannelsConfig = React.useCallback((value: AutomodCommandChannelsConfig): AutomodCommandChannelsConfig => ({
        mode: value.mode === 'blocklist' ? 'blocklist' : 'allowlist',
        channelIds: [...new Set(value.channelIds)],
        actions: value.actions.length
            ? value.actions.map((action) => ({
                action: typeof action.action === 'string' && action.action.trim() ? action.action.toUpperCase() : 'DELETE',
                durationText: typeof action.durationText === 'string' ? action.durationText.trim() : '',
            }))
            : [{
                action: 'DELETE',
                durationText: '',
            }],
    }), []);

    const normalizeImageFilterConfig = React.useCallback((value: AutomodImageFilterConfig): AutomodImageFilterConfig => ({
        ignoredChannels: [...new Set(value.ignoredChannels)],
        imageOnlyChannelIds: [...new Set(value.imageOnlyChannelIds)],
        denyImageChannelIds: [...new Set(value.denyImageChannelIds)],
        actions: value.actions.length
            ? value.actions.map((action) => ({
                action: typeof action.action === 'string' && action.action.trim() ? action.action.toUpperCase() : 'DELETE',
                durationText: typeof action.durationText === 'string' ? action.durationText.trim() : '',
            }))
            : [{
                action: 'DELETE',
                durationText: '',
            }],
    }), []);

    const normalizeBanwordsConfig = React.useCallback((value: AutomodBanwordsConfig): AutomodBanwordsConfig => ({
        ignoredChannels: [...new Set(value.ignoredChannels)],
        ignoredRoles: [...new Set(value.ignoredRoles)],
        words: [...new Set(value.words.map((word) => word.trim()).filter(Boolean))],
        matchWholeWordsOnly: value.matchWholeWordsOnly !== false,
        ignoreCase: value.ignoreCase !== false,
        actions: value.actions.length
            ? value.actions.map((action) => ({
                action: typeof action.action === 'string' && action.action.trim() ? action.action.toUpperCase() : 'DELETE',
                durationText: typeof action.durationText === 'string' ? action.durationText.trim() : '',
            }))
            : [{
                action: 'DELETE',
                durationText: '',
            }],
    }), []);

    const actionUsesDuration = React.useCallback((action: string) => {
        const normalized = action.toUpperCase();
        return normalized === 'WARN' || normalized === 'MUTE' || normalized === 'TIMEOUT' || normalized === 'BAN';
    }, []);

    const updateModConfig = (key: keyof ConfigState['moderationConfig'], value: string | string[]) => {
        setConfig((prev) => ({
            ...prev,
            moderationConfig: { ...prev.moderationConfig, [key]: value },
        }));
    };

    const upsertBuiltinRule = (ruleKey: string, updater: (rule: AutomodRule) => AutomodRule) => {
        setConfig((prev) => {
            const exists = prev.automodRules.find((rule) => rule.ruleKey === ruleKey);
            if (exists) {
                return {
                    ...prev,
                    automodRules: prev.automodRules.map((rule) => (rule.ruleKey === ruleKey ? updater(rule) : rule)),
                };
            }

            const createdRule: AutomodRule = updater({
                ruleKey,
                enabled: false,
                configText: '',
                ...(ruleKey === 'flood' ? { floodConfig: defaultFloodConfig() } : {}),
                ...(ruleKey === 'zalgo' ? { zalgoConfig: defaultZalgoConfig() } : {}),
                ...(ruleKey === 'emoji' ? { emojiConfig: defaultEmojiConfig() } : {}),
                ...(ruleKey === 'emoji_spam' ? { emojiSpamConfig: defaultEmojiSpamConfig() } : {}),
                ...(ruleKey === 'repeated_messages' ? { spamConfig: defaultSpamConfig() } : {}),
                ...(ruleKey === 'repeated_mentions' ? { mentionSpamConfig: defaultMentionSpamConfig() } : {}),
                ...(ruleKey === 'lines' ? { linesConfig: defaultLinesConfig() } : {}),
                ...(ruleKey === 'links' ? { linksConfig: defaultLinksConfig() } : {}),
                ...(ruleKey === 'banwords' ? { banwordsConfig: defaultBanwordsConfig() } : {}),
                ...(ruleKey === 'advertising' ? { advertisingConfig: defaultAdvertisingConfig() } : {}),
                ...(ruleKey === 'command_channels' ? { commandChannelsConfig: defaultCommandChannelsConfig() } : {}),
                ...(ruleKey === 'image_filter' ? { imageFilterConfig: defaultImageFilterConfig() } : {}),
            });

            return {
                ...prev,
                automodRules: [...prev.automodRules, createdRule],
            };
        });
    };

    const updateBuiltinConfigText = (ruleKey: string, configText: string) => {
        upsertBuiltinRule(ruleKey, (rule) => ({ ...rule, configText }));
    };

    // Ensure all built-in rules exist in state, if not, stub them out so UI always shows them
    const builtinRuleKeys = BUILTIN_RULE_ORDER;
    const rulesMap = new Map(config.automodRules.map(r => [r.ruleKey, r]));
    const displayBuiltins: AutomodRule[] = builtinRuleKeys.map(key =>
        rulesMap.get(key) || {
            ruleKey: key,
            enabled: false,
            configText: '',
            ...(key === 'flood' ? { floodConfig: defaultFloodConfig() } : {}),
            ...(key === 'zalgo' ? { zalgoConfig: defaultZalgoConfig() } : {}),
            ...(key === 'emoji' ? { emojiConfig: defaultEmojiConfig() } : {}),
            ...(key === 'emoji_spam' ? { emojiSpamConfig: defaultEmojiSpamConfig() } : {}),
            ...(key === 'repeated_messages' ? { spamConfig: defaultSpamConfig() } : {}),
            ...(key === 'repeated_mentions' ? { mentionSpamConfig: defaultMentionSpamConfig() } : {}),
            ...(key === 'lines' ? { linesConfig: defaultLinesConfig() } : {}),
            ...(key === 'links' ? { linksConfig: defaultLinksConfig() } : {}),
            ...(key === 'banwords' ? { banwordsConfig: defaultBanwordsConfig() } : {}),
            ...(key === 'advertising' ? { advertisingConfig: defaultAdvertisingConfig() } : {}),
            ...(key === 'command_channels' ? { commandChannelsConfig: defaultCommandChannelsConfig() } : {}),
            ...(key === 'image_filter' ? { imageFilterConfig: defaultImageFilterConfig() } : {}),
        }
    );

    const floodActionOptions = AUTOMOD_ACTION_OPTIONS.map((action) => ({
        id: action,
        name: locale === 'ru' ? AUTOMOD_ACTION_LABELS_RU[action] : AUTOMOD_ACTION_LABELS[action],
    }));

    const floodWindowOptions = FLOOD_WINDOW_UNITS.map((unit) => ({
        id: unit,
        name: tr(
            unit === 'seconds' ? '\u0421\u0435\u043a\u0443\u043d\u0434\u044b' : unit === 'minutes' ? '\u041c\u0438\u043d\u0443\u0442\u044b' : unit === 'hours' ? '\u0427\u0430\u0441\u044b' : '\u0414\u043d\u0438',
            unit === 'seconds' ? 'Seconds' : unit === 'minutes' ? 'Minutes' : unit === 'hours' ? 'Hours' : 'Days',
        ),
    }));

    const customRuleTypeOptions = CUSTOM_RULE_TYPES.map((type) => ({
        id: type,
        name: type === 'regex'
            ? tr('\u0420\u0435\u0433\u0443\u043b\u044f\u0440\u043d\u043e\u0435 \u0432\u044b\u0440\u0430\u0436\u0435\u043d\u0438\u0435', 'Regex')
            : tr('\u0421\u043f\u0438\u0441\u043e\u043a \u043a\u043b\u044e\u0447\u0435\u0432\u044b\u0445 \u0441\u043b\u043e\u0432', 'Keyword List'),
    }));

    const customRuleActionOptions = CUSTOM_RULE_ACTIONS.map((action) => ({
        // CUSTOM_RULE_ACTIONS is a subset of AUTOMOD_ACTION_OPTIONS.
        // Cast keeps strict indexing without widening to string.
        id: action as (typeof AUTOMOD_ACTION_OPTIONS)[number],
        name: locale === 'ru' ? AUTOMOD_ACTION_LABELS_RU[action as (typeof AUTOMOD_ACTION_OPTIONS)[number]] : AUTOMOD_ACTION_LABELS[action as (typeof AUTOMOD_ACTION_OPTIONS)[number]],
    }));

    const sanctionActionOptions = SANCTION_ACTIONS.map((action) => ({
        // SANCTION_ACTIONS is also a subset of AUTOMOD_ACTION_OPTIONS.
        id: action as (typeof AUTOMOD_ACTION_OPTIONS)[number],
        name: locale === 'ru' ? AUTOMOD_ACTION_LABELS_RU[action as (typeof AUTOMOD_ACTION_OPTIONS)[number]] : AUTOMOD_ACTION_LABELS[action as (typeof AUTOMOD_ACTION_OPTIONS)[number]],
    }));

    const actionBadgeVariant = React.useCallback((action: string): 'default' | 'success' | 'danger' | 'warning' => {
        const normalized = action.toUpperCase();
        if (normalized === 'DELETE' || normalized === 'BAN') return 'danger';
        if (normalized === 'KICK' || normalized === 'TIMEOUT' || normalized === 'MUTE') return 'warning';
        if (normalized === 'WARN') return 'success';
        return 'default';
    }, []);

    const getActionLabel = React.useCallback((action: string) => {
        const key = action.toUpperCase() as keyof typeof AUTOMOD_ACTION_LABELS;
        if (locale === 'ru') {
            return AUTOMOD_ACTION_LABELS_RU[key] ?? action;
        }

        return AUTOMOD_ACTION_LABELS[key] ?? action;
    }, [locale]);

    const getTemplateName = React.useCallback((name: string) => {
        if (locale !== 'ru') return name;
        if (name === 'Hidden phishing links') return '\u0421\u043a\u0440\u044b\u0442\u044b\u0435 \u0444\u0438\u0448\u0438\u043d\u0433-\u0441\u0441\u044b\u043b\u043a\u0438';
        if (name === 'Crypto ads') return '\u041a\u0440\u0438\u043f\u0442\u043e-\u0440\u0435\u043a\u043b\u0430\u043c\u0430';
        if (name === 'Shortener links') return '\u0421\u043e\u043a\u0440\u0430\u0449\u0451\u043d\u043d\u044b\u0435 \u0441\u0441\u044b\u043b\u043a\u0438';
        return name;
    }, [locale]);

    const getFloodConfig = React.useCallback((rule?: AutomodRule | null): AutomodFloodConfig => {
        const source = rule?.floodConfig ?? defaultFloodConfig();
        return cloneFloodConfig(source);
    }, [cloneFloodConfig, defaultFloodConfig]);

    const getZalgoConfig = React.useCallback((rule?: AutomodRule | null): AutomodZalgoConfig => (
        normalizeZalgoConfig(rule?.zalgoConfig ?? defaultZalgoConfig())
    ), [defaultZalgoConfig, normalizeZalgoConfig]);

    const getEmojiConfig = React.useCallback((rule?: AutomodRule | null): AutomodEmojiConfig => (
        normalizeEmojiConfig(rule?.emojiConfig ?? defaultEmojiConfig())
    ), [defaultEmojiConfig, normalizeEmojiConfig]);

    const getEmojiSpamConfig = React.useCallback((rule?: AutomodRule | null): AutomodEmojiSpamConfig => (
        normalizeEmojiSpamConfig(rule?.emojiSpamConfig ?? defaultEmojiSpamConfig())
    ), [defaultEmojiSpamConfig, normalizeEmojiSpamConfig]);

    const getSpamConfig = React.useCallback((rule?: AutomodRule | null): AutomodSpamConfig => (
        normalizeSpamConfig(rule?.spamConfig ?? defaultSpamConfig())
    ), [defaultSpamConfig, normalizeSpamConfig]);

    const getMentionSpamConfig = React.useCallback((rule?: AutomodRule | null): AutomodMentionSpamConfig => (
        normalizeMentionSpamConfig(rule?.mentionSpamConfig ?? defaultMentionSpamConfig())
    ), [defaultMentionSpamConfig, normalizeMentionSpamConfig]);

    const getLinesConfig = React.useCallback((rule?: AutomodRule | null): AutomodLinesConfig => (
        normalizeLinesConfig(rule?.linesConfig ?? defaultLinesConfig())
    ), [defaultLinesConfig, normalizeLinesConfig]);

    const getLinksConfig = React.useCallback((rule?: AutomodRule | null): AutomodLinksConfig => (
        normalizeLinksConfig(rule?.linksConfig ?? defaultLinksConfig())
    ), [defaultLinksConfig, normalizeLinksConfig]);

    const getBanwordsConfig = React.useCallback((rule?: AutomodRule | null): AutomodBanwordsConfig => (
        normalizeBanwordsConfig(rule?.banwordsConfig ?? defaultBanwordsConfig())
    ), [defaultBanwordsConfig, normalizeBanwordsConfig]);

    const getAdvertisingConfig = React.useCallback((rule?: AutomodRule | null): AutomodAdvertisingConfig => (
        normalizeAdvertisingConfig(rule?.advertisingConfig ?? defaultAdvertisingConfig())
    ), [defaultAdvertisingConfig, normalizeAdvertisingConfig]);

    const getCommandChannelsConfig = React.useCallback((rule?: AutomodRule | null): AutomodCommandChannelsConfig => (
        normalizeCommandChannelsConfig(rule?.commandChannelsConfig ?? defaultCommandChannelsConfig())
    ), [defaultCommandChannelsConfig, normalizeCommandChannelsConfig]);

    const getImageFilterConfig = React.useCallback((rule?: AutomodRule | null): AutomodImageFilterConfig => (
        normalizeImageFilterConfig(rule?.imageFilterConfig ?? defaultImageFilterConfig())
    ), [defaultImageFilterConfig, normalizeImageFilterConfig]);

    const openFloodModal = () => {
        const savedFloodRule = config.automodRules.find((rule) => rule.ruleKey === 'flood');
        setFloodDraft(normalizeFloodConfig(getFloodConfig(savedFloodRule ?? null)));
        setIsFloodModalOpen(true);
    };

    const closeFloodModal = () => {
        setIsFloodModalOpen(false);
        setFloodDraft(null);
    };

    const openZalgoModal = () => {
        const savedZalgoRule = config.automodRules.find((rule) => rule.ruleKey === 'zalgo');
        setZalgoDraft(getZalgoConfig(savedZalgoRule ?? null));
        setIsZalgoModalOpen(true);
    };

    const closeZalgoModal = () => {
        setIsZalgoModalOpen(false);
        setZalgoDraft(null);
    };

    const openEmojiModal = () => {
        const savedEmojiRule = config.automodRules.find((rule) => rule.ruleKey === 'emoji');
        setEmojiDraft(getEmojiConfig(savedEmojiRule ?? null));
        setIsEmojiModalOpen(true);
    };

    const closeEmojiModal = () => {
        setIsEmojiModalOpen(false);
        setEmojiDraft(null);
    };

    const openEmojiSpamModal = () => {
        const savedEmojiSpamRule = config.automodRules.find((rule) => rule.ruleKey === 'emoji_spam');
        setEmojiSpamDraft(getEmojiSpamConfig(savedEmojiSpamRule ?? null));
        setIsEmojiSpamModalOpen(true);
    };

    const closeEmojiSpamModal = () => {
        setIsEmojiSpamModalOpen(false);
        setEmojiSpamDraft(null);
    };

    const openSpamModal = () => {
        const savedSpamRule = config.automodRules.find((rule) => rule.ruleKey === 'repeated_messages');
        setSpamDraft(getSpamConfig(savedSpamRule ?? null));
        setIsSpamModalOpen(true);
    };

    const closeSpamModal = () => {
        setIsSpamModalOpen(false);
        setSpamDraft(null);
    };

    const openMentionSpamModal = () => {
        const savedMentionSpamRule = config.automodRules.find((rule) => rule.ruleKey === 'repeated_mentions');
        setMentionSpamDraft(getMentionSpamConfig(savedMentionSpamRule ?? null));
        setIsMentionSpamModalOpen(true);
    };

    const closeMentionSpamModal = () => {
        setIsMentionSpamModalOpen(false);
        setMentionSpamDraft(null);
    };

    const openLinesModal = () => {
        const savedLinesRule = config.automodRules.find((rule) => rule.ruleKey === 'lines');
        setLinesDraft(getLinesConfig(savedLinesRule ?? null));
        setIsLinesModalOpen(true);
    };

    const closeLinesModal = () => {
        setIsLinesModalOpen(false);
        setLinesDraft(null);
    };

    const openLinksModal = () => {
        const savedLinksRule = config.automodRules.find((rule) => rule.ruleKey === 'links');
        setLinksDraft(getLinksConfig(savedLinksRule ?? null));
        setIsLinksModalOpen(true);
    };

    const closeLinksModal = () => {
        setIsLinksModalOpen(false);
        setLinksDraft(null);
        setLinksDomainInput('');
    };

    const openBanwordsModal = () => {
        const savedBanwordsRule = config.automodRules.find((rule) => rule.ruleKey === 'banwords');
        setBanwordsDraft(getBanwordsConfig(savedBanwordsRule ?? null));
        setIsBanwordsModalOpen(true);
    };

    const closeBanwordsModal = () => {
        setIsBanwordsModalOpen(false);
        setBanwordsDraft(null);
        setBanwordsInput('');
    };

    const openAdvertisingModal = () => {
        const savedAdvertisingRule = config.automodRules.find((rule) => rule.ruleKey === 'advertising');
        setAdvertisingDraft(getAdvertisingConfig(savedAdvertisingRule ?? null));
        setAdvertisingInputs({
            referralDomain: '',
            referralPhrase: '',
            referralCode: '',
            scamDomain: '',
            scamPhrase: '',
        });
        setIsAdvertisingModalOpen(true);
    };

    const closeAdvertisingModal = () => {
        setIsAdvertisingModalOpen(false);
        setAdvertisingDraft(null);
        setAdvertisingInputs({
            referralDomain: '',
            referralPhrase: '',
            referralCode: '',
            scamDomain: '',
            scamPhrase: '',
        });
    };

    const openCommandChannelsModal = () => {
        const savedCommandChannelsRule = config.automodRules.find((rule) => rule.ruleKey === 'command_channels');
        setCommandChannelsDraft(getCommandChannelsConfig(savedCommandChannelsRule ?? null));
        setIsCommandChannelsModalOpen(true);
    };

    const closeCommandChannelsModal = () => {
        setIsCommandChannelsModalOpen(false);
        setCommandChannelsDraft(null);
    };

    const openImageFilterModal = () => {
        const savedImageFilterRule = config.automodRules.find((rule) => rule.ruleKey === 'image_filter');
        setImageFilterDraft(getImageFilterConfig(savedImageFilterRule ?? null));
        setIsImageFilterModalOpen(true);
    };

    const closeImageFilterModal = () => {
        setIsImageFilterModalOpen(false);
        setImageFilterDraft(null);
    };

    const updateFloodDraft = (patch: Partial<AutomodFloodConfig>) => {
        setFloodDraft((prev) => {
            if (!prev) return prev;

            return {
                ...prev,
                ...patch,
                actions: patch.actions ?? prev.actions,
                ignoredChannels: patch.ignoredChannels ?? prev.ignoredChannels,
                ignoredRoles: patch.ignoredRoles ?? prev.ignoredRoles,
            };
        });
    };

    const addFloodDraftAction = () => {
        setFloodDraft((prev) => (prev ? ({ ...prev, actions: [...prev.actions, defaultFloodAction()] }) : prev));
    };

    const updateFloodDraftAction = (index: number, patch: Partial<AutomodFloodAction>) => {
        setFloodDraft((prev) => {
            if (!prev) return prev;

            return {
                ...prev,
                actions: updateAtIndex(prev.actions, index, { ...prev.actions[index], ...patch }),
            };
        });
    };

    const removeFloodDraftAction = (index: number) => {
        setFloodDraft((prev) => {
            if (!prev) return prev;

            return {
                ...prev,
                actions: removeAtIndex(prev.actions, index),
            };
        });
    };

    const saveFloodModal = () => {
        if (!floodDraft) return;

        const payload = normalizeFloodConfig(floodDraft);
        upsertBuiltinRule('flood', (rule) => ({
            ...rule,
            floodConfig: payload,
        }));
        closeFloodModal();
    };

    const saveZalgoModal = () => {
        if (!zalgoDraft) return;

        const payload = normalizeZalgoConfig(zalgoDraft);
        upsertBuiltinRule('zalgo', (rule) => ({
            ...rule,
            zalgoConfig: payload,
        }));
        closeZalgoModal();
    };

    const saveEmojiModal = () => {
        if (!emojiDraft) return;

        const payload = normalizeEmojiConfig(emojiDraft);
        upsertBuiltinRule('emoji', (rule) => ({
            ...rule,
            emojiConfig: payload,
        }));
        closeEmojiModal();
    };

    const saveEmojiSpamModal = () => {
        if (!emojiSpamDraft) return;

        const payload = normalizeEmojiSpamConfig(emojiSpamDraft);
        upsertBuiltinRule('emoji_spam', (rule) => ({
            ...rule,
            emojiSpamConfig: payload,
        }));
        closeEmojiSpamModal();
    };

    const saveSpamModal = () => {
        if (!spamDraft) return;

        const payload = normalizeSpamConfig(spamDraft);
        upsertBuiltinRule('repeated_messages', (rule) => ({
            ...rule,
            spamConfig: payload,
        }));
        closeSpamModal();
    };

    const saveMentionSpamModal = () => {
        if (!mentionSpamDraft) return;

        const payload = normalizeMentionSpamConfig(mentionSpamDraft);
        upsertBuiltinRule('repeated_mentions', (rule) => ({
            ...rule,
            mentionSpamConfig: payload,
        }));
        closeMentionSpamModal();
    };

    const saveLinesModal = () => {
        if (!linesDraft) return;

        const payload = normalizeLinesConfig(linesDraft);
        upsertBuiltinRule('lines', (rule) => ({
            ...rule,
            linesConfig: payload,
        }));
        closeLinesModal();
    };

    const saveLinksModal = () => {
        if (!linksDraft) return;

        const payload = normalizeLinksConfig(linksDraft);
        upsertBuiltinRule('links', (rule) => ({
            ...rule,
            linksConfig: payload,
        }));
        closeLinksModal();
    };

    const saveBanwordsModal = () => {
        if (!banwordsDraft) return;

        const payload = normalizeBanwordsConfig(banwordsDraft);
        upsertBuiltinRule('banwords', (rule) => ({
            ...rule,
            banwordsConfig: payload,
        }));
        closeBanwordsModal();
    };

    const saveAdvertisingModal = () => {
        if (!advertisingDraft) return;

        const payload = normalizeAdvertisingConfig(advertisingDraft);
        upsertBuiltinRule('advertising', (rule) => ({
            ...rule,
            advertisingConfig: payload,
        }));
        closeAdvertisingModal();
    };

    const saveCommandChannelsModal = () => {
        if (!commandChannelsDraft) return;

        const payload = normalizeCommandChannelsConfig(commandChannelsDraft);
        upsertBuiltinRule('command_channels', (rule) => ({
            ...rule,
            commandChannelsConfig: payload,
        }));
        setConfig((prev) => ({
            ...prev,
            moderationConfig: {
                ...prev.moderationConfig,
                commandOnlyChannels: payload.channelIds,
            },
        }));
        closeCommandChannelsModal();
    };

    const saveImageFilterModal = () => {
        if (!imageFilterDraft) return;

        const payload = normalizeImageFilterConfig(imageFilterDraft);
        upsertBuiltinRule('image_filter', (rule) => ({
            ...rule,
            imageFilterConfig: payload,
        }));
        closeImageFilterModal();
    };

    const commitLinkDomains = React.useCallback((rawValue: string) => {
        const normalizedDomains = rawValue
            .split(/\s+/)
            .map((domain) => domain.trim().toLowerCase())
            .filter(Boolean);

        if (!normalizedDomains.length) {
            return;
        }

        setLinksDraft((prev) => {
            if (!prev) return prev;

            return {
                ...prev,
                domains: [...new Set([...prev.domains, ...normalizedDomains])],
            };
        });
    }, []);

    const commitBanwords = React.useCallback((rawValue: string) => {
        const normalizedWords = rawValue
            .split(/\s+/)
            .map((word) => word.trim())
            .filter(Boolean);

        if (!normalizedWords.length) {
            return;
        }

        setBanwordsDraft((prev) => {
            if (!prev) return prev;

            return {
                ...prev,
                words: [...new Set([...prev.words, ...normalizedWords])],
            };
        });
    }, []);

    const commitAdvertisingValues = React.useCallback((rawValue: string, kind: 'domain' | 'phrase' | 'code') => {
        const normalizedValues = rawValue
            .split(/\s+/)
            .map((value) => kind === 'domain' ? value.trim().toLowerCase() : value.trim())
            .filter(Boolean);

        return [...new Set(normalizedValues)];
    }, []);

    const addZalgoDraftAction = () => {
        setZalgoDraft((prev) => (prev ? ({
            ...prev,
            actions: [...prev.actions, { messageCount: 1, action: 'DELETE', durationText: '' }],
        }) : prev));
    };

    const updateZalgoDraftAction = (index: number, patch: Partial<AutomodFloodAction>) => {
        setZalgoDraft((prev) => {
            if (!prev) return prev;

            return {
                ...prev,
                actions: updateAtIndex(prev.actions, index, { ...prev.actions[index], ...patch }),
            };
        });
    };

    const removeZalgoDraftAction = (index: number) => {
        setZalgoDraft((prev) => {
            if (!prev) return prev;

            const nextActions = removeAtIndex(prev.actions, index);
            return {
                ...prev,
                actions: nextActions.length ? nextActions : [{ messageCount: 1, action: 'DELETE', durationText: '' }],
            };
        });
    };

    const addEmojiDraftAction = () => {
        setEmojiDraft((prev) => (prev ? ({
            ...prev,
            actions: [...prev.actions, { messageCount: 1, action: 'DELETE', durationText: '' }],
        }) : prev));
    };

    const updateEmojiDraftAction = (index: number, patch: Partial<AutomodFloodAction>) => {
        setEmojiDraft((prev) => {
            if (!prev) return prev;

            return {
                ...prev,
                actions: updateAtIndex(prev.actions, index, { ...prev.actions[index], ...patch }),
            };
        });
    };

    const addEmojiSpamDraftAction = () => {
        setEmojiSpamDraft((prev) => (prev ? ({
            ...prev,
            actions: [...prev.actions, { messageCount: 1, action: 'DELETE', durationText: '' }],
        }) : prev));
    };

    const updateEmojiSpamDraftAction = (index: number, patch: Partial<AutomodFloodAction>) => {
        setEmojiSpamDraft((prev) => {
            if (!prev) return prev;

            return {
                ...prev,
                actions: updateAtIndex(prev.actions, index, { ...prev.actions[index], ...patch }),
            };
        });
    };

    const removeEmojiSpamDraftAction = (index: number) => {
        setEmojiSpamDraft((prev) => {
            if (!prev) return prev;

            const nextActions = removeAtIndex(prev.actions, index);
            return {
                ...prev,
                actions: nextActions.length ? nextActions : [{ messageCount: 1, action: 'DELETE', durationText: '' }],
            };
        });
    };

    const removeEmojiDraftAction = (index: number) => {
        setEmojiDraft((prev) => {
            if (!prev) return prev;

            const nextActions = removeAtIndex(prev.actions, index);
            return {
                ...prev,
                actions: nextActions.length ? nextActions : [{ messageCount: 1, action: 'DELETE', durationText: '' }],
            };
        });
    };

    const addSpamDraftAction = () => {
        setSpamDraft((prev) => (prev ? ({
            ...prev,
            actions: [...prev.actions, { messageCount: 3, action: 'DELETE', durationText: '' }],
        }) : prev));
    };

    const updateSpamDraftAction = (index: number, patch: Partial<AutomodFloodAction>) => {
        setSpamDraft((prev) => {
            if (!prev) return prev;

            return {
                ...prev,
                actions: updateAtIndex(prev.actions, index, { ...prev.actions[index], ...patch }),
            };
        });
    };

    const removeSpamDraftAction = (index: number) => {
        setSpamDraft((prev) => {
            if (!prev) return prev;

            const nextActions = removeAtIndex(prev.actions, index);
            return {
                ...prev,
                actions: nextActions.length ? nextActions : [{ messageCount: 3, action: 'DELETE', durationText: '' }],
            };
        });
    };

    const addMentionSpamDraftAction = () => {
        setMentionSpamDraft((prev) => (prev ? ({
            ...prev,
            actions: [...prev.actions, { messageCount: 1, action: 'DELETE', durationText: '' }],
        }) : prev));
    };

    const updateMentionSpamDraftAction = (index: number, patch: Partial<AutomodFloodAction>) => {
        setMentionSpamDraft((prev) => {
            if (!prev) return prev;

            return {
                ...prev,
                actions: updateAtIndex(prev.actions, index, { ...prev.actions[index], ...patch }),
            };
        });
    };

    const removeMentionSpamDraftAction = (index: number) => {
        setMentionSpamDraft((prev) => {
            if (!prev) return prev;

            const nextActions = removeAtIndex(prev.actions, index);
            return {
                ...prev,
                actions: nextActions.length ? nextActions : [{ messageCount: 1, action: 'DELETE', durationText: '' }],
            };
        });
    };

    const addLinesDraftAction = () => {
        setLinesDraft((prev) => (prev ? ({
            ...prev,
            actions: [...prev.actions, { action: 'DELETE', durationText: '' }],
        }) : prev));
    };

    const updateLinesDraftAction = (index: number, patch: Partial<AutomodActionConfig>) => {
        setLinesDraft((prev) => {
            if (!prev) return prev;

            return {
                ...prev,
                actions: updateAtIndex(prev.actions, index, { ...prev.actions[index], ...patch }),
            };
        });
    };

    const removeLinesDraftAction = (index: number) => {
        setLinesDraft((prev) => {
            if (!prev) return prev;

            const nextActions = removeAtIndex(prev.actions, index);
            return {
                ...prev,
                actions: nextActions.length ? nextActions : [{ action: 'DELETE', durationText: '' }],
            };
        });
    };

    const addLinksDraftAction = () => {
        setLinksDraft((prev) => (prev ? ({
            ...prev,
            actions: [...prev.actions, { action: 'DELETE', durationText: '' }],
        }) : prev));
    };

    const updateLinksDraftAction = (index: number, patch: Partial<AutomodActionConfig>) => {
        setLinksDraft((prev) => {
            if (!prev) return prev;

            return {
                ...prev,
                actions: updateAtIndex(prev.actions, index, { ...prev.actions[index], ...patch }),
            };
        });
    };

    const removeLinksDraftAction = (index: number) => {
        setLinksDraft((prev) => {
            if (!prev) return prev;

            const nextActions = removeAtIndex(prev.actions, index);
            return {
                ...prev,
                actions: nextActions.length ? nextActions : [{ action: 'DELETE', durationText: '' }],
            };
        });
    };

    const addBanwordsDraftAction = () => {
        setBanwordsDraft((prev) => (prev ? ({
            ...prev,
            actions: [...prev.actions, { action: 'DELETE', durationText: '' }],
        }) : prev));
    };

    const updateBanwordsDraftAction = (index: number, patch: Partial<AutomodActionConfig>) => {
        setBanwordsDraft((prev) => {
            if (!prev) return prev;

            return {
                ...prev,
                actions: updateAtIndex(prev.actions, index, { ...prev.actions[index], ...patch }),
            };
        });
    };

    const removeBanwordsDraftAction = (index: number) => {
        setBanwordsDraft((prev) => {
            if (!prev) return prev;

            const nextActions = removeAtIndex(prev.actions, index);
            return {
                ...prev,
                actions: nextActions.length ? nextActions : [{ action: 'DELETE', durationText: '' }],
            };
        });
    };

    const updateAdvertisingDraft = (patch: Partial<AutomodAdvertisingConfig>) => {
        setAdvertisingDraft((prev) => {
            if (!prev) return prev;

            return {
                ...prev,
                ...patch,
                ignoredChannels: patch.ignoredChannels ?? prev.ignoredChannels,
                discordInvites: patch.discordInvites ?? prev.discordInvites,
                referrals: patch.referrals ?? prev.referrals,
                scamLinks: patch.scamLinks ?? prev.scamLinks,
            };
        });
    };

    const updateAdvertisingCategoryActions = (
        section: 'discordInvites' | 'referrals' | 'scamLinks',
        updater: (actions: AutomodActionConfig[]) => AutomodActionConfig[]
    ) => {
        setAdvertisingDraft((prev) => {
            if (!prev) return prev;

            return {
                ...prev,
                [section]: {
                    ...prev[section],
                    actions: updater(prev[section].actions),
                },
            };
        });
    };

    const addAdvertisingAction = (section: 'discordInvites' | 'referrals' | 'scamLinks') => {
        updateAdvertisingCategoryActions(section, (actions) => [...actions, { action: 'DELETE', durationText: '' }]);
    };

    const updateAdvertisingAction = (
        section: 'discordInvites' | 'referrals' | 'scamLinks',
        index: number,
        patch: Partial<AutomodActionConfig>
    ) => {
        updateAdvertisingCategoryActions(section, (actions) => updateAtIndex(actions, index, { ...actions[index], ...patch }));
    };

    const removeAdvertisingAction = (section: 'discordInvites' | 'referrals' | 'scamLinks', index: number) => {
        updateAdvertisingCategoryActions(section, (actions) => {
            const nextActions = removeAtIndex(actions, index);
            return nextActions.length ? nextActions : [{ action: 'DELETE', durationText: '' }];
        });
    };

    const addCommandChannelsDraftAction = () => {
        setCommandChannelsDraft((prev) => (prev ? ({
            ...prev,
            actions: [...prev.actions, { action: 'DELETE', durationText: '' }],
        }) : prev));
    };

    const updateCommandChannelsDraftAction = (index: number, patch: Partial<AutomodActionConfig>) => {
        setCommandChannelsDraft((prev) => {
            if (!prev) return prev;

            return {
                ...prev,
                actions: updateAtIndex(prev.actions, index, { ...prev.actions[index], ...patch }),
            };
        });
    };

    const addImageFilterDraftAction = () => {
        setImageFilterDraft((prev) => (prev ? ({
            ...prev,
            actions: [...prev.actions, { action: 'DELETE', durationText: '' }],
        }) : prev));
    };

    const updateImageFilterDraftAction = (index: number, patch: Partial<AutomodActionConfig>) => {
        setImageFilterDraft((prev) => {
            if (!prev) return prev;

            return {
                ...prev,
                actions: updateAtIndex(prev.actions, index, { ...prev.actions[index], ...patch }),
            };
        });
    };

    const removeImageFilterDraftAction = (index: number) => {
        setImageFilterDraft((prev) => {
            if (!prev) return prev;

            const nextActions = removeAtIndex(prev.actions, index);
            return {
                ...prev,
                actions: nextActions.length ? nextActions : [{ action: 'DELETE', durationText: '' }],
            };
        });
    };

    const removeCommandChannelsDraftAction = (index: number) => {
        setCommandChannelsDraft((prev) => {
            if (!prev) return prev;

            const nextActions = removeAtIndex(prev.actions, index);
            return {
                ...prev,
                actions: nextActions.length ? nextActions : [{ action: 'DELETE', durationText: '' }],
            };
        });
    };

    const commitAdvertisingList = (
        section: 'referrals' | 'scamLinks',
        field: 'customDomains' | 'customPhrases' | 'customCodeTokens',
        rawValue: string
    ) => {
        const normalizedValues = commitAdvertisingValues(
            rawValue,
            field === 'customDomains' ? 'domain' : field === 'customCodeTokens' ? 'code' : 'phrase'
        );

        if (!normalizedValues.length) {
            return;
        }

        setAdvertisingDraft((prev) => {
            if (!prev) return prev;

            if (section === 'referrals') {
                const currentValues =
                    field === 'customDomains'
                        ? prev.referrals.customDomains
                        : field === 'customPhrases'
                            ? prev.referrals.customPhrases
                            : prev.referrals.customCodeTokens;

                return {
                    ...prev,
                    referrals: {
                        ...prev.referrals,
                        [field]: [...new Set([...currentValues, ...normalizedValues])],
                    },
                };
            }

            if (field === 'customCodeTokens') {
                return prev;
            }

            const currentValues =
                field === 'customDomains'
                    ? prev.scamLinks.customDomains
                    : prev.scamLinks.customPhrases;

            return {
                ...prev,
                scamLinks: {
                    ...prev.scamLinks,
                    [field]: [...new Set([...currentValues, ...normalizedValues])],
                },
            };
        });
    };

    const renderAdvertisingActions = (
        section: 'discordInvites' | 'referrals' | 'scamLinks',
        actions: AutomodActionConfig[],
        description: string,
    ) => (
        <div className="rounded-[28px] border border-white/10 bg-black/25 p-3.5 shadow-inner">
            <div className="mb-3.5 flex items-center justify-between gap-4">
                <div>
                    <p className="text-sm font-semibold text-white/80">{tr('Действия', 'Actions')}</p>
                    <p className="text-xs text-white/40">{description}</p>
                </div>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-white/40">
                    {actions.length}
                </span>
            </div>

            <div className="space-y-3.5">
                {actions.map((action, index) => (
                    <div key={`${section}-${action.action}-${index}`} className="rounded-[22px] border border-white/10 bg-black/20 p-3.5">
                        <div className="grid grid-cols-1 gap-3.5 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_56px]">
                            <div className="min-w-0">
                                <InteractiveSelect
                                    label={tr('\u0414\u0435\u0439\u0441\u0442\u0432\u0438\u0435', 'Action')}
                                    value={action.action}
                                    onChange={(value) => updateAdvertisingAction(section, index, {
                                        action: value,
                                        durationText: actionUsesDuration(value) ? action.durationText : '',
                                    })}
                                    options={floodActionOptions}
                                />
                            </div>
                            <div className="min-w-0">
                                <TextField
                                    label={tr('Длительность', 'Duration')}
                                    value={action.durationText}
                                    onChange={(value) => updateAdvertisingAction(section, index, { durationText: value })}
                                    placeholder={tr('30m, 2h, 7d', '30m, 2h, 7d')}
                                    inputClassName="h-[54px] py-0"
                                    disabled={!actionUsesDuration(action.action)}
                                />
                            </div>
                            <div className="flex items-end">
                                <button
                                    type="button"
                                    onClick={() => removeAdvertisingAction(section, index)}
                                    className="flex h-[54px] w-full items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white/50 transition-all hover:border-rose-400/40 hover:bg-rose-500/15 hover:text-white"
                                >
                                    <Trash size={18} />
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <button
                type="button"
                onClick={() => addAdvertisingAction(section)}
                className="mt-3.5 flex w-full items-center justify-center gap-2 rounded-[20px] border border-dashed border-[var(--color-primary-1)]/50 bg-[var(--color-primary-1)]/8 py-3 text-sm font-bold tracking-wide text-[var(--color-primary-1)] transition-all hover:bg-[var(--color-primary-1)]/16"
            >
                <Plus size={18} weight="bold" />
                {tr('Добавить действие', 'Add Action')}
            </button>
        </div>
    );

    const toggleBuiltin = (ruleKey: string, enabled: boolean) => {
        upsertBuiltinRule(ruleKey, (rule) => ({ ...rule, enabled }));
    };

    // Custom Rules Handlers
    const addCustomRule = () => {
        if (config.customRules.length >= 10) return;
        setConfig(prev => ({
            ...prev,
            customRules: [...prev.customRules, { 
                name: tr('\u041d\u043e\u0432\u043e\u0435 \u043f\u0440\u0430\u0432\u0438\u043b\u043e', 'New Custom Rule'), ruleType: 'regex', pattern: '', enabled: true, action: 'DELETE', strikeWeight: 1, notes: '' 
            }]
        }));
    };

    const applyTemplate = (tpl: CustomRule) => {
        if (config.customRules.length >= 10) return;
        setConfig(prev => ({
            ...prev,
            customRules: [...prev.customRules, { ...tpl }]
        }));
    };

    const updateCustomRule = (index: number, val: Partial<CustomRule>) => {
        setConfig(prev => ({
            ...prev,
            customRules: updateAtIndex(prev.customRules, index, { ...prev.customRules[index], ...val })
        }));
    };

    const removeCustomRule = (index: number) => {
        setConfig(prev => ({
            ...prev,
            customRules: removeAtIndex(prev.customRules, index)
        }));
    };

    // Sanction Steps Handlers
    const addSanctionStep = () => {
        setConfig(prev => ({
            ...prev,
            sanctionSteps: [...prev.sanctionSteps, { triggerStrikeCount: prev.sanctionSteps.length + 1, actionType: 'TIMEOUT', durationMinutes: 60, enabled: true, sortOrder: prev.sanctionSteps.length }]
        }));
    };

    const updateSanctionStep = (index: number, val: Partial<SanctionStep>) => {
        setConfig(prev => ({
            ...prev,
            sanctionSteps: updateAtIndex(prev.sanctionSteps, index, { ...prev.sanctionSteps[index], ...val })
        }));
    };

    const removeSanctionStep = (index: number) => {
        setConfig(prev => ({
            ...prev,
            sanctionSteps: removeAtIndex(prev.sanctionSteps, index)
        }));
    };

    return (
        <div className="space-y-8 animate-fade-in">
            <AnimatedCard
                title={tr('Игнорируемые категории', 'Ignored Categories')}
                subtitle={tr('Роли и каналы, где игнорируются все правила автомодерации на всём сервере.', 'Roles and channels where all AutoMod rules are ignored server-wide.')}
            >
                <div className="grid grid-cols-1 gap-8 p-2 lg:grid-cols-2">
                    <MultiSelectField
                        label={tr('Игнорируемые роли', 'Ignored Roles')}
                        options={config.roles}
                        selected={config.moderationConfig.ignoredRoles}
                        onChange={(keys) => updateModConfig('ignoredRoles', keys)}
                        placeholder={tr('Выберите роли, которые автомод всегда игнорирует...', 'Select roles AutoMod should always ignore...')}
                    />
                    <MultiSelectField
                        label={tr('Игнорируемые каналы и категории', 'Ignored Channels and Categories')}
                        options={config.channels}
                        selected={config.moderationConfig.ignoredChannels}
                        onChange={(keys) => updateModConfig('ignoredChannels', keys)}
                        placeholder={tr('Выберите каналы или категории, где автомод отключён...', 'Select channels or categories where AutoMod is disabled...')}
                    />
                </div>
            </AnimatedCard>
             
            {/* Built-in Filters */}
            <AnimatedCard title={tr('Встроенные фильтры', 'Built-in Filters')} subtitle={tr('Настройте базовые правила модерации', 'Configure basic moderation rules')}>
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    {displayBuiltins.map((rule) => {
                        const isFlood = rule.ruleKey === 'flood';
                        const isZalgo = rule.ruleKey === 'zalgo';
                        const isEmoji = rule.ruleKey === 'emoji';
                        const isEmojiSpam = rule.ruleKey === 'emoji_spam';
                        const isSpam = rule.ruleKey === 'repeated_messages';
                        const isMentionSpam = rule.ruleKey === 'repeated_mentions';
                        const isLines = rule.ruleKey === 'lines';
                        const isLinks = rule.ruleKey === 'links';
                        const isBanwords = rule.ruleKey === 'banwords';
                        const isAdvertising = rule.ruleKey === 'advertising';
                        const isCommandChannels = rule.ruleKey === 'command_channels';
                        const isImageFilter = rule.ruleKey === 'image_filter';

                        return (
                            <div
                                key={rule.ruleKey}
                                style={rule.enabled ? { borderColor: 'rgb(122, 170, 122)' } : undefined}
                                className={`relative flex flex-col overflow-hidden rounded-2xl border border-white/10 transition-all duration-300 lg:h-[112px] ${
                                    rule.enabled
                                        ? 'bg-gradient-to-br from-[var(--color-primary-1)]/10 to-transparent shadow-[0_4px_20px_rgba(var(--color-primary-1-rgb),0.1)]'
                                        : 'bg-white/[0.02] hover:bg-white/[0.05]'
                                }`}
                            >
                                <div className="flex h-full cursor-pointer select-none items-start justify-between px-6 py-5" onClick={() => toggleBuiltin(rule.ruleKey, !rule.enabled)}>
                                    <div className="flex min-w-0 items-start gap-4">
                                        <div className={`rounded-xl p-2 transition-colors ${rule.enabled ? 'bg-white/5 text-[var(--color-primary-1)]' : 'bg-white/5 text-white/40'}`}>
                                            <FilterGlyph ruleKey={rule.ruleKey} active={rule.enabled} />
                                        </div>
                                        <div className="flex min-w-0 flex-1 flex-col">
                                            <span className={`block text-base font-bold tracking-wide transition-colors ${rule.enabled ? 'text-white' : 'text-white/50'}`}>
                                                {builtinLabels[rule.ruleKey] || rule.ruleKey}
                                            </span>
                                            <p className="mt-1 line-clamp-3 text-sm leading-6 text-white/40">
                                                {builtinDescriptions[rule.ruleKey] || builtinDescriptions.flood}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex shrink-0 items-center gap-5 pl-5">
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (isFlood) {
                                                    openFloodModal();
                                                    return;
                                                }

                                                if (isZalgo) {
                                                    openZalgoModal();
                                                    return;
                                                }

                                                if (isEmoji) {
                                                    openEmojiModal();
                                                    return;
                                                }

                                                if (isEmojiSpam) {
                                                    openEmojiSpamModal();
                                                    return;
                                                }

                                                if (isSpam) {
                                                    openSpamModal();
                                                    return;
                                                }

                                                if (isMentionSpam) {
                                                    openMentionSpamModal();
                                                    return;
                                                }

                                                if (isLines) {
                                                    openLinesModal();
                                                    return;
                                                }

                                                if (isLinks) {
                                                    openLinksModal();
                                                    return;
                                                }

                                                if (isBanwords) {
                                                    openBanwordsModal();
                                                    return;
                                                }

                                                if (isAdvertising) {
                                                    openAdvertisingModal();
                                                    return;
                                                }

                                                if (isCommandChannels) {
                                                    openCommandChannelsModal();
                                                    return;
                                                }

                                                if (isImageFilter) {
                                                    openImageFilterModal();
                                                    return;
                                                }

                                                setExpandedBuiltin(expandedBuiltin === rule.ruleKey ? null : rule.ruleKey);
                                            }}
                                            className={`rounded-xl p-2 transition-all ${
                                                isFlood
                                                    ? isFloodModalOpen
                                                        ? 'bg-[var(--color-primary-1)] text-white shadow-lg scale-110'
                                                        : 'text-white/40 hover:bg-white/10 hover:text-white'
                                                    : isZalgo
                                                        ? isZalgoModalOpen
                                                            ? 'bg-[var(--color-primary-1)] text-white shadow-lg scale-110'
                                                            : 'text-white/40 hover:bg-white/10 hover:text-white'
                                                    : isEmoji
                                                        ? isEmojiModalOpen
                                                            ? 'bg-[var(--color-primary-1)] text-white shadow-lg scale-110'
                                                            : 'text-white/40 hover:bg-white/10 hover:text-white'
                                                    : isEmojiSpam
                                                        ? isEmojiSpamModalOpen
                                                            ? 'bg-[var(--color-primary-1)] text-white shadow-lg scale-110'
                                                            : 'text-white/40 hover:bg-white/10 hover:text-white'
                                                    : isSpam
                                                        ? isSpamModalOpen
                                                            ? 'bg-[var(--color-primary-1)] text-white shadow-lg scale-110'
                                                            : 'text-white/40 hover:bg-white/10 hover:text-white'
                                                    : isMentionSpam
                                                        ? isMentionSpamModalOpen
                                                            ? 'bg-[var(--color-primary-1)] text-white shadow-lg scale-110'
                                                            : 'text-white/40 hover:bg-white/10 hover:text-white'
                                                    : isLines
                                                        ? isLinesModalOpen
                                                            ? 'bg-[var(--color-primary-1)] text-white shadow-lg scale-110'
                                                            : 'text-white/40 hover:bg-white/10 hover:text-white'
                                                    : isLinks
                                                        ? isLinksModalOpen
                                                            ? 'bg-[var(--color-primary-1)] text-white shadow-lg scale-110'
                                                            : 'text-white/40 hover:bg-white/10 hover:text-white'
                                                    : isBanwords
                                                        ? isBanwordsModalOpen
                                                            ? 'bg-[var(--color-primary-1)] text-white shadow-lg scale-110'
                                                            : 'text-white/40 hover:bg-white/10 hover:text-white'
                                                    : isAdvertising
                                                        ? isAdvertisingModalOpen
                                                            ? 'bg-[var(--color-primary-1)] text-white shadow-lg scale-110'
                                                            : 'text-white/40 hover:bg-white/10 hover:text-white'
                                                    : isCommandChannels
                                                        ? isCommandChannelsModalOpen
                                                            ? 'bg-[var(--color-primary-1)] text-white shadow-lg scale-110'
                                                            : 'text-white/40 hover:bg-white/10 hover:text-white'
                                                    : isImageFilter
                                                        ? isImageFilterModalOpen
                                                            ? 'bg-[var(--color-primary-1)] text-white shadow-lg scale-110'
                                                            : 'text-white/40 hover:bg-white/10 hover:text-white'
                                                    : expandedBuiltin === rule.ruleKey
                                                        ? 'bg-[var(--color-primary-1)] text-white shadow-lg scale-110'
                                                        : 'text-white/40 hover:bg-white/10 hover:text-white'
                                            }`}
                                        >
                                            <Gear
                                                size={20}
                                                weight={
                                                    isFlood
                                                        ? (isFloodModalOpen ? 'fill' : 'regular')
                                                        : isZalgo
                                                            ? (isZalgoModalOpen ? 'fill' : 'regular')
                                                            : isEmoji
                                                                ? (isEmojiModalOpen ? 'fill' : 'regular')
                                                                : isEmojiSpam
                                                                    ? (isEmojiSpamModalOpen ? 'fill' : 'regular')
                                                                : isSpam
                                                                    ? (isSpamModalOpen ? 'fill' : 'regular')
                                                                    : isMentionSpam
                                                                        ? (isMentionSpamModalOpen ? 'fill' : 'regular')
                                                                        : isLines
                                                                            ? (isLinesModalOpen ? 'fill' : 'regular')
                                                                            : isLinks
                                                                                ? (isLinksModalOpen ? 'fill' : 'regular')
                                                                                : isBanwords
                                                                                    ? (isBanwordsModalOpen ? 'fill' : 'regular')
                                                                                : isAdvertising
                                                                                    ? (isAdvertisingModalOpen ? 'fill' : 'regular')
                                                                                    : isCommandChannels
                                                                                        ? (isCommandChannelsModalOpen ? 'fill' : 'regular')
                                                                                        : isImageFilter
                                                                                            ? (isImageFilterModalOpen ? 'fill' : 'regular')
                                                            : (expandedBuiltin === rule.ruleKey ? 'fill' : 'regular')
                                                }
                                            />
                                        </button>
                                        <div className="pointer-events-none origin-right scale-90">
                                            <SmoothToggle label="" checked={rule.enabled} onChange={() => {}} />
                                        </div>
                                    </div>
                                </div>

                                {!isFlood && !isZalgo && !isEmoji && !isEmojiSpam && !isSpam && !isMentionSpam && !isLines && !isLinks && !isBanwords && !isAdvertising && !isCommandChannels && !isImageFilter ? (
                                    <div className={`transition-all duration-500 ease-in-out origin-top ${expandedBuiltin === rule.ruleKey ? 'max-h-[42rem] scale-y-100 opacity-100' : 'max-h-0 scale-y-0 opacity-0'}`}>
                                        <div className="space-y-5 border-t border-white/10 bg-black/40 p-5 rounded-b-2xl">
                                            <TextAreaField
                                                label={tr('JSON конфигурация (необязательно)', 'JSON Configuration (Optional)')}
                                                value={rule.configText}
                                                onChange={(v) => updateBuiltinConfigText(rule.ruleKey, v)}
                                                placeholder='{"maxMentions": 5}'
                                                rows={3}
                                            />
                                        </div>
                                    </div>
                                ) : null}
                            </div>
                        );
                    })}
                </div>
            </AnimatedCard>

            {/* Custom Rules */}
            <AnimatedCard title={tr('\u041f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044c\u0441\u043a\u0438\u0435 \u0444\u0438\u043b\u044c\u0442\u0440\u044b', 'Custom Filters')} subtitle={tr('\u0414\u043e 10 Regex \u0438\u043b\u0438 Keyword \u043f\u0440\u0430\u0432\u0438\u043b \u0434\u043b\u044f \u043c\u043e\u0434\u0435\u0440\u0430\u0446\u0438\u0438 \u0447\u0430\u0442\u0430.', 'Up to 10 custom Regex or Keyword lists.')}> 
                {config.customRules.length === 0 ? (
                    <div className="py-12 flex flex-col items-center justify-center text-white/30 border border-white/5 bg-white/[0.02] rounded-3xl mb-6">
                        <MagicWand size={48} weight="duotone" className="mb-4 opacity-50 text-[var(--color-primary-1)]" />
                        <p className="text-lg font-semibold">{tr('\u041d\u0435\u0442 \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044c\u0441\u043a\u0438\u0445 \u043f\u0440\u0430\u0432\u0438\u043b', 'No custom rules')}</p>
                        <p className="text-sm mt-1">{tr('\u0412\u044b \u043c\u043e\u0436\u0435\u0442\u0435 \u0434\u043e\u0431\u0430\u0432\u0438\u0442\u044c \u0434\u043e 10 \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044c\u0441\u043a\u0438\u0445 \u043f\u0440\u0430\u0432\u0438\u043b.', 'You can add up to 10 custom rules.')}</p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-6 mb-8">
                        {config.customRules.map((rule, idx) => (
                            <div key={idx} className={`relative flex flex-col gap-5 rounded-3xl border p-6 transition-all duration-500 ${
                                rule.enabled ? 'border-white/10 bg-black/20 backdrop-blur-md shadow-lg shadow-black/20' : 'border-white/5 bg-black/40 opacity-70 grayscale-[50%]'
                            }`}>
                                <div className="absolute top-0 right-0 w-64 h-full bg-gradient-to-l from-[var(--color-primary-1)]/5 to-transparent pointer-events-none rounded-r-3xl" />
                                
                                <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-2 relative z-10">
                                    <input 
                                        type="text" 
                                        value={rule.name} 
                                        onChange={(e) => updateCustomRule(idx, { name: e.target.value })} 
                                        className="bg-transparent text-xl font-black text-white outline-none w-1/2 focus:border-b focus:border-[var(--color-primary-1)] transition-colors placeholder:text-white/20" 
                                        placeholder={tr('\u041d\u0430\u0437\u0432\u0430\u043d\u0438\u0435 \u043f\u0440\u0430\u0432\u0438\u043b\u0430', 'Rule Name')}
                                    />
                                    <div className="flex items-center gap-5">
                                        <Badge variant={actionBadgeVariant(rule.action)} className="text-[10px] uppercase px-3 py-1 shadow-md">
                                            {getActionLabel(rule.action)}
                                        </Badge>
                                        <div className="scale-90">
                                            <SmoothToggle label="" checked={rule.enabled} onChange={(v) => updateCustomRule(idx, { enabled: v })} />
                                        </div>
                                        <button type="button" onClick={() => removeCustomRule(idx)} className="p-2 rounded-xl text-white/40 hover:text-white hover:bg-rose-500 transition-all shadow-md active:scale-95">
                                            <Trash size={20} />
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-4 gap-5 relative z-10">
                                    <InteractiveSelect label={tr('\u0422\u0438\u043f \u043f\u0440\u0430\u0432\u0438\u043b\u0430', 'Rule Type')} value={rule.ruleType} onChange={(v) => updateCustomRule(idx, { ruleType: v })} options={customRuleTypeOptions} />
                                    <InteractiveSelect label={tr('\u0414\u0435\u0439\u0441\u0442\u0432\u0438\u0435', 'Action')} value={rule.action} onChange={(v) => updateCustomRule(idx, { action: v })} options={customRuleActionOptions} />
                                    <TextField label={tr('\u0412\u0435\u0441 (\u0441\u0442\u0440\u0430\u0439\u043a\u0438)', 'Strike Weight')} type="number" value={String(rule.strikeWeight)} onChange={(v) => updateCustomRule(idx, { strikeWeight: parseInt(v) || 0 })} />
                                    <TextField label={tr('\u0417\u0430\u043c\u0435\u0442\u043a\u0438', 'Notes')} value={rule.notes} onChange={(v) => updateCustomRule(idx, { notes: v })} />
                                </div>
                                
                                <div className="relative z-10">
                                    <label className="block space-y-2 group">
                                        <span className="text-sm font-semibold tracking-wide text-white/50">{tr('\u041f\u0430\u0442\u0442\u0435\u0440\u043d', 'Pattern')}</span>
                                        <div className="relative">
                                            <input
                                                type="text"
                                                value={rule.pattern}
                                                onChange={(e) => updateCustomRule(idx, { pattern: e.target.value })}
                                                className="w-full rounded-2xl border border-[var(--color-primary-1)]/30 bg-black/40 px-5 py-4 text-sm text-[var(--color-primary-1)] font-mono outline-none focus:border-[var(--color-primary-1)] focus:ring-2 focus:ring-[var(--color-primary-1)]/30 transition-all shadow-inner"
                                            />
                                        </div>
                                    </label>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                <div className="flex flex-col sm:flex-row gap-4 mt-6">
                    <button
                        type="button"
                        onClick={addCustomRule}
                        disabled={config.customRules.length >= 10}
                        className="flex-1 flex items-center justify-center gap-3 rounded-[20px] border border-dashed border-[var(--color-primary-1)] bg-[var(--color-primary-1)]/10 py-4 text-sm font-black tracking-wide text-[var(--color-primary-1)] transition-all hover:bg-[var(--color-primary-1)]/20 shadow-[0_0_20px_rgba(var(--color-primary-1-rgb),0.1)] hover:shadow-[0_0_30px_rgba(var(--color-primary-1-rgb),0.2)] disabled:opacity-30 disabled:pointer-events-none"
                    >
                        <Plus size={20} weight="bold" /> {tr('\u0414\u043e\u0431\u0430\u0432\u0438\u0442\u044c \u043f\u0440\u0430\u0432\u0438\u043b\u043e', 'Add Rule')}
                    </button>
                    {/* Template quick injections */}
                    {CUSTOM_RULE_TEMPLATES.map((tpl, i) => (
                        <button
                            key={i}
                            type="button"
                            onClick={() => applyTemplate(tpl)}
                            disabled={config.customRules.length >= 10}
                            className="inline-flex items-center justify-center gap-2 rounded-[20px] border border-white/10 bg-white/5 px-6 py-4 text-sm font-bold text-white/70 transition-all hover:border-white/20 hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:pointer-events-none"
                        >
                            <MagicWand size={18} weight="duotone" className="text-[var(--color-primary-1)]" /> 
                            {getTemplateName(tpl.name)}
                        </button>
                    ))}
                </div>
            </AnimatedCard>

            {/* Sanction Steps / Strikes */}
            <AnimatedCard title={tr('Матрица эскалации', 'Escalation Matrix')} subtitle={tr('Настройте ступени наказания, когда пользователь накапливает страйки.', 'Configure punishment steps when user accumulates strikes.')}>
                {config.sanctionSteps.length === 0 ? (
                    <div className="py-12 flex flex-col items-center justify-center text-white/30 border border-white/5 bg-white/[0.02] rounded-3xl mb-6">
                        <WarningOctagon size={48} weight="duotone" className="mb-4 opacity-50 text-[var(--color-warning)]" />
                        <p className="text-lg font-semibold">{tr('Эскалация отключена', 'Escalation disabled')}</p>
                        <p className="text-sm mt-1">{tr('Нет настроенных ступеней наказания.', 'No sanction steps configured.')}</p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-4 mb-8">
                        {config.sanctionSteps.map((step, idx) => (
                            <div key={idx} className="flex flex-wrap md:flex-nowrap items-center gap-4 rounded-[20px] border border-white/10 bg-black/20 p-5 shadow-inner transition-all hover:bg-black/30 group">
                                <div className="flex items-center justify-center bg-white/5 rounded-xl w-12 h-12 flex-shrink-0 border border-white/10 shadow-sm font-black text-xl text-white/50 group-hover:text-white transition-colors">
                                    {idx + 1}
                                </div>
                                <div className="w-full md:w-32">
                                    <TextField label={tr('Триггер (страйки)', 'Trigger (Strikes)')} type="number" value={String(step.triggerStrikeCount)} onChange={(v) => updateSanctionStep(idx, { triggerStrikeCount: parseInt(v) || 0 })} />
                                </div>
                                <div className="w-full md:w-1/4">
                                    <InteractiveSelect label={tr('\u0422\u0438\u043f \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u044f', 'Action Type')} value={step.actionType} onChange={(v) => updateSanctionStep(idx, { actionType: v })} options={sanctionActionOptions} />
                                </div>
                                <div className="w-full md:w-1/4">
                                    <TextField label={tr('Длительность (мин)', 'Duration (min)')} type="number" value={step.durationMinutes ? String(step.durationMinutes) : ''} onChange={(v) => updateSanctionStep(idx, { durationMinutes: v ? parseInt(v) : null })} placeholder={tr('Навсегда', 'Forever')} />
                                </div>
                                <div className="flex-1 flex items-center justify-end gap-5 pt-6 md:pl-4">
                                    <div className="scale-90">
                                        <SmoothToggle label="" checked={step.enabled} onChange={(v) => updateSanctionStep(idx, { enabled: v })} />
                                    </div>
                                    <button type="button" onClick={() => removeSanctionStep(idx)} className="p-3 bg-white/5 text-white/50 hover:bg-rose-500 hover:text-white rounded-xl transition-all active:scale-95 shadow-md">
                                        <Trash size={20} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
                
                <button
                    type="button"
                    onClick={addSanctionStep}
                    className="w-full flex items-center justify-center gap-3 rounded-[20px] border border-white/10 bg-[var(--color-primary-1)]/10 py-5 text-sm font-black tracking-widest uppercase text-[var(--color-primary-1)] transition-all hover:bg-[var(--color-primary-1)]/20 shadow-inner"
                >
                    <Plus size={20} weight="bold" /> {tr('Добавить ступень', 'Add Escalation Step')}
                </button>
            </AnimatedCard>

            <Modal
                isOpen={isFloodModalOpen}
                onClose={closeFloodModal}
                size="5xl"
                scrollBehavior="inside"
                hideCloseButton
                classNames={{
                    base: "bg-[#111111] border border-[var(--border-subtle)] shadow-2xl rounded-[32px] overflow-hidden m-4",
                    backdrop: "bg-[#0e0e0e]/60 backdrop-blur-sm",
                }}
            >
                <ModalContent>
                    <div className="flex max-h-[85vh] flex-col">
                        <div className="flex shrink-0 items-center justify-between border-b border-[var(--border-divider)] bg-[var(--surface-hover)] p-6">
                            <div className="flex items-center gap-4">
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--color-primary-1)]/20 bg-[var(--color-primary-1)]/10 text-[var(--color-primary-1)]">
                                    <WarningOctagon size={20} weight="duotone" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold leading-tight text-white">
                                        {tr('Настройка флуд', 'Flood settings')}
                                    </h2>
                                    <p className="mt-0.5 text-[11px] font-medium text-[var(--text-muted)]">
                                        {tr('Окно повторения, игнорируемые цели и набор действий для реакции на флуд.', 'Repetition window, ignored targets, and flood response actions.')}
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={closeFloodModal}
                                className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--surface-card)] text-[var(--text-muted)] transition-colors hover:bg-[var(--border-divider)]"
                                aria-label={tr('Закрыть', 'Close')}
                            >
                                <X size={14} weight="bold" />
                            </button>
                        </div>

                        <div className="custom-scrollbar flex-1 overflow-y-auto bg-[var(--surface-modal)] px-6 py-5">
                            {floodDraft ? (
                                <div className="space-y-5">
                                    <MultiSelectField
                                        label={tr('Игнорируемые каналы', 'Ignored Channels')}
                                        options={config.channels}
                                        selected={floodDraft.ignoredChannels}
                                        onChange={(keys) => updateFloodDraft({ ignoredChannels: keys })}
                                        placeholder={tr('Выберите каналы или категории...', 'Select channels or categories...')}
                                    />

                                    <div className="rounded-[28px] border border-white/10 bg-black/25 p-3.5 shadow-inner">
                                        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-[minmax(0,1fr)_240px]">
                                            <div className="min-w-0">
                                                <TextField
                                                    label={tr('Окно повторения', 'Repetition window')}
                                                    type="number"
                                                    value={String(floodDraft.windowValue)}
                                                    onChange={(value) => updateFloodDraft({
                                                        windowValue: Math.max(1, parseInt(value, 10) || 0),
                                                    })}
                                                    placeholder="1"
                                                />
                                            </div>
                                            <div className="min-w-0">
                                                <InteractiveSelect
                                                    label={tr('Единица времени', 'Time unit')}
                                                    value={floodDraft.windowUnit}
                                                    onChange={(value) => updateFloodDraft({ windowUnit: value as AutomodFloodConfig['windowUnit'] })}
                                                    options={floodWindowOptions}
                                                    placeholder={tr('Единица', 'Unit')}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                                        <MultiSelectField
                                            label={tr('Игнорируемые роли', 'Ignored Roles')}
                                            options={config.roles}
                                            selected={floodDraft.ignoredRoles}
                                            onChange={(keys) => updateFloodDraft({ ignoredRoles: keys })}
                                            placeholder={tr('Выберите роли для этого фильтра...', 'Select roles for this filter...')}
                                        />
                                    </div>

                                    <div className="rounded-[28px] border border-white/10 bg-black/25 p-3.5 shadow-inner">
                                        <div className="mb-3.5 flex items-center justify-between gap-4">
                                            <div>
                                                <p className="text-sm font-semibold text-white/80">{tr('Действия', 'Actions')}</p>
                                                <p className="text-xs text-white/40">{tr('Каждая строка добавляет отдельную ступень реакции на флуд. Сообщение, вызвавшее фильтр, всё равно будет удалено даже при выборе другого действия.', 'Each row adds a separate flood response step. The message that triggered the filter will still be deleted even if another action is selected.')}</p>
                                            </div>
                                            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-white/40">
                                                {floodDraft.actions.length}
                                            </span>
                                        </div>

                                        {floodDraft.actions.length > 0 ? (
                                            <div className="space-y-3.5">
                                                {floodDraft.actions.map((action, index) => (
                                                    <div key={`${action.action}-${index}`} className="rounded-[22px] border border-white/10 bg-black/20 p-3.5">
                                                        <div className="grid grid-cols-1 gap-3.5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)_minmax(0,1fr)_56px]">
                                                            <div className="min-w-0">
                                                                <TextField
                                                                    label={tr('Количество сообщений', 'Message Count')}
                                                                    type="number"
                                                                    value={String(action.messageCount)}
                                                                    onChange={(value) => updateFloodDraftAction(index, {
                                                                        messageCount: Math.max(1, parseInt(value, 10) || 0),
                                                                    })}
                                                                    placeholder="6"
                                                                />
                                                            </div>
                                                            <div className="min-w-0">
                                                                <InteractiveSelect
                                                                    label={tr('\u0414\u0435\u0439\u0441\u0442\u0432\u0438\u0435', 'Action')}
                                                                    value={action.action}
                                                                    onChange={(value) => updateFloodDraftAction(index, {
                                                                        action: value,
                                                                        durationText: actionUsesDuration(value) ? action.durationText : '',
                                                                    })}
                                                                    options={floodActionOptions}
                                                                />
                                                            </div>
                                                            <div className="min-w-0">
                                                                <TextField
                                                                    label={tr('Длительность', 'Duration')}
                                                                    value={action.durationText}
                                                                    onChange={(value) => updateFloodDraftAction(index, { durationText: value })}
                                                                    placeholder={tr('30m, 2h, 7d', '30m, 2h, 7d')}
                                                                    inputClassName="h-[54px] py-0"
                                                                    disabled={!actionUsesDuration(action.action)}
                                                                />
                                                            </div>
                                                            <div className="flex items-end">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => removeFloodDraftAction(index)}
                                                                    className="flex h-[54px] w-full items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white/50 transition-all hover:border-rose-400/40 hover:bg-rose-500/15 hover:text-white"
                                                                >
                                                                    <Trash size={18} />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={addFloodDraftAction}
                                                className="flex h-[56px] w-full items-center justify-center gap-3 rounded-[20px] border border-dashed border-[var(--color-primary-1)]/50 bg-[var(--color-primary-1)]/8 px-4 py-3 text-sm font-bold tracking-wide text-[var(--color-primary-1)] transition-all hover:bg-[var(--color-primary-1)]/16"
                                            >
                                                <Plus size={18} weight="bold" />
                                                {tr('Добавить действие', 'Add Action')}
                                            </button>
                                        )}

                                        {floodDraft.actions.length > 0 ? (
                                            <button
                                                type="button"
                                                onClick={addFloodDraftAction}
                                                className="mt-3.5 flex w-full items-center justify-center gap-2 rounded-[20px] border border-dashed border-[var(--color-primary-1)]/50 bg-[var(--color-primary-1)]/8 py-3 text-sm font-bold tracking-wide text-[var(--color-primary-1)] transition-all hover:bg-[var(--color-primary-1)]/16"
                                            >
                                                <Plus size={18} weight="bold" />
                                                {tr('Добавить действие', 'Add Action')}
                                            </button>
                                        ) : null}
                                    </div>
                                </div>
                            ) : null}
                        </div>

                        <div className="shrink-0 border-t border-[var(--border-divider)] bg-[var(--surface-hover)] px-6 py-4">
                            <div className="ml-auto flex w-full max-w-fit items-center justify-end gap-4">
                                <button
                                    type="button"
                                    onClick={closeFloodModal}
                                    className="inline-flex h-12 min-w-[140px] items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-5 text-sm font-semibold text-white/70 transition-all hover:bg-white/10 hover:text-white"
                                >
                                    {tr('Отмена', 'Cancel')}
                                </button>
                                <button
                                    type="button"
                                    onClick={saveFloodModal}
                                    disabled={!floodDraft}
                                    className="inline-flex h-12 min-w-[156px] items-center justify-center rounded-2xl bg-[var(--color-primary-1)] px-5 text-sm font-bold text-black transition-all hover:bg-[var(--color-primary-2)] disabled:pointer-events-none disabled:opacity-40"
                                >
                                    {tr('Сохранить', 'Save')}
                                </button>
                            </div>
                        </div>
                    </div>
                </ModalContent>
            </Modal>

            <Modal
                isOpen={isZalgoModalOpen}
                onClose={closeZalgoModal}
                size="5xl"
                scrollBehavior="inside"
                hideCloseButton
                classNames={{
                    base: "bg-[#111111] border border-[var(--border-subtle)] shadow-2xl rounded-[32px] overflow-hidden m-4",
                    backdrop: "bg-[#0e0e0e]/60 backdrop-blur-sm",
                }}
            >
                <ModalContent>
                    <div className="flex max-h-[85vh] flex-col">
                        <div className="flex shrink-0 items-center justify-between border-b border-[var(--border-divider)] bg-[var(--surface-hover)] p-6">
                            <div className="flex items-center gap-4">
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--color-primary-1)]/20 bg-[var(--color-primary-1)]/10 text-[var(--color-primary-1)]">
                                    <WarningOctagon size={20} weight="duotone" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold leading-tight text-white">
                                        {tr('Настройка зальго', 'Zalgo settings')}
                                    </h2>
                                    <p className="mt-0.5 text-[11px] font-medium text-[var(--text-muted)]">
                                        {tr('Настройте процент зальго в сообщении и ступени реакции по количеству таких сообщений.', 'Set the Zalgo percentage in a message and the response steps by the number of such messages.')}
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={closeZalgoModal}
                                className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--surface-card)] text-[var(--text-muted)] transition-colors hover:bg-[var(--border-divider)]"
                                aria-label={tr('Закрыть', 'Close')}
                            >
                                <X size={14} weight="bold" />
                            </button>
                        </div>

                        <div className="custom-scrollbar flex-1 overflow-y-auto bg-[var(--surface-modal)] px-6 py-5">
                            {zalgoDraft ? (
                                <div className="space-y-5">
                                    <MultiSelectField
                                        label={tr('Игнорируемые каналы', 'Ignored Channels')}
                                        options={config.channels}
                                        selected={zalgoDraft.ignoredChannels}
                                        onChange={(keys) => setZalgoDraft((prev) => prev ? ({ ...prev, ignoredChannels: keys }) : prev)}
                                        placeholder={tr('Выберите каналы или категории...', 'Select channels or categories...')}
                                    />

                                    <div className="rounded-[28px] border border-white/10 bg-black/25 p-3.5 shadow-inner">
                                        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-[minmax(0,1fr)_140px]">
                                            <div className="min-w-0">
                                                <TextField
                                                    label={tr('Процент зальго в сообщении', 'Zalgo percent in message')}
                                                    type="number"
                                                    value={String(zalgoDraft.percent)}
                                                    onChange={(value) => setZalgoDraft((prev) => prev ? ({
                                                        ...prev,
                                                        percent: Math.min(100, Math.max(1, parseInt(value, 10) || 0)),
                                                    }) : prev)}
                                                    placeholder="10"
                                                />
                                            </div>
                                            <div className="flex items-end">
                                                <div className="flex h-[54px] w-full items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm font-semibold text-white/55">
                                                    %
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="rounded-[28px] border border-white/10 bg-black/25 p-3.5 shadow-inner">
                                        <div className="mb-3.5 flex items-center justify-between gap-4">
                                            <div>
                                                <p className="text-sm font-semibold text-white/80">{tr('Действия', 'Actions')}</p>
                                                <p className="text-xs text-white/40">{tr('Каждая строка задаёт порог по количеству сообщений с зальго и соответствующее действие. Сообщение, вызвавшее фильтр, всё равно будет удалено даже при выборе другого действия.', 'Each row sets a threshold for the number of Zalgo messages and the corresponding action. The message that triggered the filter will still be deleted even if another action is selected.')}</p>
                                            </div>
                                            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-white/40">
                                                {zalgoDraft.actions.length}
                                            </span>
                                        </div>

                                        <div className="space-y-3.5">
                                            {zalgoDraft.actions.map((action, index) => (
                                                <div key={`${action.action}-${index}`} className="rounded-[22px] border border-white/10 bg-black/20 p-3.5">
                                                    <div className="grid grid-cols-1 gap-3.5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)_minmax(0,1fr)_56px]">
                                                        <div className="min-w-0">
                                                            <TextField
                                                                label={tr('Порог сообщений', 'Message threshold')}
                                                                type="number"
                                                                value={String(action.messageCount)}
                                                                onChange={(value) => updateZalgoDraftAction(index, {
                                                                    messageCount: Math.max(1, parseInt(value, 10) || 0),
                                                                })}
                                                                placeholder="1"
                                                            />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <InteractiveSelect
                                                                label={tr('\u0414\u0435\u0439\u0441\u0442\u0432\u0438\u0435', 'Action')}
                                                                value={action.action}
                                                                onChange={(value) => updateZalgoDraftAction(index, {
                                                                    action: value,
                                                                    durationText: actionUsesDuration(value) ? action.durationText : '',
                                                                })}
                                                                options={floodActionOptions}
                                                            />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <TextField
                                                                label={tr('Длительность', 'Duration')}
                                                                value={action.durationText}
                                                                onChange={(value) => updateZalgoDraftAction(index, { durationText: value })}
                                                                placeholder={tr('30m, 2h, 7d', '30m, 2h, 7d')}
                                                                inputClassName="h-[54px] py-0"
                                                                disabled={!actionUsesDuration(action.action)}
                                                            />
                                                        </div>
                                                        <div className="flex items-end">
                                                            <button
                                                                type="button"
                                                                onClick={() => removeZalgoDraftAction(index)}
                                                                className="flex h-[54px] w-full items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white/50 transition-all hover:border-rose-400/40 hover:bg-rose-500/15 hover:text-white"
                                                            >
                                                                <Trash size={18} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        <button
                                            type="button"
                                            onClick={addZalgoDraftAction}
                                            className="mt-3.5 flex w-full items-center justify-center gap-2 rounded-[20px] border border-dashed border-[var(--color-primary-1)]/50 bg-[var(--color-primary-1)]/8 py-3 text-sm font-bold tracking-wide text-[var(--color-primary-1)] transition-all hover:bg-[var(--color-primary-1)]/16"
                                        >
                                            <Plus size={18} weight="bold" />
                                            {tr('Добавить действие', 'Add Action')}
                                        </button>
                                    </div>
                                </div>
                            ) : null}
                        </div>

                        <div className="shrink-0 border-t border-[var(--border-divider)] bg-[var(--surface-hover)] px-6 py-4">
                            <div className="ml-auto flex w-full max-w-fit items-center justify-end gap-4">
                                <button
                                    type="button"
                                    onClick={closeZalgoModal}
                                    className="inline-flex h-12 min-w-[140px] items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-5 text-sm font-semibold text-white/70 transition-all hover:bg-white/10 hover:text-white"
                                >
                                    {tr('Отмена', 'Cancel')}
                                </button>
                                <button
                                    type="button"
                                    onClick={saveZalgoModal}
                                    disabled={!zalgoDraft}
                                    className="inline-flex h-12 min-w-[156px] items-center justify-center rounded-2xl bg-[var(--color-primary-1)] px-5 text-sm font-bold text-black transition-all hover:bg-[var(--color-primary-2)] disabled:pointer-events-none disabled:opacity-40"
                                >
                                    {tr('Сохранить', 'Save')}
                                </button>
                            </div>
                        </div>
                    </div>
                </ModalContent>
            </Modal>

            <Modal
                isOpen={isEmojiModalOpen}
                onClose={closeEmojiModal}
                size="5xl"
                scrollBehavior="inside"
                hideCloseButton
                classNames={{
                    base: "bg-[#111111] border border-[var(--border-subtle)] shadow-2xl rounded-[32px] overflow-hidden m-4",
                    backdrop: "bg-[#0e0e0e]/60 backdrop-blur-sm",
                }}
            >
                <ModalContent>
                    <div className="flex max-h-[85vh] flex-col">
                        <div className="flex shrink-0 items-center justify-between border-b border-[var(--border-divider)] bg-[var(--surface-hover)] p-6">
                            <div className="flex items-center gap-4">
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--color-primary-1)]/20 bg-[var(--color-primary-1)]/10 text-[var(--color-primary-1)]">
                                    <WarningOctagon size={20} weight="duotone" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold leading-tight text-white">
                                        {tr('Настройка каналов эмодзи', 'Emoji channels settings')}
                                    </h2>
                                    <p className="mt-0.5 text-[11px] font-medium text-[var(--text-muted)]">
                                        {tr('Настройте каналы только для эмодзи, каналы без эмодзи и ступени реакции.', 'Configure emoji-only channels, no-emoji channels, and response steps.')}
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={closeEmojiModal}
                                className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--surface-card)] text-[var(--text-muted)] transition-colors hover:bg-[var(--border-divider)]"
                                aria-label={tr('Закрыть', 'Close')}
                            >
                                <X size={14} weight="bold" />
                            </button>
                        </div>

                        <div className="custom-scrollbar flex-1 overflow-y-auto bg-[var(--surface-modal)] px-6 py-5">
                            {emojiDraft ? (
                                <div className="space-y-5">
                                    <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                                        <MultiSelectField
                                            label={tr('Каналы только для эмодзи', 'Emoji-only channels')}
                                            options={config.channels}
                                            selected={emojiDraft.emojiOnlyChannelIds}
                                            onChange={(keys) => setEmojiDraft((prev) => prev ? ({ ...prev, emojiOnlyChannelIds: keys }) : prev)}
                                            placeholder={tr('Выберите каналы или категории...', 'Select channels or categories...')}
                                        />
                                        <MultiSelectField
                                            label={tr('Каналы без эмодзи', 'No-emoji channels')}
                                            options={config.channels}
                                            selected={emojiDraft.denyEmojiChannelIds}
                                            onChange={(keys) => setEmojiDraft((prev) => prev ? ({ ...prev, denyEmojiChannelIds: keys }) : prev)}
                                            placeholder={tr('Выберите каналы или категории...', 'Select channels or categories...')}
                                        />
                                    </div>

                                    <div className="rounded-[28px] border border-white/10 bg-black/25 p-3.5 shadow-inner">
                                        <div className="mb-3.5 flex items-center justify-between gap-4">
                                            <div>
                                                <p className="text-sm font-semibold text-white/80">{tr('Действия', 'Actions')}</p>
                                                <p className="text-xs text-white/40">{tr('Каждая строка задаёт действие для нарушений в каналах эмодзи. Сообщение, вызвавшее фильтр, всё равно будет удалено даже при выборе другого действия.', 'Each row sets the action for emoji channel violations. The message that triggered the filter will still be deleted even if another action is selected.')}</p>
                                            </div>
                                            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-white/40">
                                                {emojiDraft.actions.length}
                                            </span>
                                        </div>

                                        <div className="space-y-3.5">
                                            {emojiDraft.actions.map((action, index) => (
                                                <div key={`${action.action}-${index}`} className="rounded-[22px] border border-white/10 bg-black/20 p-3.5">
                                                    <div className="grid grid-cols-1 gap-3.5 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_56px]">
                                                        <div className="min-w-0">
                                                            <InteractiveSelect
                                                                label={tr('\u0414\u0435\u0439\u0441\u0442\u0432\u0438\u0435', 'Action')}
                                                                value={action.action}
                                                                onChange={(value) => updateEmojiDraftAction(index, {
                                                                    action: value,
                                                                    durationText: actionUsesDuration(value) ? action.durationText : '',
                                                                })}
                                                                options={floodActionOptions}
                                                            />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <TextField
                                                                label={tr('Длительность', 'Duration')}
                                                                value={action.durationText}
                                                                onChange={(value) => updateEmojiDraftAction(index, { durationText: value })}
                                                                placeholder={tr('30m, 2h, 7d', '30m, 2h, 7d')}
                                                                inputClassName="h-[54px] py-0"
                                                                disabled={!actionUsesDuration(action.action)}
                                                            />
                                                        </div>
                                                        <div className="flex items-end">
                                                            <button
                                                                type="button"
                                                                onClick={() => removeEmojiDraftAction(index)}
                                                                className="flex h-[54px] w-full items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white/50 transition-all hover:border-rose-400/40 hover:bg-rose-500/15 hover:text-white"
                                                            >
                                                                <Trash size={18} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        <button
                                            type="button"
                                            onClick={addEmojiDraftAction}
                                            className="mt-3.5 flex w-full items-center justify-center gap-2 rounded-[20px] border border-dashed border-[var(--color-primary-1)]/50 bg-[var(--color-primary-1)]/8 py-3 text-sm font-bold tracking-wide text-[var(--color-primary-1)] transition-all hover:bg-[var(--color-primary-1)]/16"
                                        >
                                            <Plus size={18} weight="bold" />
                                            {tr('Добавить действие', 'Add Action')}
                                        </button>
                                    </div>
                                </div>
                            ) : null}
                        </div>

                        <div className="shrink-0 border-t border-[var(--border-divider)] bg-[var(--surface-hover)] px-6 py-4">
                            <div className="ml-auto flex w-full max-w-fit items-center justify-end gap-4">
                                <button
                                    type="button"
                                    onClick={closeEmojiModal}
                                    className="inline-flex h-12 min-w-[140px] items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-5 text-sm font-semibold text-white/70 transition-all hover:bg-white/10 hover:text-white"
                                >
                                    {tr('Отмена', 'Cancel')}
                                </button>
                                <button
                                    type="button"
                                    onClick={saveEmojiModal}
                                    disabled={!emojiDraft}
                                    className="inline-flex h-12 min-w-[156px] items-center justify-center rounded-2xl bg-[var(--color-primary-1)] px-5 text-sm font-bold text-black transition-all hover:bg-[var(--color-primary-2)] disabled:pointer-events-none disabled:opacity-40"
                                >
                                    {tr('Сохранить', 'Save')}
                                </button>
                            </div>
                        </div>
                    </div>
                </ModalContent>
            </Modal>

            <Modal
                isOpen={isImageFilterModalOpen}
                onClose={closeImageFilterModal}
                size="5xl"
                scrollBehavior="inside"
                hideCloseButton
                classNames={{
                    base: "bg-[#111111] border border-[var(--border-subtle)] shadow-2xl rounded-[32px] overflow-hidden m-4",
                    backdrop: "bg-[#0e0e0e]/60 backdrop-blur-sm",
                }}
            >
                <ModalContent>
                    <div className="flex max-h-[85vh] flex-col">
                        <div className="flex shrink-0 items-center justify-between border-b border-[var(--border-divider)] bg-[var(--surface-hover)] p-6">
                            <div className="flex items-center gap-4">
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--color-primary-1)]/20 bg-[var(--color-primary-1)]/10 text-[var(--color-primary-1)]">
                                    <WarningOctagon size={20} weight="duotone" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold leading-tight text-white">
                                        {tr('Настройка фильтрации изображений', 'Image filtering settings')}
                                    </h2>
                                    <p className="mt-0.5 text-[11px] font-medium text-[var(--text-muted)]">
                                        {tr('Выберите каналы, где изображения полностью запрещены, и каналы, где разрешены только они.', 'Choose channels where images are fully forbidden and channels where only images are allowed.')}
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={closeImageFilterModal}
                                className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--surface-card)] text-[var(--text-muted)] transition-colors hover:bg-[var(--border-divider)]"
                                aria-label={tr('Закрыть', 'Close')}
                            >
                                <X size={14} weight="bold" />
                            </button>
                        </div>

                        <div className="custom-scrollbar flex-1 overflow-y-auto bg-[var(--surface-modal)] px-6 py-5">
                            {imageFilterDraft ? (
                                <div className="space-y-5">
                                    <MultiSelectField
                                        label={tr('Игнорируемые каналы', 'Ignored Channels')}
                                        options={config.channels}
                                        selected={imageFilterDraft.ignoredChannels}
                                        onChange={(keys) => setImageFilterDraft((prev) => prev ? ({ ...prev, ignoredChannels: keys }) : prev)}
                                        placeholder={tr('Выберите каналы или категории...', 'Select channels or categories...')}
                                    />

                                    <MultiSelectField
                                        label={tr('Каналы только для изображения', 'Channels only for images')}
                                        options={config.channels}
                                        selected={imageFilterDraft.imageOnlyChannelIds}
                                        onChange={(keys) => setImageFilterDraft((prev) => prev ? ({ ...prev, imageOnlyChannelIds: keys }) : prev)}
                                        placeholder={tr('Выберите каналы, где разрешены только изображения...', 'Select channels where only images are allowed...')}
                                    />

                                    <MultiSelectField
                                        label={tr('Каналы без изображений', 'Channels without images')}
                                        options={config.channels}
                                        selected={imageFilterDraft.denyImageChannelIds}
                                        onChange={(keys) => setImageFilterDraft((prev) => prev ? ({ ...prev, denyImageChannelIds: keys }) : prev)}
                                        placeholder={tr('Выберите каналы, где изображения запрещены...', 'Select channels where images are forbidden...')}
                                    />

                                    <div className="rounded-[28px] border border-white/10 bg-black/25 p-3.5 shadow-inner">
                                        <div className="mb-3.5 flex items-center justify-between gap-4">
                                            <div>
                                                <p className="text-sm font-semibold text-white/80">{tr('Действия', 'Actions')}</p>
                                                <p className="text-xs text-white/40">{tr('Для фильтрации изображений настраивается только действие и его длительность. Сообщение, вызвавшее фильтр, всё равно будет удалено даже при выборе другого действия.', 'For image filter, only the action and its duration are configured. The message that triggered the filter will still be deleted even if another action is selected.')}</p>
                                            </div>
                                            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-white/40">
                                                {imageFilterDraft.actions.length}
                                            </span>
                                        </div>

                                        <div className="space-y-3.5">
                                            {imageFilterDraft.actions.map((action, index) => (
                                                <div key={`${action.action}-${index}`} className="rounded-[22px] border border-white/10 bg-black/20 p-3.5">
                                                    <div className="grid grid-cols-1 gap-3.5 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_56px]">
                                                        <div className="min-w-0">
                                                            <InteractiveSelect
                                                                label={tr('\u0414\u0435\u0439\u0441\u0442\u0432\u0438\u0435', 'Action')}
                                                                value={action.action}
                                                                onChange={(value) => updateImageFilterDraftAction(index, {
                                                                    action: value,
                                                                    durationText: actionUsesDuration(value) ? action.durationText : '',
                                                                })}
                                                                options={floodActionOptions}
                                                            />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <TextField
                                                                label={tr('Длительность', 'Duration')}
                                                                value={action.durationText}
                                                                onChange={(value) => updateImageFilterDraftAction(index, { durationText: value })}
                                                                placeholder={tr('30m, 2h, 7d', '30m, 2h, 7d')}
                                                                inputClassName="h-[54px] py-0"
                                                                disabled={!actionUsesDuration(action.action)}
                                                            />
                                                        </div>
                                                        <div className="flex items-end">
                                                            <button
                                                                type="button"
                                                                onClick={() => removeImageFilterDraftAction(index)}
                                                                className="flex h-[54px] w-full items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white/50 transition-all hover:border-rose-400/40 hover:bg-rose-500/15 hover:text-white"
                                                            >
                                                                <Trash size={18} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        <button
                                            type="button"
                                            onClick={addImageFilterDraftAction}
                                            className="mt-3.5 flex w-full items-center justify-center gap-2 rounded-[20px] border border-dashed border-[var(--color-primary-1)]/50 bg-[var(--color-primary-1)]/8 py-3 text-sm font-bold tracking-wide text-[var(--color-primary-1)] transition-all hover:bg-[var(--color-primary-1)]/16"
                                        >
                                            <Plus size={18} weight="bold" />
                                            {tr('Добавить действие', 'Add Action')}
                                        </button>
                                    </div>
                                </div>
                            ) : null}
                        </div>

                        <div className="shrink-0 border-t border-[var(--border-divider)] bg-[var(--surface-hover)] px-6 py-4">
                            <div className="ml-auto flex w-full max-w-fit items-center justify-end gap-4">
                                <button
                                    type="button"
                                    onClick={closeImageFilterModal}
                                    className="inline-flex h-12 min-w-[140px] items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-5 text-sm font-semibold text-white/70 transition-all hover:bg-white/10 hover:text-white"
                                >
                                    {tr('Отмена', 'Cancel')}
                                </button>
                                <button
                                    type="button"
                                    onClick={saveImageFilterModal}
                                    disabled={!imageFilterDraft}
                                    className="inline-flex h-12 min-w-[156px] items-center justify-center rounded-2xl bg-[var(--color-primary-1)] px-5 text-sm font-bold text-black transition-all hover:bg-[var(--color-primary-2)] disabled:pointer-events-none disabled:opacity-40"
                                >
                                    {tr('Сохранить', 'Save')}
                                </button>
                            </div>
                        </div>
                    </div>
                </ModalContent>
            </Modal>

            <Modal
                isOpen={isCommandChannelsModalOpen}
                onClose={closeCommandChannelsModal}
                size="5xl"
                scrollBehavior="inside"
                hideCloseButton
                classNames={{
                    base: "bg-[#111111] border border-[var(--border-subtle)] shadow-2xl rounded-[32px] overflow-hidden m-4",
                    backdrop: "bg-[#0e0e0e]/60 backdrop-blur-sm",
                }}
            >
                <ModalContent>
                    <div className="flex max-h-[85vh] flex-col">
                        <div className="flex shrink-0 items-center justify-between border-b border-[var(--border-divider)] bg-[var(--surface-hover)] p-6">
                            <div className="flex items-center gap-4">
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--color-primary-1)]/20 bg-[var(--color-primary-1)]/10 text-[var(--color-primary-1)]">
                                    <WarningOctagon size={20} weight="duotone" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold leading-tight text-white">
                                        {tr('Настройка каналов для команд', 'Command channels settings')}
                                    </h2>
                                    <p className="mt-0.5 text-[11px] font-medium text-[var(--text-muted)]">
                                        {tr('Выберите список каналов и режим: где команды разрешены как единственный тип сообщений или где команды запрещены.', 'Choose a channel list and mode: where commands are the only allowed messages or where commands are forbidden.')}
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={closeCommandChannelsModal}
                                className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--surface-card)] text-[var(--text-muted)] transition-colors hover:bg-[var(--border-divider)]"
                                aria-label={tr('Закрыть', 'Close')}
                            >
                                <X size={14} weight="bold" />
                            </button>
                        </div>

                        <div className="custom-scrollbar flex-1 overflow-y-auto bg-[var(--surface-modal)] px-6 py-5">
                            {commandChannelsDraft ? (
                                <div className="space-y-5">
                                    <div className="rounded-[28px] border border-white/10 bg-black/25 p-3.5 shadow-inner">
                                        <div className="flex items-center justify-between gap-4">
                                            <div>
                                                <p className="text-sm font-semibold text-white/80">{tr('Режим каналов', 'Channel mode')}</p>
                                                <p className="text-xs text-white/40">{tr('Разрешённые: в выбранных каналах разрешены только команды. Запрещённые: в выбранных каналах команды запрещены.', 'Allowed: only commands are allowed in selected channels. Blocked: commands are forbidden in selected channels.')}</p>
                                            </div>
                                            <div className="flex gap-1 rounded-lg border border-[var(--border-divider)] bg-[var(--surface-hover)] p-1">
                                                <button
                                                    type="button"
                                                    className={`px-3 py-1 text-xs rounded-md font-bold transition-colors ${commandChannelsDraft.mode === 'allowlist' ? 'bg-[var(--surface-card)] text-[var(--color-primary-1)] shadow-sm' : 'text-[var(--text-muted)]'}`}
                                                    onClick={() => setCommandChannelsDraft((prev) => prev ? ({ ...prev, mode: 'allowlist' }) : prev)}
                                                >
                                                    {tr('Разрешённые', 'Allowed')}
                                                </button>
                                                <button
                                                    type="button"
                                                    className={`px-3 py-1 text-xs rounded-md font-bold transition-colors ${commandChannelsDraft.mode === 'blocklist' ? 'bg-[var(--surface-card)] text-[var(--color-destructive)] shadow-sm' : 'text-[var(--text-muted)]'}`}
                                                    onClick={() => setCommandChannelsDraft((prev) => prev ? ({ ...prev, mode: 'blocklist' }) : prev)}
                                                >
                                                    {tr('Запрещённые', 'Blocked')}
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    <MultiSelectField
                                        label={tr('Каналы и категории', 'Channels and categories')}
                                        options={config.channels}
                                        selected={commandChannelsDraft.channelIds}
                                        onChange={(keys) => setCommandChannelsDraft((prev) => prev ? ({ ...prev, channelIds: keys }) : prev)}
                                        placeholder={tr('Выберите каналы или категории...', 'Select channels or categories...')}
                                    />

                                    <div className="rounded-[28px] border border-white/10 bg-black/25 p-3.5 shadow-inner">
                                        <div className="mb-3.5 flex items-center justify-between gap-4">
                                            <div>
                                                <p className="text-sm font-semibold text-white/80">{tr('Действия', 'Actions')}</p>
                                                <p className="text-xs text-white/40">{tr('Для каналов для команд настраивается только действие и его длительность. Сообщение, вызвавшее фильтр, всё равно будет удалено даже при выборе другого действия.', 'For command channels, only the action and its duration are configured. The message that triggered the filter will still be deleted even if another action is selected.')}</p>
                                            </div>
                                            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-white/40">
                                                {commandChannelsDraft.actions.length}
                                            </span>
                                        </div>

                                        <div className="space-y-3.5">
                                            {commandChannelsDraft.actions.map((action, index) => (
                                                <div key={`${action.action}-${index}`} className="rounded-[22px] border border-white/10 bg-black/20 p-3.5">
                                                    <div className="grid grid-cols-1 gap-3.5 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_56px]">
                                                        <div className="min-w-0">
                                                            <InteractiveSelect
                                                                label={tr('\u0414\u0435\u0439\u0441\u0442\u0432\u0438\u0435', 'Action')}
                                                                value={action.action}
                                                                onChange={(value) => updateCommandChannelsDraftAction(index, {
                                                                    action: value,
                                                                    durationText: actionUsesDuration(value) ? action.durationText : '',
                                                                })}
                                                                options={floodActionOptions}
                                                            />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <TextField
                                                                label={tr('Длительность', 'Duration')}
                                                                value={action.durationText}
                                                                onChange={(value) => updateCommandChannelsDraftAction(index, { durationText: value })}
                                                                placeholder={tr('30m, 2h, 7d', '30m, 2h, 7d')}
                                                                inputClassName="h-[54px] py-0"
                                                                disabled={!actionUsesDuration(action.action)}
                                                            />
                                                        </div>
                                                        <div className="flex items-end">
                                                            <button
                                                                type="button"
                                                                onClick={() => removeCommandChannelsDraftAction(index)}
                                                                className="flex h-[54px] w-full items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white/50 transition-all hover:border-rose-400/40 hover:bg-rose-500/15 hover:text-white"
                                                            >
                                                                <Trash size={18} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        <button
                                            type="button"
                                            onClick={addCommandChannelsDraftAction}
                                            className="mt-3.5 flex w-full items-center justify-center gap-2 rounded-[20px] border border-dashed border-[var(--color-primary-1)]/50 bg-[var(--color-primary-1)]/8 py-3 text-sm font-bold tracking-wide text-[var(--color-primary-1)] transition-all hover:bg-[var(--color-primary-1)]/16"
                                        >
                                            <Plus size={18} weight="bold" />
                                            {tr('Добавить действие', 'Add Action')}
                                        </button>
                                    </div>
                                </div>
                            ) : null}
                        </div>

                        <div className="shrink-0 border-t border-[var(--border-divider)] bg-[var(--surface-hover)] px-6 py-4">
                            <div className="ml-auto flex w-full max-w-fit items-center justify-end gap-4">
                                <button
                                    type="button"
                                    onClick={closeCommandChannelsModal}
                                    className="inline-flex h-12 min-w-[140px] items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-5 text-sm font-semibold text-white/70 transition-all hover:bg-white/10 hover:text-white"
                                >
                                    {tr('Отмена', 'Cancel')}
                                </button>
                                <button
                                    type="button"
                                    onClick={saveCommandChannelsModal}
                                    disabled={!commandChannelsDraft}
                                    className="inline-flex h-12 min-w-[156px] items-center justify-center rounded-2xl bg-[var(--color-primary-1)] px-5 text-sm font-bold text-black transition-all hover:bg-[var(--color-primary-2)] disabled:pointer-events-none disabled:opacity-40"
                                >
                                    {tr('Сохранить', 'Save')}
                                </button>
                            </div>
                        </div>
                    </div>
                </ModalContent>
            </Modal>

            <Modal
                isOpen={isEmojiSpamModalOpen}
                onClose={closeEmojiSpamModal}
                size="5xl"
                scrollBehavior="inside"
                hideCloseButton
                classNames={{
                    base: "bg-[#111111] border border-[var(--border-subtle)] shadow-2xl rounded-[32px] overflow-hidden m-4",
                    backdrop: "bg-[#0e0e0e]/60 backdrop-blur-sm",
                }}
            >
                <ModalContent>
                    <div className="flex max-h-[85vh] flex-col">
                        <div className="flex shrink-0 items-center justify-between border-b border-[var(--border-divider)] bg-[var(--surface-hover)] p-6">
                            <div className="flex items-center gap-4">
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--color-primary-1)]/20 bg-[var(--color-primary-1)]/10 text-[var(--color-primary-1)]">
                                    <WarningOctagon size={20} weight="duotone" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold leading-tight text-white">
                                        {tr('Настройка спама эмодзи', 'Emoji spam settings')}
                                    </h2>
                                    <p className="mt-0.5 text-[11px] font-medium text-[var(--text-muted)]">
                                        {tr('Настройте лимит эмодзи в сообщении и ступени реакции по количеству таких сообщений.', 'Set the emoji limit per message and the response steps by the number of such messages.')}
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={closeEmojiSpamModal}
                                className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--surface-card)] text-[var(--text-muted)] transition-colors hover:bg-[var(--border-divider)]"
                                aria-label={tr('Закрыть', 'Close')}
                            >
                                <X size={14} weight="bold" />
                            </button>
                        </div>

                        <div className="custom-scrollbar flex-1 overflow-y-auto bg-[var(--surface-modal)] px-6 py-5">
                            {emojiSpamDraft ? (
                                <div className="space-y-5">
                                    <MultiSelectField
                                        label={tr('Игнорируемые каналы', 'Ignored Channels')}
                                        options={config.channels}
                                        selected={emojiSpamDraft.ignoredChannels}
                                        onChange={(keys) => setEmojiSpamDraft((prev) => prev ? ({ ...prev, ignoredChannels: keys }) : prev)}
                                        placeholder={tr('Выберите каналы или категории...', 'Select channels or categories...')}
                                    />

                                    <div className="rounded-[28px] border border-white/10 bg-black/25 p-3.5 shadow-inner">
                                        <TextField
                                            label={tr('Количество эмодзи в сообщении', 'Emoji count in message')}
                                            type="number"
                                            value={String(emojiSpamDraft.count)}
                                            onChange={(value) => setEmojiSpamDraft((prev) => prev ? ({
                                                ...prev,
                                                count: Math.max(1, parseInt(value, 10) || 0),
                                            }) : prev)}
                                            placeholder="8"
                                        />
                                    </div>

                                    <div className="rounded-[28px] border border-white/10 bg-black/25 p-3.5 shadow-inner">
                                        <div className="mb-3.5 flex items-center justify-between gap-4">
                                            <div>
                                                <p className="text-sm font-semibold text-white/80">{tr('Действия', 'Actions')}</p>
                                                <p className="text-xs text-white/40">{tr('Каждая строка задаёт порог по количеству сообщений со спамом эмодзи и соответствующее действие. Сообщение, вызвавшее фильтр, всё равно будет удалено даже при выборе другого действия.', 'Each row sets a threshold for the number of emoji spam messages and the corresponding action. The message that triggered the filter will still be deleted even if another action is selected.')}</p>
                                            </div>
                                            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-white/40">
                                                {emojiSpamDraft.actions.length}
                                            </span>
                                        </div>

                                        <div className="space-y-3.5">
                                            {emojiSpamDraft.actions.map((action, index) => (
                                                <div key={`${action.action}-${index}`} className="rounded-[22px] border border-white/10 bg-black/20 p-3.5">
                                                    <div className="grid grid-cols-1 gap-3.5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)_minmax(0,1fr)_56px]">
                                                        <div className="min-w-0">
                                                            <TextField
                                                                label={tr('Порог сообщений', 'Message threshold')}
                                                                type="number"
                                                                value={String(action.messageCount)}
                                                                onChange={(value) => updateEmojiSpamDraftAction(index, {
                                                                    messageCount: Math.max(1, parseInt(value, 10) || 0),
                                                                })}
                                                                placeholder="1"
                                                            />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <InteractiveSelect
                                                                label={tr('\u0414\u0435\u0439\u0441\u0442\u0432\u0438\u0435', 'Action')}
                                                                value={action.action}
                                                                onChange={(value) => updateEmojiSpamDraftAction(index, {
                                                                    action: value,
                                                                    durationText: actionUsesDuration(value) ? action.durationText : '',
                                                                })}
                                                                options={floodActionOptions}
                                                            />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <TextField
                                                                label={tr('Длительность', 'Duration')}
                                                                value={action.durationText}
                                                                onChange={(value) => updateEmojiSpamDraftAction(index, { durationText: value })}
                                                                placeholder={tr('30m, 2h, 7d', '30m, 2h, 7d')}
                                                                inputClassName="h-[54px] py-0"
                                                                disabled={!actionUsesDuration(action.action)}
                                                            />
                                                        </div>
                                                        <div className="flex items-end">
                                                            <button
                                                                type="button"
                                                                onClick={() => removeEmojiSpamDraftAction(index)}
                                                                className="flex h-[54px] w-full items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white/50 transition-all hover:border-rose-400/40 hover:bg-rose-500/15 hover:text-white"
                                                            >
                                                                <Trash size={18} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        <button
                                            type="button"
                                            onClick={addEmojiSpamDraftAction}
                                            className="mt-3.5 flex w-full items-center justify-center gap-2 rounded-[20px] border border-dashed border-[var(--color-primary-1)]/50 bg-[var(--color-primary-1)]/8 py-3 text-sm font-bold tracking-wide text-[var(--color-primary-1)] transition-all hover:bg-[var(--color-primary-1)]/16"
                                        >
                                            <Plus size={18} weight="bold" />
                                            {tr('Добавить действие', 'Add Action')}
                                        </button>
                                    </div>
                                </div>
                            ) : null}
                        </div>

                        <div className="shrink-0 border-t border-[var(--border-divider)] bg-[var(--surface-hover)] px-6 py-4">
                            <div className="ml-auto flex w-full max-w-fit items-center justify-end gap-4">
                                <button
                                    type="button"
                                    onClick={closeEmojiSpamModal}
                                    className="inline-flex h-12 min-w-[140px] items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-5 text-sm font-semibold text-white/70 transition-all hover:bg-white/10 hover:text-white"
                                >
                                    {tr('Отмена', 'Cancel')}
                                </button>
                                <button
                                    type="button"
                                    onClick={saveEmojiSpamModal}
                                    disabled={!emojiSpamDraft}
                                    className="inline-flex h-12 min-w-[156px] items-center justify-center rounded-2xl bg-[var(--color-primary-1)] px-5 text-sm font-bold text-black transition-all hover:bg-[var(--color-primary-2)] disabled:pointer-events-none disabled:opacity-40"
                                >
                                    {tr('Сохранить', 'Save')}
                                </button>
                            </div>
                        </div>
                    </div>
                </ModalContent>
            </Modal>

            <Modal
                isOpen={isSpamModalOpen}
                onClose={closeSpamModal}
                size="5xl"
                scrollBehavior="inside"
                hideCloseButton
                classNames={{
                    base: "bg-[#111111] border border-[var(--border-subtle)] shadow-2xl rounded-[32px] overflow-hidden m-4",
                    backdrop: "bg-[#0e0e0e]/60 backdrop-blur-sm",
                }}
            >
                <ModalContent>
                    <div className="flex max-h-[85vh] flex-col">
                        <div className="flex shrink-0 items-center justify-between border-b border-[var(--border-divider)] bg-[var(--surface-hover)] p-6">
                            <div className="flex items-center gap-4">
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--color-primary-1)]/20 bg-[var(--color-primary-1)]/10 text-[var(--color-primary-1)]">
                                    <WarningOctagon size={20} weight="duotone" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold leading-tight text-white">
                                        {tr('Настройка спама', 'Spam settings')}
                                    </h2>
                                    <p className="mt-0.5 text-[11px] font-medium text-[var(--text-muted)]">
                                        {tr('Настройте область отслеживания, игнорируемые каналы, окно повторения и ступени реакции.', 'Configure tracking scope, ignored channels, repetition window, and response steps.')}
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={closeSpamModal}
                                className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--surface-card)] text-[var(--text-muted)] transition-colors hover:bg-[var(--border-divider)]"
                                aria-label={tr('Закрыть', 'Close')}
                            >
                                <X size={14} weight="bold" />
                            </button>
                        </div>

                        <div className="custom-scrollbar flex-1 overflow-y-auto bg-[var(--surface-modal)] px-6 py-5">
                            {spamDraft ? (
                                <div className="space-y-5">
                                    <div className="rounded-[28px] border border-white/10 bg-black/25 p-3.5 shadow-inner">
                                        <div className="flex items-center justify-between gap-4">
                                            <div>
                                                <p className="text-sm font-semibold text-white/80">{tr('Область отслеживания', 'Tracking scope')}</p>
                                                <p className="text-xs text-white/40">{tr('Выберите, считать повторы только в текущем канале или по всему серверу.', 'Choose whether repeats are counted only in the current channel or across the whole server.')}</p>
                                            </div>
                                            <div className="flex gap-1 rounded-lg border border-[var(--border-divider)] bg-[var(--surface-hover)] p-1">
                                                <button
                                                    type="button"
                                                    className={`px-3 py-1 text-xs rounded-md font-bold transition-colors ${spamDraft.scope === 'channel' ? 'bg-[var(--surface-card)] text-[var(--color-primary-1)] shadow-sm' : 'text-[var(--text-muted)]'}`}
                                                    onClick={() => setSpamDraft((prev) => prev ? ({ ...prev, scope: 'channel' }) : prev)}
                                                >
                                                    {tr('В чате', 'In Chat')}
                                                </button>
                                                <button
                                                    type="button"
                                                    className={`px-3 py-1 text-xs rounded-md font-bold transition-colors ${spamDraft.scope === 'server' ? 'bg-[var(--surface-card)] text-[var(--color-destructive)] shadow-sm' : 'text-[var(--text-muted)]'}`}
                                                    onClick={() => setSpamDraft((prev) => prev ? ({ ...prev, scope: 'server' }) : prev)}
                                                >
                                                    {tr('Везде', 'Everywhere')}
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    <MultiSelectField
                                        label={tr('Игнорируемые каналы', 'Ignored Channels')}
                                        options={config.channels}
                                        selected={spamDraft.ignoredChannels}
                                        onChange={(keys) => setSpamDraft((prev) => prev ? ({ ...prev, ignoredChannels: keys }) : prev)}
                                        placeholder={tr('Выберите каналы или категории...', 'Select channels or categories...')}
                                    />

                                    <div className="rounded-[28px] border border-white/10 bg-black/25 p-3.5 shadow-inner">
                                        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-[minmax(0,1fr)_240px]">
                                            <div className="min-w-0">
                                                <TextField
                                                    label={tr('Окно повторения', 'Repetition window')}
                                                    type="number"
                                                    value={String(spamDraft.windowValue)}
                                                    onChange={(value) => setSpamDraft((prev) => prev ? ({
                                                        ...prev,
                                                        windowValue: Math.max(1, parseInt(value, 10) || 0),
                                                    }) : prev)}
                                                    placeholder="1"
                                                />
                                            </div>
                                            <div className="min-w-0">
                                                <InteractiveSelect
                                                    label={tr('Единица времени', 'Time unit')}
                                                    value={spamDraft.windowUnit}
                                                    onChange={(value) => setSpamDraft((prev) => prev ? ({
                                                        ...prev,
                                                        windowUnit: value as AutomodSpamConfig['windowUnit'],
                                                    }) : prev)}
                                                    options={floodWindowOptions}
                                                    placeholder={tr('Единица', 'Unit')}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="rounded-[28px] border border-white/10 bg-black/25 p-3.5 shadow-inner">
                                        <div className="mb-3.5 flex items-center justify-between gap-4">
                                            <div>
                                                <p className="text-sm font-semibold text-white/80">{tr('Действия', 'Actions')}</p>
                                                <p className="text-xs text-white/40">{tr('Каждая строка задаёт порог по количеству одинаковых сообщений и соответствующее действие. Сообщение, вызвавшее фильтр, всё равно будет удалено даже при выборе другого действия.', 'Each row sets a threshold for the number of identical messages and the corresponding action. The message that triggered the filter will still be deleted even if another action is selected.')}</p>
                                            </div>
                                            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-white/40">
                                                {spamDraft.actions.length}
                                            </span>
                                        </div>

                                        <div className="space-y-3.5">
                                            {spamDraft.actions.map((action, index) => (
                                                <div key={`${action.action}-${index}`} className="rounded-[22px] border border-white/10 bg-black/20 p-3.5">
                                                    <div className="grid grid-cols-1 gap-3.5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)_minmax(0,1fr)_56px]">
                                                        <div className="min-w-0">
                                                            <TextField
                                                                label={tr('Порог сообщений', 'Message threshold')}
                                                                type="number"
                                                                value={String(action.messageCount)}
                                                                onChange={(value) => updateSpamDraftAction(index, {
                                                                    messageCount: Math.max(1, parseInt(value, 10) || 0),
                                                                })}
                                                                placeholder="3"
                                                            />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <InteractiveSelect
                                                                label={tr('\u0414\u0435\u0439\u0441\u0442\u0432\u0438\u0435', 'Action')}
                                                                value={action.action}
                                                                onChange={(value) => updateSpamDraftAction(index, {
                                                                    action: value,
                                                                    durationText: actionUsesDuration(value) ? action.durationText : '',
                                                                })}
                                                                options={floodActionOptions}
                                                            />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <TextField
                                                                label={tr('Длительность', 'Duration')}
                                                                value={action.durationText}
                                                                onChange={(value) => updateSpamDraftAction(index, { durationText: value })}
                                                                placeholder={tr('30m, 2h, 7d', '30m, 2h, 7d')}
                                                                inputClassName="h-[54px] py-0"
                                                                disabled={!actionUsesDuration(action.action)}
                                                            />
                                                        </div>
                                                        <div className="flex items-end">
                                                            <button
                                                                type="button"
                                                                onClick={() => removeSpamDraftAction(index)}
                                                                className="flex h-[54px] w-full items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white/50 transition-all hover:border-rose-400/40 hover:bg-rose-500/15 hover:text-white"
                                                            >
                                                                <Trash size={18} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        <button
                                            type="button"
                                            onClick={addSpamDraftAction}
                                            className="mt-3.5 flex w-full items-center justify-center gap-2 rounded-[20px] border border-dashed border-[var(--color-primary-1)]/50 bg-[var(--color-primary-1)]/8 py-3 text-sm font-bold tracking-wide text-[var(--color-primary-1)] transition-all hover:bg-[var(--color-primary-1)]/16"
                                        >
                                            <Plus size={18} weight="bold" />
                                            {tr('Добавить действие', 'Add Action')}
                                        </button>
                                    </div>
                                </div>
                            ) : null}
                        </div>

                        <div className="shrink-0 border-t border-[var(--border-divider)] bg-[var(--surface-hover)] px-6 py-4">
                            <div className="ml-auto flex w-full max-w-fit items-center justify-end gap-4">
                                <button
                                    type="button"
                                    onClick={closeSpamModal}
                                    className="inline-flex h-12 min-w-[140px] items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-5 text-sm font-semibold text-white/70 transition-all hover:bg-white/10 hover:text-white"
                                >
                                    {tr('Отмена', 'Cancel')}
                                </button>
                                <button
                                    type="button"
                                    onClick={saveSpamModal}
                                    disabled={!spamDraft}
                                    className="inline-flex h-12 min-w-[156px] items-center justify-center rounded-2xl bg-[var(--color-primary-1)] px-5 text-sm font-bold text-black transition-all hover:bg-[var(--color-primary-2)] disabled:pointer-events-none disabled:opacity-40"
                                >
                                    {tr('Сохранить', 'Save')}
                                </button>
                            </div>
                        </div>
                    </div>
                </ModalContent>
            </Modal>

            <Modal
                isOpen={isMentionSpamModalOpen}
                onClose={closeMentionSpamModal}
                size="5xl"
                scrollBehavior="inside"
                hideCloseButton
                classNames={{
                    base: "bg-[#111111] border border-[var(--border-subtle)] shadow-2xl rounded-[32px] overflow-hidden m-4",
                    backdrop: "bg-[#0e0e0e]/60 backdrop-blur-sm",
                }}
            >
                <ModalContent>
                    <div className="flex max-h-[85vh] flex-col">
                        <div className="flex shrink-0 items-center justify-between border-b border-[var(--border-divider)] bg-[var(--surface-hover)] p-6">
                            <div className="flex items-center gap-4">
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--color-primary-1)]/20 bg-[var(--color-primary-1)]/10 text-[var(--color-primary-1)]">
                                    <WarningOctagon size={20} weight="duotone" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold leading-tight text-white">
                                        {tr('Настройка спама упоминаний', 'Mention spam settings')}
                                    </h2>
                                    <p className="mt-0.5 text-[11px] font-medium text-[var(--text-muted)]">
                                        {tr('Настройте типы упоминаний, игнорируемые каналы, окно повторения и ступени реакции.', 'Configure mention types, ignored channels, repetition window, and response steps.')}
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={closeMentionSpamModal}
                                className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--surface-card)] text-[var(--text-muted)] transition-colors hover:bg-[var(--border-divider)]"
                                aria-label={tr('Закрыть', 'Close')}
                            >
                                <X size={14} weight="bold" />
                            </button>
                        </div>

                        <div className="custom-scrollbar flex-1 overflow-y-auto bg-[var(--surface-modal)] px-6 py-5">
                            {mentionSpamDraft ? (
                                <div className="space-y-5">
                                    <div className="rounded-[28px] border border-white/10 bg-black/25 p-3.5 shadow-inner">
                                        <div className="flex items-center justify-between gap-4">
                                            <div>
                                                <p className="text-sm font-semibold text-white/80">{tr('Упоминания пользователей', 'User mentions')}</p>
                                                <p className="text-xs text-white/40">{tr('Отслеживать упоминания обычных пользователей.', 'Track mentions of regular users.')}</p>
                                            </div>
                                            <SmoothToggle
                                                label=""
                                                checked={mentionSpamDraft.userMentions}
                                                onChange={(checked) => setMentionSpamDraft((prev) => prev ? ({ ...prev, userMentions: checked }) : prev)}
                                            />
                                        </div>
                                    </div>

                                    <div className="rounded-[28px] border border-white/10 bg-black/25 p-3.5 shadow-inner">
                                        <div className="flex items-center justify-between gap-4">
                                            <div>
                                                <p className="text-sm font-semibold text-white/80">{tr('Упоминания ролей', 'Role mentions')}</p>
                                                <p className="text-xs text-white/40">{tr('Отслеживать упоминания ролей.', 'Track role mentions.')}</p>
                                            </div>
                                            <SmoothToggle
                                                label=""
                                                checked={mentionSpamDraft.roleMentions}
                                                onChange={(checked) => setMentionSpamDraft((prev) => prev ? ({ ...prev, roleMentions: checked }) : prev)}
                                            />
                                        </div>
                                    </div>

                                    <MultiSelectField
                                        label={tr('Игнорируемые каналы', 'Ignored Channels')}
                                        options={config.channels}
                                        selected={mentionSpamDraft.ignoredChannels}
                                        onChange={(keys) => setMentionSpamDraft((prev) => prev ? ({ ...prev, ignoredChannels: keys }) : prev)}
                                        placeholder={tr('Выберите каналы или категории...', 'Select channels or categories...')}
                                    />

                                    <div className="rounded-[28px] border border-white/10 bg-black/25 p-3.5 shadow-inner">
                                        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-[minmax(0,1fr)_240px]">
                                            <div className="min-w-0">
                                                <TextField
                                                    label={tr('Окно повторения', 'Repetition window')}
                                                    type="number"
                                                    value={String(mentionSpamDraft.windowValue)}
                                                    onChange={(value) => setMentionSpamDraft((prev) => prev ? ({
                                                        ...prev,
                                                        windowValue: Math.max(1, parseInt(value, 10) || 0),
                                                    }) : prev)}
                                                    placeholder="1"
                                                />
                                            </div>
                                            <div className="min-w-0">
                                                <InteractiveSelect
                                                    label={tr('Единица времени', 'Time unit')}
                                                    value={mentionSpamDraft.windowUnit}
                                                    onChange={(value) => setMentionSpamDraft((prev) => prev ? ({
                                                        ...prev,
                                                        windowUnit: value as AutomodMentionSpamConfig['windowUnit'],
                                                    }) : prev)}
                                                    options={floodWindowOptions}
                                                    placeholder={tr('Единица', 'Unit')}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="rounded-[28px] border border-white/10 bg-black/25 p-3.5 shadow-inner">
                                        <div className="mb-3.5 flex items-center justify-between gap-4">
                                            <div>
                                                <p className="text-sm font-semibold text-white/80">{tr('Действия', 'Actions')}</p>
                                                <p className="text-xs text-white/40">{tr('Каждая строка задаёт порог по количеству сообщений с упоминаниями и соответствующее действие. Сообщение, вызвавшее фильтр, всё равно будет удалено даже при выборе другого действия.', 'Each row sets a threshold for the number of mention messages and the corresponding action. The message that triggered the filter will still be deleted even if another action is selected.')}</p>
                                            </div>
                                            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-white/40">
                                                {mentionSpamDraft.actions.length}
                                            </span>
                                        </div>

                                        <div className="space-y-3.5">
                                            {mentionSpamDraft.actions.map((action, index) => (
                                                <div key={`${action.action}-${index}`} className="rounded-[22px] border border-white/10 bg-black/20 p-3.5">
                                                    <div className="grid grid-cols-1 gap-3.5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)_minmax(0,1fr)_56px]">
                                                        <div className="min-w-0">
                                                            <TextField
                                                                label={tr('Порог сообщений', 'Message threshold')}
                                                                type="number"
                                                                value={String(action.messageCount)}
                                                                onChange={(value) => updateMentionSpamDraftAction(index, {
                                                                    messageCount: Math.max(1, parseInt(value, 10) || 0),
                                                                })}
                                                                placeholder="1"
                                                            />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <InteractiveSelect
                                                                label={tr('\u0414\u0435\u0439\u0441\u0442\u0432\u0438\u0435', 'Action')}
                                                                value={action.action}
                                                                onChange={(value) => updateMentionSpamDraftAction(index, {
                                                                    action: value,
                                                                    durationText: actionUsesDuration(value) ? action.durationText : '',
                                                                })}
                                                                options={floodActionOptions}
                                                            />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <TextField
                                                                label={tr('Длительность', 'Duration')}
                                                                value={action.durationText}
                                                                onChange={(value) => updateMentionSpamDraftAction(index, { durationText: value })}
                                                                placeholder={tr('30m, 2h, 7d', '30m, 2h, 7d')}
                                                                inputClassName="h-[54px] py-0"
                                                                disabled={!actionUsesDuration(action.action)}
                                                            />
                                                        </div>
                                                        <div className="flex items-end">
                                                            <button
                                                                type="button"
                                                                onClick={() => removeMentionSpamDraftAction(index)}
                                                                className="flex h-[54px] w-full items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white/50 transition-all hover:border-rose-400/40 hover:bg-rose-500/15 hover:text-white"
                                                            >
                                                                <Trash size={18} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        <button
                                            type="button"
                                            onClick={addMentionSpamDraftAction}
                                            className="mt-3.5 flex w-full items-center justify-center gap-2 rounded-[20px] border border-dashed border-[var(--color-primary-1)]/50 bg-[var(--color-primary-1)]/8 py-3 text-sm font-bold tracking-wide text-[var(--color-primary-1)] transition-all hover:bg-[var(--color-primary-1)]/16"
                                        >
                                            <Plus size={18} weight="bold" />
                                            {tr('Добавить действие', 'Add Action')}
                                        </button>
                                    </div>
                                </div>
                            ) : null}
                        </div>

                        <div className="shrink-0 border-t border-[var(--border-divider)] bg-[var(--surface-hover)] px-6 py-4">
                            <div className="ml-auto flex w-full max-w-fit items-center justify-end gap-4">
                                <button
                                    type="button"
                                    onClick={closeMentionSpamModal}
                                    className="inline-flex h-12 min-w-[140px] items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-5 text-sm font-semibold text-white/70 transition-all hover:bg-white/10 hover:text-white"
                                >
                                    {tr('Отмена', 'Cancel')}
                                </button>
                                <button
                                    type="button"
                                    onClick={saveMentionSpamModal}
                                    disabled={!mentionSpamDraft}
                                    className="inline-flex h-12 min-w-[156px] items-center justify-center rounded-2xl bg-[var(--color-primary-1)] px-5 text-sm font-bold text-black transition-all hover:bg-[var(--color-primary-2)] disabled:pointer-events-none disabled:opacity-40"
                                >
                                    {tr('Сохранить', 'Save')}
                                </button>
                            </div>
                        </div>
                    </div>
                </ModalContent>
            </Modal>

            <Modal
                isOpen={isLinesModalOpen}
                onClose={closeLinesModal}
                size="5xl"
                scrollBehavior="inside"
                hideCloseButton
                classNames={{
                    base: "bg-[#111111] border border-[var(--border-subtle)] shadow-2xl rounded-[32px] overflow-hidden m-4",
                    backdrop: "bg-[#0e0e0e]/60 backdrop-blur-sm",
                }}
            >
                <ModalContent>
                    <div className="flex max-h-[85vh] flex-col">
                        <div className="flex shrink-0 items-center justify-between border-b border-[var(--border-divider)] bg-[var(--surface-hover)] p-6">
                            <div className="flex items-center gap-4">
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--color-primary-1)]/20 bg-[var(--color-primary-1)]/10 text-[var(--color-primary-1)]">
                                    <WarningOctagon size={20} weight="duotone" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold leading-tight text-white">
                                        {tr('Настройка строк', 'Lines settings')}
                                    </h2>
                                    <p className="mt-0.5 text-[11px] font-medium text-[var(--text-muted)]">
                                        {tr('Настройте игнорируемые каналы, лимит строк и действия при срабатывании.', 'Configure ignored channels, line limit, and actions on trigger.')}
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={closeLinesModal}
                                className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--surface-card)] text-[var(--text-muted)] transition-colors hover:bg-[var(--border-divider)]"
                                aria-label={tr('Закрыть', 'Close')}
                            >
                                <X size={14} weight="bold" />
                            </button>
                        </div>

                        <div className="custom-scrollbar flex-1 overflow-y-auto bg-[var(--surface-modal)] px-6 py-5">
                            {linesDraft ? (
                                <div className="space-y-5">
                                    <MultiSelectField
                                        label={tr('Игнорируемые каналы', 'Ignored Channels')}
                                        options={config.channels}
                                        selected={linesDraft.ignoredChannels}
                                        onChange={(keys) => setLinesDraft((prev) => prev ? ({ ...prev, ignoredChannels: keys }) : prev)}
                                        placeholder={tr('Выберите каналы или категории...', 'Select channels or categories...')}
                                    />

                                    <div className="rounded-[28px] border border-white/10 bg-black/25 p-3.5 shadow-inner">
                                        <TextField
                                            label={tr('Количество строк', 'Line count')}
                                            type="number"
                                            value={String(linesDraft.count)}
                                            onChange={(value) => setLinesDraft((prev) => prev ? ({
                                                ...prev,
                                                count: Math.max(1, parseInt(value, 10) || 0),
                                            }) : prev)}
                                            placeholder="5"
                                        />
                                    </div>

                                    <div className="rounded-[28px] border border-white/10 bg-black/25 p-3.5 shadow-inner">
                                        <div className="mb-3.5 flex items-center justify-between gap-4">
                                            <div>
                                                <p className="text-sm font-semibold text-white/80">{tr('Действия', 'Actions')}</p>
                                                <p className="text-xs text-white/40">{tr('Этот фильтр настраивает только действие и его длительность. Сообщение, вызвавшее фильтр, всё равно будет удалено даже при выборе другого действия.', 'This filter only configures the action and its duration. The message that triggered the filter will still be deleted even if another action is selected.')}</p>
                                            </div>
                                            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-white/40">
                                                {linesDraft.actions.length}
                                            </span>
                                        </div>

                                        <div className="space-y-3.5">
                                            {linesDraft.actions.map((action, index) => (
                                                <div key={`${action.action}-${index}`} className="rounded-[22px] border border-white/10 bg-black/20 p-3.5">
                                                    <div className="grid grid-cols-1 gap-3.5 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_56px]">
                                                        <div className="min-w-0">
                                                            <InteractiveSelect
                                                                label={tr('\u0414\u0435\u0439\u0441\u0442\u0432\u0438\u0435', 'Action')}
                                                                value={action.action}
                                                                onChange={(value) => updateLinesDraftAction(index, {
                                                                    action: value,
                                                                    durationText: actionUsesDuration(value) ? action.durationText : '',
                                                                })}
                                                                options={floodActionOptions}
                                                            />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <TextField
                                                                label={tr('Длительность', 'Duration')}
                                                                value={action.durationText}
                                                                onChange={(value) => updateLinesDraftAction(index, { durationText: value })}
                                                                placeholder={tr('30m, 2h, 7d', '30m, 2h, 7d')}
                                                                inputClassName="h-[54px] py-0"
                                                                disabled={!actionUsesDuration(action.action)}
                                                            />
                                                        </div>
                                                        <div className="flex items-end">
                                                            <button
                                                                type="button"
                                                                onClick={() => removeLinesDraftAction(index)}
                                                                className="flex h-[54px] w-full items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white/50 transition-all hover:border-rose-400/40 hover:bg-rose-500/15 hover:text-white"
                                                            >
                                                                <Trash size={18} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        <button
                                            type="button"
                                            onClick={addLinesDraftAction}
                                            className="mt-3.5 flex w-full items-center justify-center gap-2 rounded-[20px] border border-dashed border-[var(--color-primary-1)]/50 bg-[var(--color-primary-1)]/8 py-3 text-sm font-bold tracking-wide text-[var(--color-primary-1)] transition-all hover:bg-[var(--color-primary-1)]/16"
                                        >
                                            <Plus size={18} weight="bold" />
                                            {tr('Добавить действие', 'Add Action')}
                                        </button>
                                    </div>
                                </div>
                            ) : null}
                        </div>

                        <div className="shrink-0 border-t border-[var(--border-divider)] bg-[var(--surface-hover)] px-6 py-4">
                            <div className="ml-auto flex w-full max-w-fit items-center justify-end gap-4">
                                <button
                                    type="button"
                                    onClick={closeLinesModal}
                                    className="inline-flex h-12 min-w-[140px] items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-5 text-sm font-semibold text-white/70 transition-all hover:bg-white/10 hover:text-white"
                                >
                                    {tr('Отмена', 'Cancel')}
                                </button>
                                <button
                                    type="button"
                                    onClick={saveLinesModal}
                                    disabled={!linesDraft}
                                    className="inline-flex h-12 min-w-[156px] items-center justify-center rounded-2xl bg-[var(--color-primary-1)] px-5 text-sm font-bold text-black transition-all hover:bg-[var(--color-primary-2)] disabled:pointer-events-none disabled:opacity-40"
                                >
                                    {tr('Сохранить', 'Save')}
                                </button>
                            </div>
                        </div>
                    </div>
                </ModalContent>
            </Modal>

            <Modal
                isOpen={isLinksModalOpen}
                onClose={closeLinksModal}
                size="5xl"
                scrollBehavior="inside"
                hideCloseButton
                classNames={{
                    base: "bg-[#111111] border border-[var(--border-subtle)] shadow-2xl rounded-[32px] overflow-hidden m-4",
                    backdrop: "bg-[#0e0e0e]/60 backdrop-blur-sm",
                }}
            >
                <ModalContent>
                    <div className="flex max-h-[85vh] flex-col">
                        <div className="flex shrink-0 items-center justify-between border-b border-[var(--border-divider)] bg-[var(--surface-hover)] p-6">
                            <div className="flex items-center gap-4">
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--color-primary-1)]/20 bg-[var(--color-primary-1)]/10 text-[var(--color-primary-1)]">
                                    <WarningOctagon size={20} weight="duotone" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold leading-tight text-white">
                                        {tr('Настройка ссылок', 'Links settings')}
                                    </h2>
                                    <p className="mt-0.5 text-[11px] font-medium text-[var(--text-muted)]">
                                        {tr('Настройте игнорируемые каналы, режим списка доменов и действия при срабатывании.', 'Configure ignored channels, domain list mode, and actions on trigger.')}
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={closeLinksModal}
                                className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--surface-card)] text-[var(--text-muted)] transition-colors hover:bg-[var(--border-divider)]"
                                aria-label={tr('Закрыть', 'Close')}
                            >
                                <X size={14} weight="bold" />
                            </button>
                        </div>

                        <div className="custom-scrollbar flex-1 overflow-y-auto bg-[var(--surface-modal)] px-6 py-5">
                            {linksDraft ? (
                                <div className="space-y-5">
                                    <MultiSelectField
                                        label={tr('Игнорируемые каналы', 'Ignored Channels')}
                                        options={config.channels}
                                        selected={linksDraft.ignoredChannels}
                                        onChange={(keys) => setLinksDraft((prev) => prev ? ({ ...prev, ignoredChannels: keys }) : prev)}
                                        placeholder={tr('Выберите каналы или категории...', 'Select channels or categories...')}
                                    />

                                    <div className="rounded-[28px] border border-white/10 bg-black/25 p-3.5 shadow-inner">
                                        <div className="flex items-center justify-between gap-4">
                                            <div>
                                                <p className="text-sm font-semibold text-white/80">{tr('Список доменов', 'Domain list')}</p>
                                                <p className="text-xs text-white/40">{tr('Выберите, определяет ли список доменов разрешённые или запрещённые сайты.', 'Choose whether the domain list defines allowed or blocked sites.')}</p>
                                            </div>
                                            <div className="flex gap-1 rounded-lg border border-[var(--border-divider)] bg-[var(--surface-hover)] p-1">
                                                <button
                                                    type="button"
                                                    className={`px-3 py-1 text-xs rounded-md font-bold transition-colors ${linksDraft.mode === 'allowlist' ? 'bg-[var(--surface-card)] text-[var(--color-primary-1)] shadow-sm' : 'text-[var(--text-muted)]'}`}
                                                    onClick={() => setLinksDraft((prev) => prev ? ({ ...prev, mode: 'allowlist' }) : prev)}
                                                >
                                                    {tr('Разрешённые', 'Allowed')}
                                                </button>
                                                <button
                                                    type="button"
                                                    className={`px-3 py-1 text-xs rounded-md font-bold transition-colors ${linksDraft.mode === 'blocklist' ? 'bg-[var(--surface-card)] text-[var(--color-destructive)] shadow-sm' : 'text-[var(--text-muted)]'}`}
                                                    onClick={() => setLinksDraft((prev) => prev ? ({ ...prev, mode: 'blocklist' }) : prev)}
                                                >
                                                    {tr('Запрещённые', 'Blocked')}
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    <label className="block space-y-2 group min-w-0">
                                        <span className="text-sm font-semibold tracking-wide text-white/50 transition-colors group-hover:text-white/80">
                                            {tr('Список доменов', 'Domain list')}
                                        </span>
                                        <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3.5 shadow-inner transition-all duration-300 hover:bg-black/40 hover:border-white/20 focus-within:border-[var(--color-primary-1)] focus-within:ring-2 focus-within:ring-[var(--color-primary-1)]/20">
                                            <div className="flex flex-wrap items-center gap-2">
                                                {linksDraft.domains.map((domain) => (
                                                    <span
                                                        key={domain}
                                                        className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/90 shadow-sm backdrop-blur-md"
                                                    >
                                                        <span className="max-w-[220px] truncate">{domain}</span>
                                                        <button
                                                            type="button"
                                                            onClick={() => setLinksDraft((prev) => prev ? ({
                                                                ...prev,
                                                                domains: prev.domains.filter((item) => item !== domain),
                                                            }) : prev)}
                                                            className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-black/20 text-white/60 transition-colors hover:bg-rose-500 hover:text-white"
                                                            aria-label={tr(`\u0423\u0434\u0430\u043b\u0438\u0442\u044c \u0434\u043e\u043c\u0435\u043d ${domain}`, `Remove domain ${domain}`)}
                                                        >
                                                            <X size={10} weight="bold" />
                                                        </button>
                                                    </span>
                                                ))}
                                                <input
                                                    type="text"
                                                    value={linksDomainInput}
                                                    onChange={(event) => {
                                                        const value = event.target.value;
                                                        if (/\s/.test(value)) {
                                                            commitLinkDomains(value);
                                                            setLinksDomainInput('');
                                                            return;
                                                        }
                                                        setLinksDomainInput(value);
                                                    }}
                                                    onKeyDown={(event) => {
                                                        if (event.key === 'Enter') {
                                                            event.preventDefault();
                                                            commitLinkDomains(linksDomainInput);
                                                            setLinksDomainInput('');
                                                            return;
                                                        }

                                                        if (event.key === 'Backspace' && !linksDomainInput && linksDraft.domains.length) {
                                                            event.preventDefault();
                                                            setLinksDraft((prev) => prev ? ({
                                                                ...prev,
                                                                domains: prev.domains.slice(0, -1),
                                                            }) : prev);
                                                        }
                                                    }}
                                                    onBlur={() => {
                                                        if (!linksDomainInput.trim()) return;
                                                        commitLinkDomains(linksDomainInput);
                                                        setLinksDomainInput('');
                                                    }}
                                                    className="min-w-[180px] flex-1 bg-transparent text-sm text-white/90 outline-none placeholder:text-white/30"
                                                    placeholder={tr('Введите домен и нажмите пробел или Enter', 'Type a domain and press Space or Enter')}
                                                    aria-label={tr('Поле домена', 'Domain input')}
                                                />
                                            </div>
                                        </div>
                                    </label>

                                    <div className="rounded-[28px] border border-white/10 bg-black/25 p-3.5 shadow-inner">
                                        <div className="mb-3.5 flex items-center justify-between gap-4">
                                            <div>
                                                <p className="text-sm font-semibold text-white/80">{tr('Действия', 'Actions')}</p>
                                                <p className="text-xs text-white/40">{tr('Для ссылок настраивается только действие и его длительность. Сообщение, вызвавшее фильтр, всё равно будет удалено даже при выборе другого действия.', 'For links, only the action and its duration are configured. The message that triggered the filter will still be deleted even if another action is selected.')}</p>
                                            </div>
                                            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-white/40">
                                                {linksDraft.actions.length}
                                            </span>
                                        </div>

                                        <div className="space-y-3.5">
                                            {linksDraft.actions.map((action, index) => (
                                                <div key={`${action.action}-${index}`} className="rounded-[22px] border border-white/10 bg-black/20 p-3.5">
                                                    <div className="grid grid-cols-1 gap-3.5 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_56px]">
                                                        <div className="min-w-0">
                                                            <InteractiveSelect
                                                                label={tr('\u0414\u0435\u0439\u0441\u0442\u0432\u0438\u0435', 'Action')}
                                                                value={action.action}
                                                                onChange={(value) => updateLinksDraftAction(index, {
                                                                    action: value,
                                                                    durationText: actionUsesDuration(value) ? action.durationText : '',
                                                                })}
                                                                options={floodActionOptions}
                                                            />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <TextField
                                                                label={tr('Длительность', 'Duration')}
                                                                value={action.durationText}
                                                                onChange={(value) => updateLinksDraftAction(index, { durationText: value })}
                                                                placeholder={tr('30m, 2h, 7d', '30m, 2h, 7d')}
                                                                inputClassName="h-[54px] py-0"
                                                                disabled={!actionUsesDuration(action.action)}
                                                            />
                                                        </div>
                                                        <div className="flex items-end">
                                                            <button
                                                                type="button"
                                                                onClick={() => removeLinksDraftAction(index)}
                                                                className="flex h-[54px] w-full items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white/50 transition-all hover:border-rose-400/40 hover:bg-rose-500/15 hover:text-white"
                                                            >
                                                                <Trash size={18} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        <button
                                            type="button"
                                            onClick={addLinksDraftAction}
                                            className="mt-3.5 flex w-full items-center justify-center gap-2 rounded-[20px] border border-dashed border-[var(--color-primary-1)]/50 bg-[var(--color-primary-1)]/8 py-3 text-sm font-bold tracking-wide text-[var(--color-primary-1)] transition-all hover:bg-[var(--color-primary-1)]/16"
                                        >
                                            <Plus size={18} weight="bold" />
                                            {tr('Добавить действие', 'Add Action')}
                                        </button>
                                    </div>
                                </div>
                            ) : null}
                        </div>

                        <div className="shrink-0 border-t border-[var(--border-divider)] bg-[var(--surface-hover)] px-6 py-4">
                            <div className="ml-auto flex w-full max-w-fit items-center justify-end gap-4">
                                <button
                                    type="button"
                                    onClick={closeLinksModal}
                                    className="inline-flex h-12 min-w-[140px] items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-5 text-sm font-semibold text-white/70 transition-all hover:bg-white/10 hover:text-white"
                                >
                                    {tr('Отмена', 'Cancel')}
                                </button>
                                <button
                                    type="button"
                                    onClick={saveLinksModal}
                                    disabled={!linksDraft}
                                    className="inline-flex h-12 min-w-[156px] items-center justify-center rounded-2xl bg-[var(--color-primary-1)] px-5 text-sm font-bold text-black transition-all hover:bg-[var(--color-primary-2)] disabled:pointer-events-none disabled:opacity-40"
                                >
                                    {tr('Сохранить', 'Save')}
                                </button>
                            </div>
                        </div>
                    </div>
                </ModalContent>
            </Modal>

            <Modal
                isOpen={isBanwordsModalOpen}
                onClose={closeBanwordsModal}
                size="5xl"
                backdrop="blur"
                hideCloseButton
                classNames={{
                    base: 'border border-[var(--border-subtle)] bg-[var(--surface-card)] shadow-2xl rounded-[32px] overflow-hidden',
                    backdrop: 'bg-black/70 backdrop-blur-md',
                }}
            >
                <ModalContent>
                    <div className="flex max-h-[85vh] flex-col bg-[var(--surface-card)]">
                        <div className="flex items-start justify-between border-b border-[var(--border-divider)] px-6 py-5">
                            <div className="flex items-center gap-4">
                                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-black/20 text-[var(--color-primary-1)] shadow-inner">
                                    <FilterGlyph ruleKey="banwords" active />
                                </div>
                                <div>
                                    <h3 className="text-2xl font-black uppercase tracking-[0.08em] text-white">
                                        {tr('\u041d\u0430\u0441\u0442\u0440\u043e\u0439\u043a\u0430 \u0437\u0430\u043f\u0440\u0435\u0449\u0451\u043d\u043d\u044b\u0445 \u0441\u043b\u043e\u0432', 'Banwords Settings')}
                                    </h3>
                                    <p className="mt-1 text-sm text-white/40">
                                        {tr('\u0418\u0433\u043d\u043e\u0440\u0438\u0440\u0443\u0435\u043c\u044b\u0435 \u043a\u0430\u043d\u0430\u043b\u044b, \u0440\u043e\u043b\u0438, \u0441\u043f\u0438\u0441\u043e\u043a \u0441\u043b\u043e\u0432 \u0438 \u0441\u0442\u0443\u043f\u0435\u043d\u0438 \u0440\u0435\u0430\u043a\u0446\u0438\u0438 \u043d\u0430 \u0438\u0445 \u043e\u0431\u043d\u0430\u0440\u0443\u0436\u0435\u043d\u0438\u0435.', 'Ignored channels, roles, forbidden words, and the response steps for detecting them.')}
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={closeBanwordsModal}
                                className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--surface-card)] text-[var(--text-muted)] transition-colors hover:bg-[var(--border-divider)]"
                                aria-label={tr('\u0417\u0430\u043a\u0440\u044b\u0442\u044c', 'Close')}
                            >
                                <X size={14} weight="bold" />
                            </button>
                        </div>

                        <div className="custom-scrollbar flex-1 overflow-y-auto bg-[var(--surface-modal)] px-6 py-5">
                            {banwordsDraft ? (
                                <div className="space-y-5">
                                    <MultiSelectField
                                        label={tr('\u0418\u0433\u043d\u043e\u0440\u0438\u0440\u0443\u0435\u043c\u044b\u0435 \u043a\u0430\u043d\u0430\u043b\u044b', 'Ignored Channels')}
                                        options={config.channels}
                                        selected={banwordsDraft.ignoredChannels}
                                        onChange={(keys) => setBanwordsDraft((prev) => prev ? ({ ...prev, ignoredChannels: keys }) : prev)}
                                        placeholder={tr('\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u043a\u0430\u043d\u0430\u043b\u044b \u0438\u043b\u0438 \u043a\u0430\u0442\u0435\u0433\u043e\u0440\u0438\u0438...', 'Select channels or categories...')}
                                    />

                                    <MultiSelectField
                                        label={tr('\u0418\u0433\u043d\u043e\u0440\u0438\u0440\u0443\u0435\u043c\u044b\u0435 \u0440\u043e\u043b\u0438', 'Ignored Roles')}
                                        options={config.roles}
                                        selected={banwordsDraft.ignoredRoles}
                                        onChange={(keys) => setBanwordsDraft((prev) => prev ? ({ ...prev, ignoredRoles: keys }) : prev)}
                                        placeholder={tr('\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u0440\u043e\u043b\u0438 \u0434\u043b\u044f \u044d\u0442\u043e\u0433\u043e \u0444\u0438\u043b\u044c\u0442\u0440\u0430...', 'Select roles for this filter...')}
                                    />

                                    <ChipField
                                        label={tr('\u0421\u043f\u0438\u0441\u043e\u043a \u0441\u043b\u043e\u0432', 'Word list')}
                                        values={banwordsDraft.words}
                                        inputValue={banwordsInput}
                                        onInputChange={setBanwordsInput}
                                        onCommit={commitBanwords}
                                        onRemove={(value) => setBanwordsDraft((prev) => prev ? ({ ...prev, words: prev.words.filter((item) => item !== value) }) : prev)}
                                        onBackspaceEmpty={() => setBanwordsDraft((prev) => prev ? ({ ...prev, words: prev.words.slice(0, -1) }) : prev)}
                                        placeholder={tr('\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u0441\u043b\u043e\u0432\u043e \u0438 \u043d\u0430\u0436\u043c\u0438\u0442\u0435 \u043f\u0440\u043e\u0431\u0435\u043b \u0438\u043b\u0438 Enter', 'Type a word and press Space or Enter')}
                                    />

                                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                                        <div className="flex items-center justify-between rounded-[22px] border border-white/10 bg-black/20 px-4 py-3.5">
                                            <div className="pr-4">
                                                <p className="text-sm font-semibold text-white/80">{tr('\u0418\u0441\u043a\u0430\u0442\u044c \u0442\u043e\u043b\u044c\u043a\u043e \u0446\u0435\u043b\u044b\u0435 \u0441\u043b\u043e\u0432\u0430', 'Match whole words only')}</p>
                                                <p className="mt-1 text-xs text-white/40">{tr('Проверка слова на полное совпадение с заданным', 'Check a word for an exact match against the provided term.')}</p>
                                            </div>
                                            <div className="scale-90">
                                                <SmoothToggle
                                                    label=""
                                                    checked={banwordsDraft.matchWholeWordsOnly}
                                                    onChange={(value) => setBanwordsDraft((prev) => prev ? ({ ...prev, matchWholeWordsOnly: value }) : prev)}
                                                />
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between rounded-[22px] border border-white/10 bg-black/20 px-4 py-3.5">
                                            <div className="pr-4">
                                                <p className="text-sm font-semibold text-white/80">{tr('\u0411\u0435\u0437 \u0443\u0447\u0451\u0442\u0430 \u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0430', 'Case-insensitive')}</p>
                                                <p className="mt-1 text-xs text-white/40">{tr('Проверка с чувствительностью к регистру и форматированию', 'Case-sensitive and formatting-sensitive check.')}</p>
                                            </div>
                                            <div className="scale-90">
                                                <SmoothToggle
                                                    label=""
                                                    checked={banwordsDraft.ignoreCase}
                                                    onChange={(value) => setBanwordsDraft((prev) => prev ? ({ ...prev, ignoreCase: value }) : prev)}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="rounded-[28px] border border-white/10 bg-black/25 p-3.5 shadow-inner">
                                        <div className="mb-3.5 flex items-center justify-between gap-4">
                                            <div>
                                                <p className="text-sm font-semibold text-white/80">{tr('\u0414\u0435\u0439\u0441\u0442\u0432\u0438\u044f', 'Actions')}</p>
                                                <p className="text-xs text-white/40">{tr('\u0414\u043b\u044f \u0437\u0430\u043f\u0440\u0435\u0449\u0451\u043d\u043d\u044b\u0445 \u0441\u043b\u043e\u0432 \u043d\u0430\u0441\u0442\u0440\u0430\u0438\u0432\u0430\u0435\u0442\u0441\u044f \u0442\u043e\u043b\u044c\u043a\u043e \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0435 \u0438 \u0435\u0433\u043e \u0434\u043b\u0438\u0442\u0435\u043b\u044c\u043d\u043e\u0441\u0442\u044c. \u0421\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435, \u0432\u044b\u0437\u0432\u0430\u0432\u0448\u0435\u0435 \u0444\u0438\u043b\u044c\u0442\u0440, \u0432\u0441\u0451 \u0440\u0430\u0432\u043d\u043e \u0431\u0443\u0434\u0435\u0442 \u0443\u0434\u0430\u043b\u0435\u043d\u043e \u0434\u0430\u0436\u0435 \u043f\u0440\u0438 \u0432\u044b\u0431\u043e\u0440\u0435 \u0434\u0440\u0443\u0433\u043e\u0433\u043e \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u044f.', 'For banwords, only the action and its duration are configured. The message that triggered the filter will still be deleted even if another action is selected.')}</p>
                                            </div>
                                            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-white/40">
                                                {banwordsDraft.actions.length}
                                            </span>
                                        </div>

                                        <div className="space-y-3.5">
                                            {banwordsDraft.actions.map((action, index) => (
                                                <div key={`${action.action}-${index}`} className="rounded-[22px] border border-white/10 bg-black/20 p-3.5">
                                                    <div className="grid grid-cols-1 gap-3.5 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_56px]">
                                                        <div className="min-w-0">
                                                            <InteractiveSelect
                                                                label={tr('\u0414\u0435\u0439\u0441\u0442\u0432\u0438\u0435', 'Action')}
                                                                value={action.action}
                                                                onChange={(value) => updateBanwordsDraftAction(index, { action: value, durationText: actionUsesDuration(value) ? action.durationText : '' })}
                                                                options={floodActionOptions}
                                                            />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <TextField
                                                                label={tr('\u0414\u043b\u0438\u0442\u0435\u043b\u044c\u043d\u043e\u0441\u0442\u044c', 'Duration')}
                                                                value={action.durationText}
                                                                onChange={(value) => updateBanwordsDraftAction(index, { durationText: value })}
                                                                placeholder={tr('30m, 2h, 7d', '30m, 2h, 7d')}
                                                                inputClassName="h-[54px] py-0"
                                                                disabled={!actionUsesDuration(action.action)}
                                                            />
                                                        </div>
                                                        <div className="flex items-end">
                                                            <button
                                                                type="button"
                                                                onClick={() => removeBanwordsDraftAction(index)}
                                                                className="flex h-[54px] w-full items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white/50 transition-all hover:border-rose-400/40 hover:bg-rose-500/15 hover:text-white"
                                                            >
                                                                <Trash size={18} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        <button
                                            type="button"
                                            onClick={addBanwordsDraftAction}
                                            className="mt-3.5 flex w-full items-center justify-center gap-2 rounded-[20px] border border-dashed border-[var(--color-primary-1)]/50 bg-[var(--color-primary-1)]/8 py-3 text-sm font-bold tracking-wide text-[var(--color-primary-1)] transition-all hover:bg-[var(--color-primary-1)]/16"
                                        >
                                            <Plus size={18} weight="bold" />
                                            {tr('\u0414\u043e\u0431\u0430\u0432\u0438\u0442\u044c \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0435', 'Add Action')}
                                        </button>
                                    </div>
                                </div>
                            ) : null}
                        </div>

                        <div className="shrink-0 border-t border-[var(--border-divider)] bg-[var(--surface-hover)] px-6 py-4">
                            <div className="ml-auto flex w-full max-w-fit items-center justify-end gap-4">
                                <button
                                    type="button"
                                    onClick={closeBanwordsModal}
                                    className="inline-flex h-12 min-w-[140px] items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-5 text-sm font-semibold text-white/70 transition-all hover:bg-white/10 hover:text-white"
                                >
                                    {tr('\u041e\u0442\u043c\u0435\u043d\u0430', 'Cancel')}
                                </button>
                                <button
                                    type="button"
                                    onClick={saveBanwordsModal}
                                    disabled={!banwordsDraft}
                                    className="inline-flex h-12 min-w-[156px] items-center justify-center rounded-2xl bg-[var(--color-primary-1)] px-5 text-sm font-bold text-black transition-all hover:bg-[var(--color-primary-2)] disabled:pointer-events-none disabled:opacity-40"
                                >
                                    {tr('\u0421\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c', 'Save')}
                                </button>
                            </div>
                        </div>
                    </div>
                </ModalContent>
            </Modal>

            <Modal
                isOpen={isAdvertisingModalOpen}
                onClose={closeAdvertisingModal}
                size="5xl"
                scrollBehavior="inside"
                hideCloseButton
                classNames={{
                    base: "bg-[#111111] border border-[var(--border-subtle)] shadow-2xl rounded-[32px] overflow-hidden m-4",
                    backdrop: "bg-[#0e0e0e]/60 backdrop-blur-sm",
                }}
            >
                <ModalContent>
                    <div className="flex max-h-[85vh] flex-col">
                        <div className="flex shrink-0 items-center justify-between border-b border-[var(--border-divider)] bg-[var(--surface-hover)] p-6">
                            <div className="flex items-center gap-4">
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--color-primary-1)]/20 bg-[var(--color-primary-1)]/10 text-[var(--color-primary-1)]">
                                    <WarningOctagon size={20} weight="duotone" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold leading-tight text-white">
                                        {tr('Настройка рекламы', 'Advertising settings')}
                                    </h2>
                                    <p className="mt-0.5 text-[11px] font-medium text-[var(--text-muted)]">
                                        {tr('Настройте Discord-инвайты, реферальные ссылки и scam-подобные ссылки внутри одного фильтра.', 'Configure Discord invites, referral links, and scam-like links inside one filter.')}
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={closeAdvertisingModal}
                                className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--surface-card)] text-[var(--text-muted)] transition-colors hover:bg-[var(--border-divider)]"
                                aria-label={tr('Закрыть', 'Close')}
                            >
                                <X size={14} weight="bold" />
                            </button>
                        </div>

                        <div className="custom-scrollbar flex-1 overflow-y-auto bg-[var(--surface-modal)] px-6 py-5">
                            {advertisingDraft ? (
                                <div className="space-y-5">
                                    <MultiSelectField
                                        label={tr('Игнорируемые каналы', 'Ignored Channels')}
                                        options={config.channels}
                                        selected={advertisingDraft.ignoredChannels}
                                        onChange={(keys) => updateAdvertisingDraft({ ignoredChannels: keys })}
                                        placeholder={tr('Выберите каналы или категории...', 'Select channels or categories...')}
                                    />

                                    <div className="rounded-[28px] border border-white/10 bg-black/25 p-4 shadow-inner">
                                        <div className="mb-4 flex items-start justify-between gap-4">
                                            <div>
                                                <p className="text-sm font-semibold text-white/80">{tr('Discord invites', 'Discord invites')}</p>
                                                <p className="text-xs text-white/40">{tr('Блокируются только Discord invite-ссылки на внешние серверы. Инвайты текущего сервера разрешены.', 'Only Discord invite links to external servers are blocked. Invites for the current guild are allowed.')}</p>
                                            </div>
                                            <div className="scale-90">
                                                <SmoothToggle
                                                    label=""
                                                    checked={advertisingDraft.discordInvites.enabled}
                                                    onChange={(value) => setAdvertisingDraft((prev) => prev ? ({
                                                        ...prev,
                                                        discordInvites: { ...prev.discordInvites, enabled: value },
                                                    }) : prev)}
                                                />
                                            </div>
                                        </div>

                                        {renderAdvertisingActions(
                                            'discordInvites',
                                            advertisingDraft.discordInvites.actions,
                                            tr(
                                                '\u0414\u043b\u044f Discord invites \u043d\u0430\u0441\u0442\u0440\u0430\u0438\u0432\u0430\u0435\u0442\u0441\u044f \u0442\u043e\u043b\u044c\u043a\u043e \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0435 \u0438 \u0435\u0433\u043e \u0434\u043b\u0438\u0442\u0435\u043b\u044c\u043d\u043e\u0441\u0442\u044c. \u0421\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435, \u0432\u044b\u0437\u0432\u0430\u0432\u0448\u0435\u0435 \u0444\u0438\u043b\u044c\u0442\u0440, \u0432\u0441\u0451 \u0440\u0430\u0432\u043d\u043e \u0431\u0443\u0434\u0435\u0442 \u0443\u0434\u0430\u043b\u0435\u043d\u043e \u0434\u0430\u0436\u0435 \u043f\u0440\u0438 \u0432\u044b\u0431\u043e\u0440\u0435 \u0434\u0440\u0443\u0433\u043e\u0433\u043e \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u044f.',
                                                'For Discord invites, only the action and duration are configured. The message that triggered the filter will still be deleted even if another action is selected.'
                                            )
                                        )}
                                    </div>

                                    <div className="rounded-[28px] border border-white/10 bg-black/25 p-4 shadow-inner">
                                        <div className="mb-4 flex items-start justify-between gap-4">
                                            <div>
                                                <p className="text-sm font-semibold text-white/80">{tr('Referral', 'Referral')}</p>
                                                <p className="text-xs text-white/40">{tr('Ловит реферальные ссылки, фразы и коды. Можно расширить своими доменами, фразами и токенами.', 'Detects referral links, phrases, and codes. You can extend it with custom domains, phrases, and tokens.')}</p>
                                            </div>
                                            <div className="scale-90">
                                                <SmoothToggle
                                                    label=""
                                                    checked={advertisingDraft.referrals.enabled}
                                                    onChange={(value) => setAdvertisingDraft((prev) => prev ? ({
                                                        ...prev,
                                                        referrals: { ...prev.referrals, enabled: value },
                                                    }) : prev)}
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-5">
                                            <ChipField
                                                label={tr('Реферальные домены', 'Referral domains')}
                                                values={advertisingDraft.referrals.customDomains}
                                                inputValue={advertisingInputs.referralDomain}
                                                onInputChange={(value) => setAdvertisingInputs((prev) => ({ ...prev, referralDomain: value }))}
                                                onCommit={(rawValue) => commitAdvertisingList('referrals', 'customDomains', rawValue)}
                                                onRemove={(value) => setAdvertisingDraft((prev) => prev ? ({
                                                    ...prev,
                                                    referrals: {
                                                        ...prev.referrals,
                                                        customDomains: prev.referrals.customDomains.filter((item) => item !== value),
                                                    },
                                                }) : prev)}
                                                onBackspaceEmpty={() => setAdvertisingDraft((prev) => prev ? ({
                                                    ...prev,
                                                    referrals: {
                                                        ...prev.referrals,
                                                        customDomains: prev.referrals.customDomains.slice(0, -1),
                                                    },
                                                }) : prev)}
                                                placeholder={tr('Введите домен и нажмите пробел или Enter', 'Type a domain and press Space or Enter')}
                                            />

                                            <ChipField
                                                label={tr('Referral-фразы', 'Referral phrases')}
                                                values={advertisingDraft.referrals.customPhrases}
                                                inputValue={advertisingInputs.referralPhrase}
                                                onInputChange={(value) => setAdvertisingInputs((prev) => ({ ...prev, referralPhrase: value }))}
                                                onCommit={(rawValue) => commitAdvertisingList('referrals', 'customPhrases', rawValue)}
                                                onRemove={(value) => setAdvertisingDraft((prev) => prev ? ({
                                                    ...prev,
                                                    referrals: {
                                                        ...prev.referrals,
                                                        customPhrases: prev.referrals.customPhrases.filter((item) => item !== value),
                                                    },
                                                }) : prev)}
                                                onBackspaceEmpty={() => setAdvertisingDraft((prev) => prev ? ({
                                                    ...prev,
                                                    referrals: {
                                                        ...prev.referrals,
                                                        customPhrases: prev.referrals.customPhrases.slice(0, -1),
                                                    },
                                                }) : prev)}
                                                placeholder={tr('Введите фразу и нажмите пробел или Enter', 'Type a phrase and press Space or Enter')}
                                            />

                                            <ChipField
                                                label={tr('Referral-коды и токены', 'Referral codes and tokens')}
                                                values={advertisingDraft.referrals.customCodeTokens}
                                                inputValue={advertisingInputs.referralCode}
                                                onInputChange={(value) => setAdvertisingInputs((prev) => ({ ...prev, referralCode: value }))}
                                                onCommit={(rawValue) => commitAdvertisingList('referrals', 'customCodeTokens', rawValue)}
                                                onRemove={(value) => setAdvertisingDraft((prev) => prev ? ({
                                                    ...prev,
                                                    referrals: {
                                                        ...prev.referrals,
                                                        customCodeTokens: prev.referrals.customCodeTokens.filter((item) => item !== value),
                                                    },
                                                }) : prev)}
                                                onBackspaceEmpty={() => setAdvertisingDraft((prev) => prev ? ({
                                                    ...prev,
                                                    referrals: {
                                                        ...prev.referrals,
                                                        customCodeTokens: prev.referrals.customCodeTokens.slice(0, -1),
                                                    },
                                                }) : prev)}
                                                placeholder={tr('Введите код и нажмите пробел или Enter', 'Type a code and press Space or Enter')}
                                            />

                                            {renderAdvertisingActions(
                                                'referrals',
                                                advertisingDraft.referrals.actions,
                                                tr(
                                                '\u0414\u043b\u044f referral-\u0444\u0438\u043b\u044c\u0442\u0440\u0430 \u043d\u0430\u0441\u0442\u0440\u0430\u0438\u0432\u0430\u0435\u0442\u0441\u044f \u0442\u043e\u043b\u044c\u043a\u043e \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0435 \u0438 \u0435\u0433\u043e \u0434\u043b\u0438\u0442\u0435\u043b\u044c\u043d\u043e\u0441\u0442\u044c. \u0421\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435, \u0432\u044b\u0437\u0432\u0430\u0432\u0448\u0435\u0435 \u0444\u0438\u043b\u044c\u0442\u0440, \u0432\u0441\u0451 \u0440\u0430\u0432\u043d\u043e \u0431\u0443\u0434\u0435\u0442 \u0443\u0434\u0430\u043b\u0435\u043d\u043e \u0434\u0430\u0436\u0435 \u043f\u0440\u0438 \u0432\u044b\u0431\u043e\u0440\u0435 \u0434\u0440\u0443\u0433\u043e\u0433\u043e \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u044f.',
                                                'For the referral filter, only the action and duration are configured. The message that triggered the filter will still be deleted even if another action is selected.'
                                            )
                                        )}
                                        </div>
                                    </div>

                                    <div className="rounded-[28px] border border-white/10 bg-black/25 p-4 shadow-inner">
                                        <div className="mb-4 flex items-start justify-between gap-4">
                                            <div>
                                                <p className="text-sm font-semibold text-white/80">{tr('Scam-like links', 'Scam-like links')}</p>
                                                <p className="text-xs text-white/40">{tr('Проверяет только сообщения со ссылками и оценивает scam-сигналы по встроенным и пользовательским эвристикам.', 'Checks only messages with links and scores scam signals using built-in and custom heuristics.')}</p>
                                            </div>
                                            <div className="scale-90">
                                                <SmoothToggle
                                                    label=""
                                                    checked={advertisingDraft.scamLinks.enabled}
                                                    onChange={(value) => setAdvertisingDraft((prev) => prev ? ({
                                                        ...prev,
                                                        scamLinks: { ...prev.scamLinks, enabled: value },
                                                    }) : prev)}
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-5">
                                            <ChipField
                                                label={tr('Подозрительные домены', 'Suspicious domains')}
                                                values={advertisingDraft.scamLinks.customDomains}
                                                inputValue={advertisingInputs.scamDomain}
                                                onInputChange={(value) => setAdvertisingInputs((prev) => ({ ...prev, scamDomain: value }))}
                                                onCommit={(rawValue) => commitAdvertisingList('scamLinks', 'customDomains', rawValue)}
                                                onRemove={(value) => setAdvertisingDraft((prev) => prev ? ({
                                                    ...prev,
                                                    scamLinks: {
                                                        ...prev.scamLinks,
                                                        customDomains: prev.scamLinks.customDomains.filter((item) => item !== value),
                                                    },
                                                }) : prev)}
                                                onBackspaceEmpty={() => setAdvertisingDraft((prev) => prev ? ({
                                                    ...prev,
                                                    scamLinks: {
                                                        ...prev.scamLinks,
                                                        customDomains: prev.scamLinks.customDomains.slice(0, -1),
                                                    },
                                                }) : prev)}
                                                placeholder={tr('Введите домен и нажмите пробел или Enter', 'Type a domain and press Space or Enter')}
                                            />

                                            <ChipField
                                                label={tr('Scam-фразы', 'Scam phrases')}
                                                values={advertisingDraft.scamLinks.customPhrases}
                                                inputValue={advertisingInputs.scamPhrase}
                                                onInputChange={(value) => setAdvertisingInputs((prev) => ({ ...prev, scamPhrase: value }))}
                                                onCommit={(rawValue) => commitAdvertisingList('scamLinks', 'customPhrases', rawValue)}
                                                onRemove={(value) => setAdvertisingDraft((prev) => prev ? ({
                                                    ...prev,
                                                    scamLinks: {
                                                        ...prev.scamLinks,
                                                        customPhrases: prev.scamLinks.customPhrases.filter((item) => item !== value),
                                                    },
                                                }) : prev)}
                                                onBackspaceEmpty={() => setAdvertisingDraft((prev) => prev ? ({
                                                    ...prev,
                                                    scamLinks: {
                                                        ...prev.scamLinks,
                                                        customPhrases: prev.scamLinks.customPhrases.slice(0, -1),
                                                    },
                                                }) : prev)}
                                                placeholder={tr('Введите фразу и нажмите пробел или Enter', 'Type a phrase and press Space or Enter')}
                                            />

                                            {renderAdvertisingActions(
                                                'scamLinks',
                                                advertisingDraft.scamLinks.actions,
                                                tr(
                                                '\u0414\u043b\u044f scam-\u043f\u043e\u0434\u043e\u0431\u043d\u044b\u0445 \u0441\u0441\u044b\u043b\u043e\u043a \u043d\u0430\u0441\u0442\u0440\u0430\u0438\u0432\u0430\u0435\u0442\u0441\u044f \u0442\u043e\u043b\u044c\u043a\u043e \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0435 \u0438 \u0435\u0433\u043e \u0434\u043b\u0438\u0442\u0435\u043b\u044c\u043d\u043e\u0441\u0442\u044c. \u0421\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435, \u0432\u044b\u0437\u0432\u0430\u0432\u0448\u0435\u0435 \u0444\u0438\u043b\u044c\u0442\u0440, \u0432\u0441\u0451 \u0440\u0430\u0432\u043d\u043e \u0431\u0443\u0434\u0435\u0442 \u0443\u0434\u0430\u043b\u0435\u043d\u043e \u0434\u0430\u0436\u0435 \u043f\u0440\u0438 \u0432\u044b\u0431\u043e\u0440\u0435 \u0434\u0440\u0443\u0433\u043e\u0433\u043e \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u044f.',
                                                'For scam-like links, only the action and duration are configured. The message that triggered the filter will still be deleted even if another action is selected.'
                                            )
                                        )}
                                        </div>
                                    </div>
                                </div>
                            ) : null}
                        </div>

                        <div className="shrink-0 border-t border-[var(--border-divider)] bg-[var(--surface-hover)] px-6 py-4">
                            <div className="ml-auto flex w-full max-w-fit items-center justify-end gap-4">
                                <button
                                    type="button"
                                    onClick={closeAdvertisingModal}
                                    className="inline-flex h-12 min-w-[140px] items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-5 text-sm font-semibold text-white/70 transition-all hover:bg-white/10 hover:text-white"
                                >
                                    {tr('Отмена', 'Cancel')}
                                </button>
                                <button
                                    type="button"
                                    onClick={saveAdvertisingModal}
                                    disabled={!advertisingDraft}
                                    className="inline-flex h-12 min-w-[156px] items-center justify-center rounded-2xl bg-[var(--color-primary-1)] px-5 text-sm font-bold text-black transition-all hover:bg-[var(--color-primary-2)] disabled:pointer-events-none disabled:opacity-40"
                                >
                                    {tr('Сохранить', 'Save')}
                                </button>
                            </div>
                        </div>
                    </div>
                </ModalContent>
            </Modal>
        </div>
    );
}


