'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Keyboard, CheckCircle, Prohibit, ShieldCheck, UserCircle, Translate, Clock, Gear } from "@phosphor-icons/react";
import { DEFAULT_LOCALE, LocaleCode, normalizeLocale, useGuildLocale } from "@/lib/i18n";
import { MultiSelectField } from "@/components/moderation/ui";
import { buildChannelSelectOptions } from "@/lib/channelSelectOptions";
import { FloatingSaveBar } from "@/components/common/FloatingSaveBar";

interface Role {
    id: string;
    name: string;
    color: string;
    position: number;
    permissions?: string;
    icon?: string | null;
}

interface Channel {
    id: string;
    name: string;
    type: string | number;
    position: number;
    parentId?: string | null;
}

const ADMIN_PERMISSION = BigInt(8);

const isAdminRole = (role: Role) => {
    if (!role.permissions) return false;
    try {
        return (BigInt(role.permissions) & ADMIN_PERMISSION) === ADMIN_PERMISSION;
    } catch {
        return false;
    }
};

const parseJsonArray = (value: unknown) => {
    if (Array.isArray(value)) {
        return value.filter((item) => typeof item === 'string');
    }
    if (typeof value !== 'string') return [];
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : [];
    } catch {
        return [];
    }
};

const normalizeChannelMode = (value: unknown) => {
    if (typeof value !== 'string') return 'blacklist';
    const lowered = value.toLowerCase();
    return lowered === 'whitelist' ? 'whitelist' : 'blacklist';
};

const TIMEZONE_OPTIONS = [
    { key: 'UTC', label: 'UTC (±0:00)' },
    { key: 'Europe/London', label: 'London (GMT/BST)' },
    { key: 'Europe/Berlin', label: 'Berlin (CET/CEST)' },
    { key: 'Europe/Kyiv', label: 'Kyiv (EET/EEST)' },
    { key: 'Europe/Moscow', label: 'Moscow (MSK)' },
    { key: 'Europe/Istanbul', label: 'Istanbul (TRT)' },
    { key: 'Asia/Dubai', label: 'Dubai (GST)' },
    { key: 'Asia/Kolkata', label: 'India (IST)' },
    { key: 'Asia/Shanghai', label: 'China (CST)' },
    { key: 'Asia/Tokyo', label: 'Tokyo (JST)' },
    { key: 'Australia/Sydney', label: 'Sydney (AEST)' },
    { key: 'Pacific/Auckland', label: 'Auckland (NZST)' },
    { key: 'America/New_York', label: 'New York (EST/EDT)' },
    { key: 'America/Chicago', label: 'Chicago (CST/CDT)' },
    { key: 'America/Denver', label: 'Denver (MST/MDT)' },
    { key: 'America/Los_Angeles', label: 'Los Angeles (PST/PDT)' },
    { key: 'America/Sao_Paulo', label: 'São Paulo (BRT)' },
];

const strings = {
    en: {
        pageTitle: 'Server settings',
        pageSubtitle: 'Configure guild-level options for this server.',
        errorLoadStatus: 'Failed to load settings data (status: {status}).',
        errorLoad: 'Failed to load server settings.',
        errorSaveStatus: 'Server settings API returned {status}.',
        errorSave: 'Failed to save server settings.',
        sectionPrefixTitle: 'Command Prefix',
        sectionPrefixDesc: 'Set the prefix for text commands',
        switchPrefixLabel: 'Prefix commands',
        prefixLabel: 'Prefix',
        prefixExample: 'Example: {prefix}help',
        prefixEnabled: 'Prefix commands are enabled for this server.',
        prefixDisabled: 'Prefix commands are disabled for this server.',
        sectionChannelsTitle: 'Command Channels',
        sectionChannelsDescNone: 'No channel restrictions are active.',
        sectionChannelsDescWhitelist: 'Commands are allowed only in selected channels.',
        sectionChannelsDescBlacklist: 'Commands are blocked in selected channels.',
        whitelist: 'Whitelist',
        blacklist: 'Blacklist',
        selectTextChannelsLabel: 'Select text channels',
        selectTextChannelsPlaceholder: 'Choose text channels',
        sectionAdminsTitle: 'Bot Administrators',
        sectionAdminsDesc: 'Server owners always have access.',
        selectAdminRolesLabel: 'Select admin roles',
        selectAdminRolesPlaceholder: 'Choose roles',
        sectionRejoinTitle: 'Rejoin Recovery',
        sectionRejoinDesc: 'Restore roles and nicknames when members rejoin.',
        restoreRolesTitle: 'Restore roles',
        restoreRolesDesc: 'Reapply saved roles on rejoin.',
        restoreNicknameTitle: 'Restore nickname',
        restoreNicknameDesc: 'Reapply the previous nickname on rejoin.',
        languageTitle: 'Bot language',
        languageDesc: 'Choose the bot language. Dashboard language is configured separately.',
        languageLabel: 'Bot language',
        languageNote: 'Affects bot replies only; dashboard language stays separate.',
        languageDashboardTitle: 'Dashboard language',
        languageDashboardDesc: 'Choose interface language for the dashboard.',
        languageDashboardLabel: 'Dashboard language',
        languageSyncPromptTitle: 'Switch dashboard language?',
        languageSyncPromptDesc: 'Bot language changed to {locale}. Apply it to the dashboard too?',
        languageSyncApply: 'Yes, switch dashboard',
        languageSyncSkip: 'Keep dashboard language',
        saveSettings: 'Save Settings',
        saving: 'Saving...',
        resetDefaults: 'Reset Defaults',
        timezoneTitle: 'Timezone',
        timezoneDesc: 'Set server timezone for statistics. Affects daily/hourly chart bucketing.',
        timezoneLabel: 'Select timezone',
    },
    ru: {
        pageTitle: 'Настройки сервера',
        pageSubtitle: 'Настройка параметров сервера.',
        errorLoadStatus: 'Не удалось загрузить данные настроек (статус: {status}).',
        errorLoad: 'Не удалось загрузить настройки сервера.',
        errorSaveStatus: 'API настроек сервера вернуло {status}.',
        errorSave: 'Не удалось сохранить настройки сервера.',
        sectionPrefixTitle: 'Префикс команд',
        sectionPrefixDesc: 'Укажите префикс для текстовых команд',
        switchPrefixLabel: 'Префикс-команды',
        prefixLabel: 'Префикс',
        prefixExample: 'Пример: {prefix}help',
        prefixEnabled: 'Префикс-команды включены для этого сервера.',
        prefixDisabled: 'Префикс-команды отключены для этого сервера.',
        sectionChannelsTitle: 'Каналы для команд',
        sectionChannelsDescNone: 'Ограничений по каналам нет.',
        sectionChannelsDescWhitelist: 'Команды разрешены только в выбранных каналах.',
        sectionChannelsDescBlacklist: 'Команды запрещены в выбранных каналах.',
        whitelist: 'Белый список',
        blacklist: 'Чёрный список',
        selectTextChannelsLabel: 'Выберите текстовые каналы',
        selectTextChannelsPlaceholder: 'Выберите каналы',
        sectionAdminsTitle: 'Администраторы бота',
        sectionAdminsDesc: 'Владельцы сервера всегда имеют доступ.',
        selectAdminRolesLabel: 'Выберите роли админов',
        selectAdminRolesPlaceholder: 'Выберите роли',
        sectionRejoinTitle: 'Восстановление при возврате',
        sectionRejoinDesc: 'Возвращайте роли и ник при повторном входе.',
        restoreRolesTitle: 'Восстановить роли',
        restoreRolesDesc: 'Повторно назначать сохранённые роли при входе.',
        restoreNicknameTitle: 'Восстановить ник',
        restoreNicknameDesc: 'Возвращать предыдущий ник при входе.',
        languageTitle: 'Язык бота',
        languageDesc: 'Выберите язык бота. Язык панели настраивается отдельно.',
        languageLabel: 'Язык бота',
        languageNote: 'Только для ответов бота; язык панели задаётся отдельно.',
        languageDashboardTitle: 'Язык панели',
        languageDashboardDesc: 'Выберите язык интерфейса панели.',
        languageDashboardLabel: 'Язык панели',
        languageSyncPromptTitle: 'Переключить язык панели?',
        languageSyncPromptDesc: 'Язык бота изменён на {locale}. Применить его к панели тоже?',
        languageSyncApply: 'Да, переключить панель',
        languageSyncSkip: 'Оставить язык панели',
        saveSettings: 'Сохранить настройки',
        saving: 'Сохранение...',
        resetDefaults: 'Сбросить по умолчанию',
        timezoneTitle: 'Часовой пояс',
        timezoneDesc: 'Часовой пояс сервера для статистики. Влияет на группировку данных по дням/часам.',
        timezoneLabel: 'Выберите часовой пояс',
    },
} as const;

const formatText = (template: string, vars?: Record<string, string | number>) => {
    if (!vars) return template;
    return template.replace(/\{(\w+)\}/g, (_, key) => String(vars[key] ?? ''));
};

const SwitchToggle = ({ isSelected, onValueChange, disabled, color = 'blue' }: { isSelected: boolean, onValueChange: (v: boolean) => void, disabled?: boolean, color?: 'blue' | 'amber' }) => {
    const bgColor = color === 'blue' ? 'bg-[#3b82f6]' : 'bg-amber-500';
    return (
        <button
            type="button"
            disabled={disabled}
            onClick={() => onValueChange(!isSelected)}
            className={`w-12 h-6 rounded-full transition-colors relative flex items-center px-1 border border-[var(--border-subtle)] focus:outline-none focus:ring-2 focus:ring-[#3b82f6]/50 shrink-0 ${isSelected ? bgColor : 'bg-[var(--surface-hover)]'} ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
            <div className={`w-4 h-4 rounded-full bg-white transition-transform flex-shrink-0 ${isSelected ? 'translate-x-[22px] shadow-[0_0_10px_rgba(255,255,255,0.5)]' : 'translate-x-0'}`} />
        </button>
    );
};

export default function ServerSettingsPage({ params }: { params: Promise<{ guildId: string }> }) {
    const { guildId } = React.use(params);
    const { locale, setLocale } = useGuildLocale(guildId);
    const [selectedLocale, setSelectedLocale] = useState<LocaleCode>(DEFAULT_LOCALE);
    const [syncPromptLocale, setSyncPromptLocale] = useState<LocaleCode | null>(null);
    const [roles, setRoles] = useState<Role[]>([]);
    const [textChannels, setTextChannels] = useState<Channel[]>([]);
    const [channelCategories, setChannelCategories] = useState<Channel[]>([]);
    const [prefix, setPrefix] = useState('!');
    const [prefixCommandsEnabled, setPrefixCommandsEnabled] = useState(true);
    const [channelMode, setChannelMode] = useState<'whitelist' | 'blacklist'>('blacklist');
    const [selectedTextChannels, setSelectedTextChannels] = useState<Set<string>>(new Set([]));
    const [adminRoles, setAdminRoles] = useState<Set<string>>(new Set([]));
    const [restoreRolesOnRejoin, setRestoreRolesOnRejoin] = useState(false);
    const [restoreNicknameOnRejoin, setRestoreNicknameOnRejoin] = useState(false);
    const [selectedTimezone, setSelectedTimezone] = useState('UTC');
    const [settingsLoading, setSettingsLoading] = useState(false);
    const [settingsError, setSettingsError] = useState<string | null>(null);
    const [settingsWarning, setSettingsWarning] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isDirty, setIsDirty] = useState(false);
    const [initialLoaded, setInitialLoaded] = useState(false);

    const text = strings[locale];
    const t = useCallback((key: keyof typeof strings.en, vars?: Record<string, string | number>) =>
        formatText(text[key], vars), [text]);

    const getDefaultAdminRoles = useCallback((items: Role[]) =>
        items
            .filter((role) => role.id !== guildId)
            .filter((role) => isAdminRole(role))
            .map((role) => role.id), [guildId]);

    const commandChannelOptions = buildChannelSelectOptions({
        channels: textChannels,
        categories: channelCategories,
        includeCategories: true,
    });

    useEffect(() => {
        if (!guildId) return;

        const loadSettings = async () => {
            setSettingsLoading(true);
            setSettingsError(null);
            setSettingsWarning(null);
            try {
                const [rolesRes, channelsRes, settingsRes] = await Promise.all([
                    fetch(`/api/guilds/${guildId}/roles`),
                    fetch(`/api/guilds/${guildId}/channel-tree`),
                    fetch(`/api/guilds/${guildId}/bot-settings`)
                ]);

                const rolesData = rolesRes.ok ? await rolesRes.json() : [];
                const channelsData = channelsRes.ok ? await channelsRes.json() : { text: [], categories: [] };
                const settingsData = settingsRes.ok ? await settingsRes.json() : null;

                if (!rolesRes.ok || !channelsRes.ok || !settingsRes.ok) {
                    const status = [rolesRes, channelsRes, settingsRes].map((res) => res.status).join(', ');
                    setSettingsError(t('errorLoadStatus', { status }));
                }
                setSettingsWarning(settingsData?.warning || null);

                const safeRoles = Array.isArray(rolesData) ? rolesData : [];
                const safeChannels = Array.isArray(channelsData?.text) ? channelsData.text : [];
                const safeCategories = Array.isArray(channelsData?.categories) ? channelsData.categories : [];

                setRoles(safeRoles);
                setTextChannels(safeChannels);
                setChannelCategories(safeCategories);

                const config = settingsData?.config;
                const guildPrefix = settingsData?.guild?.prefix ?? '!';
                const configLocale = normalizeLocale(config?.locale ?? DEFAULT_LOCALE);

                setPrefix(guildPrefix);
                setPrefixCommandsEnabled(config?.prefixCommandsEnabled ?? true);
                setChannelMode(normalizeChannelMode(config?.commandChannelMode));
                setSelectedTextChannels(new Set(parseJsonArray(config?.allowedTextChannels)));
                setRestoreRolesOnRejoin(Boolean(config?.restoreRolesOnRejoin));
                setRestoreNicknameOnRejoin(Boolean(config?.restoreNicknameOnRejoin));
                setSelectedLocale(configLocale);
                // Load timezone from config
                setSelectedTimezone(config?.timezone ?? 'UTC');

                const hasAdminRoles = config?.adminRoles !== null && config?.adminRoles !== undefined;
                const adminRolesFromConfig = hasAdminRoles ? parseJsonArray(config?.adminRoles) : null;
                const defaultAdminRoles = getDefaultAdminRoles(safeRoles);
                setAdminRoles(new Set(adminRolesFromConfig ?? defaultAdminRoles));
            } catch (error) {
                console.error('Failed to load server settings:', error);
                setSettingsError(t('errorLoad'));
            } finally {
                setSettingsLoading(false);
                setInitialLoaded(true);
                setIsDirty(false);
            }
        };

        loadSettings();
    }, [guildId, getDefaultAdminRoles, t]);

    useEffect(() => {
        if (initialLoaded) {
            setIsDirty(true);
        }
    }, [prefix, prefixCommandsEnabled, channelMode, selectedTextChannels, adminRoles, restoreRolesOnRejoin, restoreNicknameOnRejoin, selectedLocale, selectedTimezone, initialLoaded]);

    const handleSaveSettings = async () => {
        if (!guildId) return;
        setIsSaving(true);
        setSettingsError(null);
        try {
            const normalizedPrefix = prefix.trim() || '!';
            if (normalizedPrefix !== prefix) {
                setPrefix(normalizedPrefix);
            }

            const response = await fetch(`/api/guilds/${guildId}/bot-settings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prefix: normalizedPrefix,
                    prefixCommandsEnabled,
                    commandChannelMode: channelMode,
                    allowedTextChannels: Array.from(selectedTextChannels),
                    adminRoles: Array.from(adminRoles),
                    restoreRolesOnRejoin,
                    restoreNicknameOnRejoin,
                    locale: selectedLocale,
                    timezone: selectedTimezone,
                })
            });

            if (!response.ok) {
                const text = await response.text().catch(() => '');
                throw new Error(text || t('errorSaveStatus', { status: response.status }));
            }

            if (selectedLocale !== locale) {
                setSyncPromptLocale(selectedLocale);
            }
            setIsDirty(false);
        } catch (error) {
            console.error('Failed to save server settings:', error);
            setSettingsError(t('errorSave'));
        } finally {
            setIsSaving(false);
        }
    };

    const handleResetSettings = () => {
        setPrefix('!');
        setPrefixCommandsEnabled(true);
        setChannelMode('blacklist');
        setSelectedTextChannels(new Set([]));
        setAdminRoles(new Set(getDefaultAdminRoles(roles)));
        setRestoreRolesOnRejoin(false);
        setRestoreNicknameOnRejoin(false);
        setSelectedLocale(DEFAULT_LOCALE);
        setSelectedTimezone('UTC');
    };

    return (
        <div className="space-y-6 animate-fade-in pb-[200px] max-w-5xl mx-auto h-full flex flex-col pt-8 lg:pt-0">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-black tracking-tight text-white mb-1 leading-tight flex items-center gap-3">
                    <Gear size={32} weight="duotone" className="text-white/50" />
                    {text.pageTitle}
                </h1>
                <p className="text-[var(--text-muted)] text-sm">{text.pageSubtitle}</p>
            </div>

            {settingsError && (
                <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 font-bold px-6 py-4 rounded-xl shadow-sm text-sm flex items-center gap-3">
                    <Prohibit size={20} weight="duotone" /> {settingsError}
                </div>
            )}

            {settingsWarning && !settingsError && (
                <div className="bg-amber-500/10 border border-amber-500/20 text-amber-500 font-bold px-6 py-4 rounded-xl shadow-sm text-sm flex items-center gap-3">
                    <Prohibit size={20} weight="duotone" /> {settingsWarning}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

                {/* Left Column: General & Admins */}
                <div className="space-y-6">
                    {/* 1. General Settings (Prefix + Language + Timezone) */}
                    <div className="bg-[var(--surface-card)] border border-[var(--border-subtle)] shadow-sm rounded-[24px] overflow-hidden group hover:border-[#3b82f6]/30 transition-colors h-full flex flex-col">
                        <div className="p-6 border-b border-[var(--border-divider)] bg-[var(--surface-hover)] shrink-0 flex items-center gap-4">
                            <div className="w-10 h-10 shrink-0 aspect-square rounded-xl bg-[#3b82f6]/10 flex items-center justify-center text-[#3b82f6] shadow-sm border border-[#3b82f6]/20">
                                <Keyboard size={20} weight="duotone" />
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-white mb-0.5 leading-tight">{text.sectionPrefixTitle} & Setup</h3>
                                <p className="text-xs font-medium text-[var(--text-muted)]">Core operations configuration.</p>
                            </div>
                        </div>

                        <div className="p-6 space-y-6 flex-1 flex flex-col">
                            {/* Prefix Sub-Section */}
                            <div className="space-y-3">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <h4 className="text-sm font-bold text-white mb-0.5">{text.sectionPrefixDesc}</h4>
                                        <p className="text-[10px] text-[var(--text-muted)] mb-2 uppercase tracking-widest">{t('prefixExample', { prefix: prefix.trim() || '!' })}</p>
                                    </div>
                                    <SwitchToggle isSelected={prefixCommandsEnabled} onValueChange={setPrefixCommandsEnabled} disabled={settingsLoading} />
                                </div>
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={prefix}
                                        onChange={(e) => setPrefix(e.target.value)}
                                        maxLength={5}
                                        disabled={settingsLoading}
                                        placeholder="!"
                                        className="w-full bg-[var(--surface-hover)] border border-[var(--border-subtle)] focus:border-[#3b82f6] rounded-xl h-12 px-4 text-lg font-bold text-center font-mono text-white placeholder-[var(--text-muted)] outline-none transition-colors disabled:opacity-50"
                                    />
                                </div>
                            </div>

                            <div className="w-full h-px bg-[var(--border-divider)]" />

                            {/* Language Sub-Section */}
                            <div className="space-y-3">
                                <div className="flex items-center gap-3 mb-1">
                                    <Translate size={18} weight="duotone" className="text-[#3b82f6] opacity-70" />
                                    <h4 className="text-sm font-bold text-white">{text.languageTitle}</h4>
                                </div>
                                <div className="relative">
                                    <select
                                        value={selectedLocale}
                                        onChange={(e) => {
                                            const val = e.target.value as LocaleCode;
                                            if (val === 'ru' || val === 'en') setSelectedLocale(val);
                                        }}
                                        disabled={settingsLoading}
                                        className="w-full bg-[var(--surface-hover)] border border-[var(--border-subtle)] focus:border-[#3b82f6] rounded-xl h-12 pl-4 pr-10 text-sm font-bold text-white outline-none transition-colors appearance-none cursor-pointer disabled:opacity-50"
                                    >
                                        <option value="en" className="bg-[#111]">English</option>
                                        <option value="ru" className="bg-[#111]">Русский</option>
                                    </select>
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none opacity-50 flex gap-2">
                                        <div className="w-5 h-4 bg-cover bg-center rounded-sm" style={{ backgroundImage: `url(${selectedLocale === 'ru' ? '/icons/free_russia_flag.png' : '/icons/uk_flag.png'})` }} />
                                    </div>
                                </div>
                            </div>

                            <div className="w-full h-px bg-[var(--border-divider)]" />

                            {/* Timezone Sub-Section */}
                            <div className="space-y-3">
                                <div className="flex items-center gap-3 mb-1">
                                    <Clock size={18} weight="duotone" className="text-[#3b82f6] opacity-70" />
                                    <h4 className="text-sm font-bold text-white">{text.timezoneTitle}</h4>
                                </div>
                                <div className="relative">
                                    <select
                                        value={selectedTimezone}
                                        onChange={(e) => setSelectedTimezone(e.target.value)}
                                        disabled={settingsLoading}
                                        className="w-full bg-[var(--surface-hover)] border border-[var(--border-subtle)] focus:border-[#3b82f6] rounded-xl h-12 pl-4 pr-10 text-sm font-bold text-white outline-none transition-colors appearance-none cursor-pointer disabled:opacity-50"
                                    >
                                        {TIMEZONE_OPTIONS.map(tz => (
                                            <option key={tz.key} value={tz.key} className="bg-[#111]">{tz.label}</option>
                                        ))}
                                    </select>
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none opacity-50 flex gap-2">
                                        <Clock size={16} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 3. Admins Section */}
                    <div className="bg-[var(--surface-card)] border border-[var(--border-subtle)] shadow-sm rounded-[24px] overflow-visible group hover:border-[#10b981]/30 transition-colors h-full flex flex-col items-start pb-6 z-20">
                        <div className="p-6 border-b border-[var(--border-divider)] bg-[var(--surface-hover)] shrink-0 flex w-full items-center gap-4 rounded-t-[24px]">
                            <div className="w-10 h-10 shrink-0 aspect-square rounded-xl bg-[#10b981]/10 flex items-center justify-center text-[#10b981] shadow-sm border border-[#10b981]/20">
                                <ShieldCheck size={20} weight="duotone" />
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-white mb-0.5 leading-tight">{text.sectionAdminsTitle}</h3>
                                <p className="text-[11px] font-medium text-[var(--text-muted)] truncate max-w-[250px]">{text.sectionAdminsDesc}</p>
                            </div>
                        </div>

                        <div className={`px-6 pt-6 w-full space-y-4 ${settingsLoading ? 'opacity-50 pointer-events-none' : ''}`}>
                            <MultiSelectField
                                label={text.selectAdminRolesLabel}
                                options={roles}
                                selected={Array.from(adminRoles)}
                                onChange={(keys) => setAdminRoles(new Set(keys))}
                                placeholder={text.selectAdminRolesPlaceholder}
                            />
                        </div>
                    </div>
                </div>

                {/* Right Column: Recovery & Channels */}
                <div className="space-y-6">
                    {/* 2. Recovery Settings */}
                    <div className="bg-[var(--surface-card)] border border-[var(--border-subtle)] shadow-sm rounded-[24px] overflow-hidden group hover:border-amber-500/30 transition-colors h-fit mb-6">
                        <div className="p-6 border-b border-[var(--border-divider)] bg-[var(--surface-hover)] shrink-0 flex items-center gap-4">
                            <div className="w-10 h-10 shrink-0 aspect-square rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500 shadow-sm border border-amber-500/20">
                                <UserCircle size={20} weight="duotone" />
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-white mb-0.5 leading-tight">{text.sectionRejoinTitle}</h3>
                                <p className="text-[11px] font-medium text-[var(--text-muted)] truncate max-w-[250px]">{text.sectionRejoinDesc}</p>
                            </div>
                        </div>

                        <div className="p-6 space-y-4">
                            <div className="flex items-center justify-between p-4 rounded-xl bg-[var(--surface-hover)] border border-[var(--border-divider)] transition-colors hover:border-[var(--border-subtle)]">
                                <div>
                                    <p className="font-bold text-white text-sm mb-0.5">{text.restoreRolesTitle}</p>
                                    <p className="text-[11px] text-[var(--text-muted)]">{text.restoreRolesDesc}</p>
                                </div>
                                <SwitchToggle isSelected={restoreRolesOnRejoin} onValueChange={setRestoreRolesOnRejoin} disabled={settingsLoading} color="amber" />
                            </div>
                            <div className="flex items-center justify-between p-4 rounded-xl bg-[var(--surface-hover)] border border-[var(--border-divider)] transition-colors hover:border-[var(--border-subtle)]">
                                <div>
                                    <p className="font-bold text-white text-sm mb-0.5">{text.restoreNicknameTitle}</p>
                                    <p className="text-[11px] text-[var(--text-muted)]">{text.restoreNicknameDesc}</p>
                                </div>
                                <SwitchToggle isSelected={restoreNicknameOnRejoin} onValueChange={setRestoreNicknameOnRejoin} disabled={settingsLoading} color="amber" />
                            </div>
                        </div>
                    </div>

                    {/* 4. Channels Section */}
                    <div className="bg-[var(--surface-card)] border border-[var(--border-subtle)] shadow-sm rounded-[24px] overflow-visible group hover:border-rose-500/30 transition-colors h-full flex flex-col pb-6 z-10">
                        <div className="p-6 border-b border-[var(--border-divider)] bg-[var(--surface-hover)] shrink-0 flex w-full items-center justify-between gap-4 flex-wrap rounded-t-[24px]">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 shrink-0 aspect-square rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-500 shadow-sm border border-rose-500/20">
                                    {channelMode === 'whitelist' ? <CheckCircle size={20} weight="duotone" className="text-[#10b981]" /> : <Prohibit size={20} weight="duotone" />}
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-white mb-0.5 leading-tight">{text.sectionChannelsTitle}</h3>
                                    <p className="text-[11px] font-medium text-[var(--text-muted)] max-w-[200px] truncate">
                                        {selectedTextChannels.size === 0
                                            ? text.sectionChannelsDescNone
                                            : channelMode === 'whitelist'
                                                ? text.sectionChannelsDescWhitelist
                                                : text.sectionChannelsDescBlacklist}
                                    </p>
                                </div>
                            </div>
                            <div className="flex bg-[var(--surface-card)] p-1 rounded-xl border border-[var(--border-subtle)] mt-2 sm:mt-0">
                                <button
                                    onClick={() => setChannelMode('whitelist')}
                                    disabled={settingsLoading}
                                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${channelMode === 'whitelist' ? 'bg-[#10b981]/20 text-[#10b981]' : 'text-[var(--text-muted)] hover:text-white'}`}
                                >
                                    {text.whitelist}
                                </button>
                                <button
                                    onClick={() => setChannelMode('blacklist')}
                                    disabled={settingsLoading}
                                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${channelMode === 'blacklist' ? 'bg-rose-500/20 text-rose-500' : 'text-[var(--text-muted)] hover:text-white'}`}
                                >
                                    {text.blacklist}
                                </button>
                            </div>
                        </div>

                        <div className={`px-6 pt-6 w-full space-y-4 relative flex-1 ${settingsLoading ? 'opacity-50 pointer-events-none' : ''}`}>
                            <MultiSelectField
                                label={text.selectTextChannelsLabel}
                                options={commandChannelOptions}
                                selected={Array.from(selectedTextChannels)}
                                onChange={(keys) => setSelectedTextChannels(new Set(keys))}
                                placeholder={text.selectTextChannelsPlaceholder}
                            />
                        </div>
                    </div>
                </div>

            </div>

            <FloatingSaveBar
                visible={isDirty}
                saving={isSaving}
                saveLabel={text.saveSettings}
                savingLabel={text.saving}
                resetLabel={text.resetDefaults}
                onSave={handleSaveSettings}
                onReset={handleResetSettings}
                disableSave={!isDirty || settingsLoading || isSaving}
                disableReset={settingsLoading || isSaving}
            />


            {/* Language Sync Prompt Modal */}
            {syncPromptLocale && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-[var(--surface-modal)] border border-[var(--border-subtle)] w-full max-w-md rounded-[32px] overflow-hidden shadow-2xl flex flex-col">
                        <div className="p-6 pb-2">
                            <h2 className="text-xl font-bold text-white mb-2">{text.languageSyncPromptTitle}</h2>
                            <p className="text-sm text-[var(--text-muted)]">
                                {t('languageSyncPromptDesc', { locale: syncPromptLocale === 'ru' ? 'Русский' : 'English' })}
                            </p>
                        </div>
                        <div className="p-6 pt-4 flex justify-end gap-3 border-t border-[var(--border-divider)] bg-[var(--surface-hover)] mt-4">
                            <button
                                onClick={() => setSyncPromptLocale(null)}
                                className="h-10 px-4 rounded-xl font-bold text-sm text-[var(--text-secondary)] bg-transparent hover:bg-[var(--surface-card)] transition-colors border border-transparent"
                            >
                                {text.languageSyncSkip}
                            </button>
                            <button
                                onClick={() => {
                                    setLocale(syncPromptLocale);
                                    setSyncPromptLocale(null);
                                }}
                                className="h-10 px-5 rounded-xl font-bold text-sm text-white bg-[#3b82f6] hover:bg-[#2563eb] transition-colors shadow-sm"
                            >
                                {text.languageSyncApply}
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}
