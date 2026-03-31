'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle, Keyboard, Prohibit, ShieldCheck, WarningCircle } from '@phosphor-icons/react';
import { useGuildLocale } from '@/lib/i18n';
import { ConfigState } from '@/app/dashboard/[guildId]/moderation/types';
import { emptyConfig } from '@/app/dashboard/[guildId]/moderation/constants';
import { buildConfigStateFromResponse, buildModerationSavePayload } from '@/app/dashboard/[guildId]/moderation/configState';
import { CommandOverridesPanel } from '@/components/commands/CommandOverridesPanel';
import { FloatingSaveBar } from '@/components/common/FloatingSaveBar';
import { AnimatedCard, Badge, MultiSelectField } from '@/components/moderation/ui';
import { buildChannelSelectOptions } from '@/lib/channelSelectOptions';

type ChannelListMode = 'whitelist' | 'blacklist';
type LocaleCode = 'en' | 'ru';

type BotSettingsState = {
    prefixCommandsEnabled: boolean;
    commandChannelMode: ChannelListMode;
    allowedTextChannels: string[];
    adminRoles: string[];
    restoreRolesOnRejoin: boolean;
    restoreNicknameOnRejoin: boolean;
    locale: LocaleCode | null;
    timezone: string | null;
};

const TEXT_CHANNEL_TYPES = new Set([0, 5, 11, 12, 15, 16, 'text', 'announcement', 'news', 'public_thread', 'private_thread', 'forum', 'media', 'GUILD_TEXT', 'GUILD_NEWS', 'GUILD_FORUM', 'GUILD_MEDIA']);
const CATEGORY_CHANNEL_TYPES = new Set([4, 'category', 'GUILD_CATEGORY']);

const createDefaultBotSettings = (): BotSettingsState => ({
    prefixCommandsEnabled: true,
    commandChannelMode: 'blacklist',
    allowedTextChannels: [],
    adminRoles: [],
    restoreRolesOnRejoin: false,
    restoreNicknameOnRejoin: false,
    locale: null,
    timezone: null,
});

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

const normalizeChannelListMode = (value: unknown): ChannelListMode => {
    if (typeof value !== 'string') {
        return 'blacklist';
    }

    return value.toLowerCase() === 'whitelist' ? 'whitelist' : 'blacklist';
};

const normalizeLocale = (value: unknown): LocaleCode | null => {
    if (value === 'en' || value === 'ru') {
        return value;
    }

    return null;
};

const buildBotSettingsState = (payload: unknown): BotSettingsState => {
    const config = typeof payload === 'object' && payload !== null && 'config' in payload
        ? (payload as { config?: Record<string, unknown> }).config ?? {}
        : {};

    return {
        prefixCommandsEnabled: config.prefixCommandsEnabled === false ? false : true,
        commandChannelMode: normalizeChannelListMode(config.commandChannelMode),
        allowedTextChannels: parseJsonArray(config.allowedTextChannels),
        adminRoles: parseJsonArray(config.adminRoles),
        restoreRolesOnRejoin: Boolean(config.restoreRolesOnRejoin),
        restoreNicknameOnRejoin: Boolean(config.restoreNicknameOnRejoin),
        locale: normalizeLocale(config.locale),
        timezone: typeof config.timezone === 'string' && config.timezone.trim() ? config.timezone : null,
    };
};

const STRINGS = {
    en: {
        loading: 'Loading command settings...',
        failed: 'Failed to load command settings.',
        saved: 'Command settings saved successfully.',
        saveFailed: 'Failed to save command settings.',
        save: 'Save Changes',
        saving: 'Saving...',
        reset: 'Reset Changes',
    },
    ru: {
        loading: 'Загрузка настроек команд...',
        failed: 'Не удалось загрузить настройки команд.',
        saved: 'Настройки команд успешно сохранены.',
        saveFailed: 'Не удалось сохранить настройки команд.',
        save: 'Сохранить изменения',
        saving: 'Сохранение...',
        reset: 'Сбросить изменения',
    },
} as const;

export default function CommandsPage({ params }: { params: Promise<{ guildId: string }> }) {
    const { guildId } = React.use(params);
    const { locale } = useGuildLocale(guildId);
    const text = STRINGS[locale];

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [config, setConfig] = useState<ConfigState>(emptyConfig());
    const [botSettings, setBotSettings] = useState<BotSettingsState>(createDefaultBotSettings());
    const initialConfigRef = useRef<ConfigState | null>(null);
    const initialBotSettingsRef = useRef<BotSettingsState | null>(null);

    const commandChannelOptions = useMemo(() => {
        const categories = config.channels.filter((channel) => CATEGORY_CHANNEL_TYPES.has(channel.type ?? ''));
        const textChannels = config.channels.filter((channel) => TEXT_CHANNEL_TYPES.has(channel.type ?? ''));

        return buildChannelSelectOptions({
            channels: textChannels,
            categories,
            includeCategories: true,
        });
    }, [config.channels]);

    const loadData = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const [moderationResponse, botSettingsResponse] = await Promise.all([
                fetch(`/api/guilds/${guildId}/moderation/config`, { cache: 'no-store' }),
                fetch(`/api/guilds/${guildId}/bot-settings`, { cache: 'no-store' }),
            ]);

            if (!moderationResponse.ok || !botSettingsResponse.ok) {
                throw new Error(text.failed);
            }

            const [data, botSettingsData] = await Promise.all([
                moderationResponse.json(),
                botSettingsResponse.json(),
            ]);
            const loadedConfig = buildConfigStateFromResponse(data);
            const loadedBotSettings = buildBotSettingsState(botSettingsData);
            setConfig(loadedConfig);
            setBotSettings(loadedBotSettings);
            initialConfigRef.current = loadedConfig;
            initialBotSettingsRef.current = loadedBotSettings;
        } catch (loadError) {
            console.error(loadError);
            setError(text.failed);
        } finally {
            setLoading(false);
        }
    }, [guildId, text.failed]);

    useEffect(() => {
        void loadData();
    }, [loadData]);

    const isDirty = useMemo(() => {
        if (!initialConfigRef.current || !initialBotSettingsRef.current) return false;

        return JSON.stringify({
            config,
            botSettings,
        }) !== JSON.stringify({
            config: initialConfigRef.current,
            botSettings: initialBotSettingsRef.current,
        });
    }, [botSettings, config]);

    const tr = useCallback((ru: string, en: string) => (locale === 'ru' ? ru : en), [locale]);

    const handleSave = async () => {
        setSaving(true);
        setError(null);
        setNotice(null);

        try {
            const botSettingsPayload: Record<string, unknown> = {
                prefixCommandsEnabled: botSettings.prefixCommandsEnabled,
                commandChannelMode: botSettings.commandChannelMode,
                allowedTextChannels: botSettings.allowedTextChannels,
                adminRoles: botSettings.adminRoles,
                restoreRolesOnRejoin: botSettings.restoreRolesOnRejoin,
                restoreNicknameOnRejoin: botSettings.restoreNicknameOnRejoin,
            };

            if (botSettings.locale) {
                botSettingsPayload.locale = botSettings.locale;
            }

            if (botSettings.timezone) {
                botSettingsPayload.timezone = botSettings.timezone;
            }

            const [moderationResponse, botSettingsResponse] = await Promise.all([
                fetch(`/api/guilds/${guildId}/moderation/config`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(buildModerationSavePayload(config)),
                }),
                fetch(`/api/guilds/${guildId}/bot-settings`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(botSettingsPayload),
                }),
            ]);

            if (!moderationResponse.ok || !botSettingsResponse.ok) {
                throw new Error(text.saveFailed);
            }

            setNotice(text.saved);
            setTimeout(() => setNotice(null), 4000);
            await loadData();
        } catch (saveError) {
            console.error(saveError);
            setError(text.saveFailed);
        } finally {
            setSaving(false);
        }
    };

    const handleReset = () => {
        if (initialConfigRef.current) {
            setConfig(initialConfigRef.current);
        }
        if (initialBotSettingsRef.current) {
            setBotSettings(initialBotSettingsRef.current);
        }
    };

    if (loading) {
        return (
            <div className="flex h-[400px] w-full animate-pulse flex-col items-center justify-center gap-4">
                <Keyboard size={48} className="text-[var(--color-primary-1)] opacity-50" />
                <p className="text-sm font-semibold tracking-wide text-[var(--text-muted)]">{text.loading}</p>
            </div>
        );
    }

    return (
        <div className="relative mx-auto flex w-full max-w-[1500px] flex-col gap-6 animate-fade-in pb-32 pt-6">
            <div className="px-2 md:px-6">
                <AnimatedCard
                    title={tr('Каналы для команд', 'Command channels')}
                    subtitle={
                        botSettings.allowedTextChannels.length
                            ? botSettings.commandChannelMode === 'whitelist'
                                ? tr('Команды будут доступны только в выбранных каналах и категориях.', 'Commands will be available only in the selected channels and categories.')
                                : tr('Команды будут заблокированы в выбранных каналах и категориях.', 'Commands will be blocked in the selected channels and categories.')
                            : tr('Глобальных ограничений по каналам нет.', 'No global channel restrictions are active.')
                    }
                    className="overflow-visible"
                >
                    <div className="space-y-5">
                        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                            <div className="flex items-start gap-4">
                                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border ${botSettings.commandChannelMode === 'whitelist' ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300' : 'border-rose-500/25 bg-rose-500/10 text-rose-300'}`}>
                                    {botSettings.commandChannelMode === 'whitelist' ? <CheckCircle size={22} weight="duotone" /> : <Prohibit size={22} weight="duotone" />}
                                </div>
                                <div className="space-y-2">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <h3 className="text-sm font-bold text-white/90">{tr('Глобальный список каналов', 'Global channel list')}</h3>
                                        <Badge variant={botSettings.commandChannelMode === 'whitelist' ? 'success' : 'danger'}>
                                            {botSettings.commandChannelMode === 'whitelist' ? tr('Белый список', 'Whitelist') : tr('Чёрный список', 'Blacklist')}
                                        </Badge>
                                    </div>
                                    <p className="max-w-2xl text-xs text-white/50">
                                        {tr('Эта настройка применяется ко всем командам сразу и работает поверх индивидуальных ограничений в карточках ниже.', 'This setting applies to all commands at once and works on top of the per-command restrictions below.')}
                                    </p>
                                </div>
                            </div>

                            <div className="inline-flex items-center rounded-2xl border border-white/10 bg-black/30 p-1 shadow-inner">
                                <button
                                    type="button"
                                    onClick={() => setBotSettings((current) => ({ ...current, commandChannelMode: 'whitelist' }))}
                                    className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-colors ${botSettings.commandChannelMode === 'whitelist' ? 'bg-emerald-500/15 text-emerald-300 shadow-[0_0_0_1px_rgba(52,211,153,0.45)]' : 'text-white/40 hover:text-white/80'}`}
                                >
                                    {tr('Белый список', 'Whitelist')}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setBotSettings((current) => ({ ...current, commandChannelMode: 'blacklist' }))}
                                    className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-colors ${botSettings.commandChannelMode === 'blacklist' ? 'bg-rose-500/15 text-rose-300 shadow-[0_0_0_1px_rgba(251,113,133,0.45)]' : 'text-white/40 hover:text-white/80'}`}
                                >
                                    {tr('Чёрный список', 'Blacklist')}
                                </button>
                            </div>
                        </div>

                        <MultiSelectField
                            label={tr('Выберите каналы и категории', 'Choose channels and categories')}
                            options={commandChannelOptions}
                            selected={botSettings.allowedTextChannels}
                            onChange={(allowedTextChannels) => setBotSettings((current) => ({ ...current, allowedTextChannels }))}
                            placeholder={tr('Начните вводить канал...', 'Start typing a channel...')}
                        />
                    </div>
                </AnimatedCard>
            </div>

            {notice ? (
                <div className="mx-2 inline-flex items-center gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-4 text-sm font-medium text-emerald-400 animate-slide-down md:mx-6">
                    <ShieldCheck size={20} weight="fill" />
                    {notice}
                </div>
            ) : null}

            {error ? (
                <div className="mx-2 inline-flex items-center gap-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-5 py-4 text-sm font-medium text-rose-400 animate-slide-down md:mx-6">
                    <WarningCircle size={20} weight="fill" />
                    {error}
                </div>
            ) : null}

            <div className="px-2 md:px-6">
                <CommandOverridesPanel
                    config={config}
                    setConfig={setConfig}
                    locale={locale}
                    tr={tr}
                    showModuleFilter
                    title={tr('Команды', 'Commands')}
                    subtitle={tr('Настройки ниже применяются ко всем application-командам и сохраняются в те же commandRules, что и во вкладке модерации.', 'These settings apply to all application commands and are saved into the same commandRules used by the moderation page.')}
                />
            </div>

            <FloatingSaveBar
                visible={isDirty}
                saving={saving}
                saveLabel={text.save}
                savingLabel={text.saving}
                resetLabel={text.reset}
                onSave={handleSave}
                onReset={handleReset}
                disableSave={!isDirty || saving}
                disableReset={saving}
            />
        </div>
    );
}
