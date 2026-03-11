'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardBody, Button, Input, Switch, Select, SelectItem, SelectedItems, ButtonGroup, Checkbox, Chip, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Divider } from "@nextui-org/react";
import { Keyboard, CheckCircle, Prohibit, ShieldCheck, UserCircle, Translate, ArrowClockwise, Clock } from "@phosphor-icons/react";
import { DEFAULT_LOCALE, LocaleCode, normalizeLocale, useGuildLocale } from "@/lib/i18n";

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

const hexToRgba = (hex: string, alpha: number) => {
    if (!hex || hex === '#000000') return `rgba(63, 63, 70, ${alpha})`;
    const cleanHex = hex.startsWith('#') ? hex.slice(1) : hex;
    if (cleanHex.length !== 6) return `rgba(63, 63, 70, ${alpha})`;

    const r = parseInt(cleanHex.substr(0, 2), 16);
    const g = parseInt(cleanHex.substr(2, 2), 16);
    const b = parseInt(cleanHex.substr(4, 2), 16);

    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const getTextColor = (hex: string) => {
    if (!hex || hex === '#000000') return 'text-white';
    const cleanHex = hex.startsWith('#') ? hex.slice(1) : hex;
    if (cleanHex.length !== 6) return 'text-white';

    const r = parseInt(cleanHex.substr(0, 2), 16);
    const g = parseInt(cleanHex.substr(2, 2), 16);
    const b = parseInt(cleanHex.substr(4, 2), 16);
    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    return yiq >= 128 ? 'text-black' : 'text-white';
};

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
    return template.replace(/\{(\\w+)\}/g, (_, key) => String(vars[key] ?? ''));
};

export default function ServerSettingsPage({ params }: { params: Promise<{ guildId: string }> }) {
    const { guildId } = React.use(params);
    const { locale, setLocale } = useGuildLocale(guildId);
    const [selectedLocale, setSelectedLocale] = useState<LocaleCode>(DEFAULT_LOCALE);
    const [syncPromptLocale, setSyncPromptLocale] = useState<LocaleCode | null>(null);
    const [roles, setRoles] = useState<Role[]>([]);
    const [textChannels, setTextChannels] = useState<Channel[]>([]);
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
    const t = (key: keyof typeof strings.en, vars?: Record<string, string | number>) =>
        formatText(text[key], vars);

    const getDefaultAdminRoles = (items: Role[]) =>
        items
            .filter((role) => role.id !== guildId)
            .filter((role) => isAdminRole(role))
            .map((role) => role.id);

    useEffect(() => {
        if (!guildId) return;

        const loadSettings = async () => {
            setSettingsLoading(true);
            setSettingsError(null);
            setSettingsWarning(null);
            try {
                const [rolesRes, channelsRes, settingsRes] = await Promise.all([
                    fetch(`/api/guilds/${guildId}/roles`),
                    fetch(`/api/guilds/${guildId}/text-channels`),
                    fetch(`/api/guilds/${guildId}/bot-settings`)
                ]);

                const rolesData = rolesRes.ok ? await rolesRes.json() : [];
                const channelsData = channelsRes.ok ? await channelsRes.json() : [];
                const settingsData = settingsRes.ok ? await settingsRes.json() : null;

                if (!rolesRes.ok || !channelsRes.ok || !settingsRes.ok) {
                    const status = [rolesRes, channelsRes, settingsRes].map((res) => res.status).join(', ');
                    setSettingsError(t('errorLoadStatus', { status }));
                }
                setSettingsWarning(settingsData?.warning || null);

                const safeRoles = Array.isArray(rolesData) ? rolesData : [];
                const safeChannels = Array.isArray(channelsData) ? channelsData : [];

                setRoles(safeRoles);
                setTextChannels(safeChannels);

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
    }, [guildId]);

    useEffect(() => {
        if (initialLoaded) {
            setIsDirty(true);
        }
    }, [prefix, prefixCommandsEnabled, channelMode, selectedTextChannels, adminRoles, restoreRolesOnRejoin, restoreNicknameOnRejoin, selectedLocale, selectedTimezone]);

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
        <div className="space-y-8 animate-fade-in pb-10">
            {/* Header */}
            <div>
                <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent mb-2">
                    {text.pageTitle}
                </h1>
                <p className="text-default-400 text-lg">{text.pageSubtitle}</p>
            </div>

            {settingsError && (
                <Card className="bg-danger-500/10 border-danger-500/20 border shadow-lg rounded-[24px]">
                    <CardBody className="text-danger-400 font-medium px-6 py-4">{settingsError}</CardBody>
                </Card>
            )}

            {settingsWarning && !settingsError && (
                <Card className="bg-warning-500/10 border-warning-500/20 border shadow-lg rounded-[24px]">
                    <CardBody className="text-warning-400 font-medium px-6 py-4">{settingsWarning}</CardBody>
                </Card>
            )}

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">

                {/* 1. General Settings (Prefix + Language) */}
                <Card className="bg-[#181A20] border border-white/5 shadow-xl rounded-[32px] overflow-visible group hover:border-white/10 transition-colors h-full">
                    <CardBody className="p-8 space-y-8">
                        {/* Prefix Section */}
                        <div className="space-y-6">
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-inner-lg">
                                        <Keyboard size={24} weight="fill" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-white mb-1">{text.sectionPrefixTitle}</h3>
                                        <p className="text-default-500 text-sm">{text.sectionPrefixDesc}</p>
                                    </div>
                                </div>
                                <Switch
                                    isSelected={prefixCommandsEnabled}
                                    onValueChange={setPrefixCommandsEnabled}
                                    color="primary"
                                    size="lg"
                                    isDisabled={settingsLoading}
                                    classNames={{ wrapper: "group-data-[selected=true]:bg-primary" }}
                                />
                            </div>

                            <div className="bg-[#0A0B0E] rounded-3xl p-2 border border-white/5 focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/50 transition-all">
                                <Input
                                    label={text.prefixLabel}
                                    placeholder="!"
                                    value={prefix}
                                    onValueChange={setPrefix}
                                    maxLength={5}
                                    classNames={{
                                        inputWrapper: "bg-transparent shadow-none hover:bg-transparent group-data-[focus=true]:bg-transparent",
                                        input: "text-2xl font-bold text-center font-mono",
                                        label: "hidden"
                                    }}
                                    isDisabled={settingsLoading}
                                />
                            </div>
                            <p className="text-center text-default-500 text-sm font-medium">
                                {t('prefixExample', { prefix: prefix.trim() || '!' })}
                            </p>
                        </div>

                        <Divider className="bg-white/5" />

                        {/* Language Section */}
                        <div className="space-y-6">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-500 shadow-inner-lg">
                                    <Translate size={24} weight="fill" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-white mb-1">{text.languageTitle}</h3>
                                    <p className="text-default-500 text-sm">{text.languageDesc}</p>
                                </div>
                            </div>

                            <Select
                                aria-label={text.languageLabel}
                                selectedKeys={new Set([selectedLocale])}
                                onSelectionChange={(keys) => {
                                    const [value] = Array.from(keys) as string[];
                                    if (value === 'ru' || value === 'en') {
                                        setSelectedLocale(value);
                                    }
                                }}
                                isDisabled={settingsLoading}
                                classNames={{
                                    trigger: "bg-[#0A0B0E] border border-white/5 min-h-[64px] rounded-2xl data-[hover=true]:bg-[#0A0B0E] data-[hover=true]:border-white/10 transition-all",
                                    value: "text-lg font-medium pl-2",
                                    popoverContent: "bg-[#181A20] border border-white/10 rounded-2xl shadow-2xl",
                                    listbox: "bg-transparent p-2 gap-1"
                                }}
                                renderValue={(items) => items.map(item => {
                                    const label = item.key === 'ru' ? 'Русский' : 'English';
                                    const flag = item.key === 'ru' ? "/icons/free_russia_flag.png" : "/icons/uk_flag.png";
                                    return (
                                        <div key={item.key} className="flex items-center gap-3">
                                            <img src={flag} className="w-8 h-8 rounded-lg object-cover" alt="" />
                                            <span className="text-white">{label}</span>
                                        </div>
                                    );
                                })}
                            >
                                <SelectItem key="ru" textValue="Русский" className="rounded-xl data-[hover=true]:bg-white/5">
                                    <div className="flex items-center gap-3">
                                        <img src="/icons/free_russia_flag.png" className="w-6 h-6 rounded-md object-cover" alt="RU" />
                                        <span className="text-base font-medium">Русский</span>
                                    </div>
                                </SelectItem>
                                <SelectItem key="en" textValue="English" className="rounded-xl data-[hover=true]:bg-white/5">
                                    <div className="flex items-center gap-3">
                                        <img src="/icons/uk_flag.png" className="w-6 h-6 rounded-md object-cover" alt="EN" />
                                        <span className="text-base font-medium">English</span>
                                    </div>
                                </SelectItem>
                            </Select>
                        </div>

                        <Divider className="bg-white/5" />

                        {/* Timezone Section */}
                        <div className="space-y-6">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-teal-500/10 flex items-center justify-center text-teal-500 shadow-inner-lg">
                                    <Clock size={24} weight="fill" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-white mb-1">{text.timezoneTitle}</h3>
                                    <p className="text-default-500 text-sm">{text.timezoneDesc}</p>
                                </div>
                            </div>

                            <Select
                                aria-label={text.timezoneLabel}
                                selectedKeys={new Set([selectedTimezone])}
                                onSelectionChange={(keys) => {
                                    const [value] = Array.from(keys) as string[];
                                    if (value) setSelectedTimezone(value);
                                }}
                                isDisabled={settingsLoading}
                                classNames={{
                                    trigger: "bg-[#0A0B0E] border border-white/5 min-h-[64px] rounded-2xl data-[hover=true]:bg-[#0A0B0E] data-[hover=true]:border-white/10 transition-all",
                                    value: "text-lg font-medium pl-2",
                                    popoverContent: "bg-[#181A20] border border-white/10 rounded-2xl shadow-2xl max-h-[300px]",
                                    listbox: "bg-transparent p-2 gap-1"
                                }}
                                renderValue={(items) => items.map(item => {
                                    const option = TIMEZONE_OPTIONS.find(o => o.key === item.key);
                                    return (
                                        <div key={item.key} className="flex items-center gap-3">
                                            <Clock size={20} weight="fill" className="text-teal-500" />
                                            <span className="text-white">{option?.label || item.key}</span>
                                        </div>
                                    );
                                })}
                            >
                                {TIMEZONE_OPTIONS.map(tz => (
                                    <SelectItem key={tz.key} textValue={tz.label} className="rounded-xl data-[hover=true]:bg-white/5">
                                        <div className="flex items-center gap-3">
                                            <Clock size={16} weight="regular" className="text-default-400" />
                                            <span className="text-base font-medium">{tz.label}</span>
                                        </div>
                                    </SelectItem>
                                ))}
                            </Select>
                        </div>
                    </CardBody>
                </Card>

                {/* 2. Recovery Settings */}
                <Card className="bg-[#181A20] border border-white/5 shadow-xl rounded-[32px] overflow-visible group hover:border-white/10 transition-colors h-full">
                    <CardBody className="p-8">
                        <div className="flex items-center gap-4 mb-8">
                            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500 shadow-inner-lg group-hover:scale-110 transition-transform duration-500">
                                <UserCircle size={28} weight="fill" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-white mb-1">{text.sectionRejoinTitle}</h3>
                                <p className="text-default-500 text-sm">{text.sectionRejoinDesc}</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-4">
                            <div className="flex items-center justify-between p-5 rounded-3xl bg-[#0A0B0E] border border-white/5 transition-colors hover:border-white/10 group/item">
                                <div>
                                    <p className="font-bold text-white text-lg mb-1">{text.restoreRolesTitle}</p>
                                    <p className="text-sm text-default-500">{text.restoreRolesDesc}</p>
                                </div>
                                <Switch
                                    isSelected={restoreRolesOnRejoin}
                                    onValueChange={setRestoreRolesOnRejoin}
                                    color="warning"
                                    isDisabled={settingsLoading}
                                    classNames={{ wrapper: "group-data-[selected=true]:bg-amber-500" }}
                                />
                            </div>
                            <div className="flex items-center justify-between p-5 rounded-3xl bg-[#0A0B0E] border border-white/5 transition-colors hover:border-white/10 group/item">
                                <div>
                                    <p className="font-bold text-white text-lg mb-1">{text.restoreNicknameTitle}</p>
                                    <p className="text-sm text-default-500">{text.restoreNicknameDesc}</p>
                                </div>
                                <Switch
                                    isSelected={restoreNicknameOnRejoin}
                                    onValueChange={setRestoreNicknameOnRejoin}
                                    color="warning"
                                    isDisabled={settingsLoading}
                                    classNames={{ wrapper: "group-data-[selected=true]:bg-amber-500" }}
                                />
                            </div>
                        </div>
                    </CardBody>
                </Card>

                {/* 3. Admins Section */}
                <Card className="bg-[#181A20] border border-white/5 shadow-xl rounded-[32px] overflow-visible group hover:border-white/10 transition-colors h-full">
                    <CardBody className="p-8">
                        <div className="flex items-center gap-4 mb-8">
                            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 shadow-inner-lg group-hover:scale-110 transition-transform duration-500">
                                <ShieldCheck size={28} weight="fill" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-white mb-1">{text.sectionAdminsTitle}</h3>
                                <p className="text-default-500 text-sm">{text.sectionAdminsDesc}</p>
                            </div>
                        </div>

                        <Select
                            aria-label={text.selectAdminRolesLabel}
                            items={roles}
                            variant="faded"
                            isMultiline={true}
                            selectionMode="multiple"
                            placeholder={text.selectAdminRolesPlaceholder}
                            selectedKeys={adminRoles}
                            onSelectionChange={(keys) => setAdminRoles(keys as Set<string>)}
                            isDisabled={settingsLoading}
                            classNames={{
                                trigger: "bg-[#0A0B0E] border border-white/5 min-h-[120px] rounded-2xl data-[hover=true]:bg-[#0A0B0E] data-[hover=true]:border-white/10 transition-all p-4 items-start",
                                value: "text-lg font-medium",
                                popoverContent: "bg-[#181A20] border border-white/10 rounded-2xl shadow-2xl",
                                listbox: "bg-transparent p-2 gap-1",
                                innerWrapper: "pt-1"
                            }}
                            listboxProps={{
                                itemClasses: { base: "py-2 px-2 min-h-[48px] rounded-xl data-[hover=true]:bg-white/5 text-default-500 data-[selected=true]:bg-white/10" },
                            }}
                            renderValue={(items: SelectedItems<Role>) => (
                                <div className="flex flex-wrap gap-2 w-full">
                                    {items.map((item) => {
                                        const roleColor = item.data?.color && item.data.color !== '#000000' ? item.data.color : '#3f3f46';
                                        return (
                                            <Chip
                                                key={item.key}
                                                variant="flat"
                                                style={{ backgroundColor: hexToRgba(roleColor, 0.2), color: roleColor }}
                                                className="border border-white/5 h-8"
                                            >
                                                <div className="flex items-center gap-1.5 font-bold">
                                                    {item.data?.icon && <span>{item.data.icon}</span>}
                                                    <span>{item.data?.name}</span>
                                                </div>
                                            </Chip>
                                        );
                                    })}
                                </div>
                            )}
                        >
                            {(role) => {
                                const hasColor = role.color && role.color !== '#000000';
                                const textBorderColor = hasColor ? role.color : '#a1a1aa';
                                const bgColor = hasColor ? role.color : '#52525b';
                                const isSelected = adminRoles.has(role.id);

                                return (
                                    <SelectItem key={role.id} textValue={role.name}>
                                        <div className="flex items-center gap-3 w-full">
                                            <Checkbox isSelected={isSelected} color="success" disableAnimation classNames={{ wrapper: "before:border-white/30" }} />
                                            <div
                                                className="flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-gradient-to-r from-white/5 to-transparent flex-1"
                                                style={{ borderColor: hexToRgba(bgColor, 0.3) }}
                                            >
                                                {role.icon && <span className="text-lg">{role.icon}</span>}
                                                <span className="text-base font-bold" style={{ color: textBorderColor }}>{role.name}</span>
                                            </div>
                                        </div>
                                    </SelectItem>
                                );
                            }}
                        </Select>
                    </CardBody>
                </Card>

                {/* 4. Channels Section */}
                <Card className="bg-[#181A20] border border-white/5 shadow-xl rounded-[32px] overflow-visible group hover:border-white/10 transition-colors h-full">
                    <CardBody className="p-8">
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6 mb-8">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-purple-500/10 flex items-center justify-center text-purple-500 shadow-inner-lg group-hover:scale-110 transition-transform duration-500">
                                    {channelMode === 'whitelist' ? <CheckCircle size={24} weight="fill" /> : <Prohibit size={24} weight="fill" />}
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-white mb-1">{text.sectionChannelsTitle}</h3>
                                    <p className="text-default-500 text-sm max-w-[200px]">
                                        {selectedTextChannels.size === 0
                                            ? text.sectionChannelsDescNone
                                            : channelMode === 'whitelist'
                                                ? text.sectionChannelsDescWhitelist
                                                : text.sectionChannelsDescBlacklist}
                                    </p>
                                </div>
                            </div>
                            <div className="flex bg-[#0A0B0E] p-1.5 rounded-2xl border border-white/5">
                                <Button
                                    size="sm"
                                    className={`rounded-xl font-bold transition-all ${channelMode === 'whitelist' ? 'bg-emerald-500/20 text-emerald-400 shadow-lg' : 'bg-transparent text-default-500'}`}
                                    onPress={() => setChannelMode('whitelist')}
                                    isDisabled={settingsLoading}
                                >
                                    {text.whitelist}
                                </Button>
                                <Button
                                    size="sm"
                                    className={`rounded-xl font-bold transition-all ${channelMode === 'blacklist' ? 'bg-rose-500/20 text-rose-400 shadow-lg' : 'bg-transparent text-default-500'}`}
                                    onPress={() => setChannelMode('blacklist')}
                                    isDisabled={settingsLoading}
                                >
                                    {text.blacklist}
                                </Button>
                            </div>
                        </div>

                        <Select
                            aria-label={text.selectTextChannelsLabel}
                            items={textChannels}
                            variant="faded"
                            isMultiline={true}
                            selectionMode="multiple"
                            placeholder={text.selectTextChannelsPlaceholder}
                            selectedKeys={selectedTextChannels}
                            onSelectionChange={(keys) => setSelectedTextChannels(keys as Set<string>)}
                            isDisabled={settingsLoading}
                            classNames={{
                                trigger: "bg-[#0A0B0E] border border-white/5 min-h-[120px] rounded-2xl data-[hover=true]:bg-[#0A0B0E] data-[hover=true]:border-white/10 transition-all p-4 items-start",
                                value: "text-lg font-medium",
                                popoverContent: "bg-[#181A20] border border-white/10 rounded-2xl shadow-2xl",
                                listbox: "bg-transparent p-2 gap-1",
                                innerWrapper: "pt-1"
                            }}
                            listboxProps={{
                                itemClasses: { base: "py-2 px-2 min-h-[48px] rounded-xl data-[hover=true]:bg-white/5 text-default-500 data-[selected=true]:bg-white/10" },
                            }}
                            renderValue={(items) => (
                                <div className="flex flex-wrap gap-2">
                                    {items.map((item) => (
                                        <Chip key={item.key} variant="flat" className="bg-white/5 text-default-200 border border-white/5 h-8 pl-1">
                                            <div className="flex items-center gap-1 font-bold">
                                                <span className="text-default-400">#</span>
                                                <span>{item.textValue}</span>
                                            </div>
                                        </Chip>
                                    ))}
                                </div>
                            )}
                        >
                            {(channel) => (
                                <SelectItem key={channel.id} textValue={channel.name || channel.id}>
                                    <div className="flex items-center gap-3">
                                        <span className="text-default-400 text-lg font-mono">#</span>
                                        <span className="text-base font-bold text-white">{channel.name || channel.id}</span>
                                    </div>
                                </SelectItem>
                            )}
                        </Select>
                    </CardBody>
                </Card>
            </div>

            {/* Floating Action Bar */}
            <div className="sticky bottom-6 z-20 flex justify-center w-full">
                <div className="bg-[#181A20]/80 backdrop-blur-xl border border-white/10 shadow-2xl rounded-[24px] p-2 flex gap-3 w-full max-w-2xl transform transition-all duration-300 hover:scale-[1.01] hover:bg-[#181A20]/90">
                    <Button
                        color="primary"
                        size="lg"
                        className="flex-1 h-14 rounded-2xl font-bold text-lg shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all duration-300"
                        onPress={handleSaveSettings}
                        isLoading={isSaving}
                        isDisabled={!isDirty || settingsLoading}
                        startContent={!isSaving && <CheckCircle size={24} weight="fill" />}
                    >
                        {isSaving ? text.saving : text.saveSettings}
                    </Button>
                    <Button
                        variant="bordered"
                        size="lg"
                        className="h-14 w-14 min-w-14 rounded-2xl border-white/10 text-default-500 hover:text-white hover:bg-white/5 hover:border-white/20"
                        onPress={handleResetSettings}
                        isDisabled={settingsLoading}
                        isIconOnly
                        aria-label={text.resetDefaults}
                    >
                        <ArrowClockwise size={24} weight="bold" />
                    </Button>
                </div>
            </div>

            <Modal isOpen={!!syncPromptLocale} onClose={() => setSyncPromptLocale(null)} backdrop="blur" classNames={{
                base: "bg-[#181A20] border border-white/10 shadow-2xl rounded-[32px]",
                header: "border-b border-white/5 pb-4",
                footer: "border-t border-white/5 pt-4",
                closeButton: "hover:bg-white/5 active:bg-white/10 rounded-full",
            }}>
                <ModalContent>
                    {(onClose) => {
                        const promptLocaleLabel = syncPromptLocale === 'ru' ? 'Русский' : 'English';
                        return (
                            <>
                                <ModalHeader className="flex flex-col gap-1 text-2xl font-bold text-white">{text.languageSyncPromptTitle}</ModalHeader>
                                <ModalBody className="py-6">
                                    <p className="text-lg text-default-400">{t('languageSyncPromptDesc', { locale: promptLocaleLabel })}</p>
                                </ModalBody>
                                <ModalFooter>
                                    <Button color="default" variant="flat" onPress={onClose} className="rounded-xl font-bold h-12">
                                        {text.languageSyncSkip}
                                    </Button>
                                    <Button
                                        color="primary"
                                        className="rounded-xl font-bold h-12 shadow-lg shadow-primary/20"
                                        onPress={() => {
                                            if (syncPromptLocale) {
                                                setLocale(syncPromptLocale);
                                            }
                                            onClose();
                                            setSyncPromptLocale(null);
                                        }}
                                    >
                                        {text.languageSyncApply}
                                    </Button>
                                </ModalFooter>
                            </>
                        );
                    }}
                </ModalContent>
            </Modal>
        </div>
    );
}

