'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardBody, Button, Input, Switch, Select, SelectItem, SelectedItems, ButtonGroup, Checkbox, Chip, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from "@nextui-org/react";
import { Keyboard, CheckCircle, Prohibit, ShieldCheck, UserCircle, Translate } from "@phosphor-icons/react";
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
    }, [prefix, prefixCommandsEnabled, channelMode, selectedTextChannels, adminRoles, restoreRolesOnRejoin, restoreNicknameOnRejoin, selectedLocale]);

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
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold">{text.pageTitle}</h1>
                <p className="text-default-500">{text.pageSubtitle}</p>
            </div>

            {settingsError && (
                <Card className="bg-danger-50 border-danger-200 border">
                    <CardBody className="text-danger text-sm">{settingsError}</CardBody>
                </Card>
            )}

            {settingsWarning && !settingsError && (
                <Card className="bg-warning-50 border-warning-200 border">
                    <CardBody className="text-warning text-sm">{settingsWarning}</CardBody>
                </Card>
            )}
            <Card className="bg-surface border border-divider">
                <CardBody className="p-6 space-y-4">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-primary/10 rounded-lg text-primary">
                                <Keyboard size={24} weight="fill" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold">{text.sectionPrefixTitle}</h3>
                                <p className="text-default-500 text-sm">{text.sectionPrefixDesc}</p>
                            </div>
                        </div>
                        <Switch
                            isSelected={prefixCommandsEnabled}
                            onValueChange={setPrefixCommandsEnabled}
                            color="success"
                            size="lg"
                            isDisabled={settingsLoading}
                        >
                            {text.switchPrefixLabel}
                        </Switch>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input
                            label={text.prefixLabel}
                            placeholder="!"
                            value={prefix}
                            onValueChange={setPrefix}
                            maxLength={5}
                            variant="bordered"
                            isDisabled={settingsLoading}
                            description={t('prefixExample', { prefix: prefix.trim() || '!' })}
                        />
                        <div className="flex items-center">
                            <p className="text-sm text-default-500">
                                {prefixCommandsEnabled
                                    ? text.prefixEnabled
                                    : text.prefixDisabled}
                            </p>
                        </div>
                    </div>
                </CardBody>
            </Card>

            <Card className="bg-surface border border-divider">
                <CardBody className="p-6 space-y-4">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-secondary/10 rounded-lg text-secondary">
                                {channelMode === 'whitelist' ? <CheckCircle size={24} /> : <Prohibit size={24} />}
                            </div>
                            <div>
                                <h3 className="text-xl font-bold">{text.sectionChannelsTitle}</h3>
                                <p className="text-default-500 text-sm">
                                    {selectedTextChannels.size === 0
                                        ? text.sectionChannelsDescNone
                                        : channelMode === 'whitelist'
                                            ? text.sectionChannelsDescWhitelist
                                            : text.sectionChannelsDescBlacklist}
                                </p>
                            </div>
                        </div>
                        <ButtonGroup>
                            <Button
                                color={channelMode === 'whitelist' ? 'success' : 'default'}
                                variant={channelMode === 'whitelist' ? 'solid' : 'bordered'}
                                onPress={() => setChannelMode('whitelist')}
                                isDisabled={settingsLoading}
                            >
                                {text.whitelist}
                            </Button>
                            <Button
                                color={channelMode === 'blacklist' ? 'danger' : 'default'}
                                variant={channelMode === 'blacklist' ? 'solid' : 'bordered'}
                                onPress={() => setChannelMode('blacklist')}
                                isDisabled={settingsLoading}
                            >
                                {text.blacklist}
                            </Button>
                        </ButtonGroup>
                    </div>

                    <Select
                        items={textChannels}
                        label={text.selectTextChannelsLabel}
                        variant="bordered"
                        isMultiline={true}
                        selectionMode="multiple"
                        placeholder={text.selectTextChannelsPlaceholder}
                        selectedKeys={selectedTextChannels}
                        onSelectionChange={(keys) => setSelectedTextChannels(keys as Set<string>)}
                        color="secondary"
                        isDisabled={settingsLoading}
                        classNames={{
                            trigger: "min-h-unit-12 py-2",
                            value: "text-large",
                        }}
                    >
                        {(channel) => (
                            <SelectItem key={channel.id} textValue={channel.name || channel.id} className="text-large">
                                <div className="flex items-center gap-2">
                                    <span className="text-lg">{channel.name || channel.id}</span>
                                </div>
                            </SelectItem>
                        )}
                    </Select>
                </CardBody>
            </Card>

            <Card className="bg-surface border border-divider">
                <CardBody className="p-6 space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg text-primary">
                            <Translate size={24} weight="fill" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold">{text.languageTitle}</h3>
                            <p className="text-default-500 text-sm">{text.languageDesc}</p>
                        </div>
                    </div>

                    <Select
                        label={text.languageLabel}
                        variant="bordered"
                        selectedKeys={new Set([selectedLocale])}
                        onSelectionChange={(keys) => {
                            const [value] = Array.from(keys) as string[];
                            if (value === 'ru' || value === 'en') {
                                setSelectedLocale(value);
                            }
                        }}
                        isDisabled={settingsLoading}
                        renderValue={(items) => {
                            return items.map((item) => (
                                <div key={item.key} className="flex items-center gap-2">
                                    <img
                                        src={item.key === 'ru' ? "/icons/free_russia_flag.png" : "/icons/uk_flag.png"}
                                        className="w-4 h-4 rounded-sm object-contain"
                                        alt=""
                                    />
                                    <span>{item.data?.textValue || (item.key === 'ru' ? 'Русский' : 'English')}</span>
                                </div>
                            ));
                        }}
                    >
                        <SelectItem
                            key="ru"
                            textValue="Русский"
                            startContent={<img src="/icons/free_russia_flag.png" className="w-5 h-5 rounded-sm object-contain" alt="RU" />}
                        >
                            Русский
                        </SelectItem>
                        <SelectItem
                            key="en"
                            textValue="English"
                            startContent={<img src="/icons/uk_flag.png" className="w-5 h-5 rounded-sm object-contain" alt="EN" />}
                        >
                            English
                        </SelectItem>
                    </Select>
                    <p className="text-xs text-default-500">{text.languageNote}</p>
                </CardBody>
            </Card>

            <Card className="bg-surface border border-divider">
                <CardBody className="p-6 space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-success/10 rounded-lg text-success">
                            <ShieldCheck size={24} weight="fill" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold">{text.sectionAdminsTitle}</h3>
                            <p className="text-default-500 text-sm">{text.sectionAdminsDesc}</p>
                        </div>
                    </div>

                    <Select
                        items={roles}
                        label={text.selectAdminRolesLabel}
                        variant="bordered"
                        isMultiline={true}
                        selectionMode="multiple"
                        placeholder={text.selectAdminRolesPlaceholder}
                        selectedKeys={adminRoles}
                        onSelectionChange={(keys) => setAdminRoles(keys as Set<string>)}
                        color="secondary"
                        isDisabled={settingsLoading}
                        classNames={{
                            trigger: "min-h-unit-12 py-2",
                            value: "text-large",
                            popoverContent: "bg-surface border border-divider",
                            listbox: "p-1",
                        }}
                        listboxProps={{
                            itemClasses: {
                                base: "py-2 px-2 min-h-[48px]",
                            },
                        }}
                        renderValue={(items: SelectedItems<Role>) => {
                            return (
                                <div className="flex flex-wrap gap-2">
                                    {items.map((item) => {
                                        const roleColor = item.data?.color && item.data.color !== '#000000' ? item.data.color : '#3f3f46';
                                        const textColor = getTextColor(roleColor);
                                        return (
                                            <Chip
                                                key={item.key}
                                                variant="solid"
                                                style={{ backgroundColor: roleColor }}
                                                className={`border-none ${textColor} font-medium`}
                                            >
                                                <div className="flex items-center gap-1">
                                                    {item.data?.icon && <span>{item.data.icon}</span>}
                                                    <span>{item.data?.name}</span>
                                                </div>
                                            </Chip>
                                        );
                                    })}
                                </div>
                            );
                        }}
                    >
                        {(role) => {
                            const hasColor = role.color && role.color !== '#000000';
                            const textBorderColor = hasColor ? role.color : '#a1a1aa';
                            const bgColor = hasColor ? role.color : '#52525b';
                            const isSelected = adminRoles.has(role.id);

                            return (
                                <SelectItem key={role.id} textValue={role.name} className="data-[hover=true]:bg-default/40">
                                    <div className="flex items-center gap-3 w-full px-1.5 py-1.5">
                                        <Checkbox isSelected={isSelected} color="secondary" disableAnimation />
                                        <div
                                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-gradient-to-r from-white/10 to-transparent"
                                            style={{
                                                borderColor: textBorderColor,
                                                backgroundColor: hexToRgba(bgColor, 0.2)
                                            }}
                                        >
                                            {role.icon && <span className="text-lg">{role.icon}</span>}
                                            <span className="text-lg font-medium" style={{ color: textBorderColor }}>{role.name}</span>
                                        </div>
                                    </div>
                                </SelectItem>
                            );
                        }}
                    </Select>
                </CardBody>
            </Card>

            <Card className="bg-surface border border-divider">
                <CardBody className="p-6 space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-warning/10 rounded-lg text-warning">
                            <UserCircle size={24} weight="fill" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold">{text.sectionRejoinTitle}</h3>
                            <p className="text-default-500 text-sm">{text.sectionRejoinDesc}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex items-center justify-between p-4 rounded-xl bg-default-50 border border-default-100">
                            <div>
                                <p className="font-semibold">{text.restoreRolesTitle}</p>
                                <p className="text-xs text-default-500">{text.restoreRolesDesc}</p>
                            </div>
                            <Switch
                                isSelected={restoreRolesOnRejoin}
                                onValueChange={setRestoreRolesOnRejoin}
                                color="warning"
                                isDisabled={settingsLoading}
                            />
                        </div>
                        <div className="flex items-center justify-between p-4 rounded-xl bg-default-50 border border-default-100">
                            <div>
                                <p className="font-semibold">{text.restoreNicknameTitle}</p>
                                <p className="text-xs text-default-500">{text.restoreNicknameDesc}</p>
                            </div>
                            <Switch
                                isSelected={restoreNicknameOnRejoin}
                                onValueChange={setRestoreNicknameOnRejoin}
                                color="warning"
                                isDisabled={settingsLoading}
                            />
                        </div>
                    </div>
                </CardBody>
            </Card>

            <div className="flex gap-3 pt-2">
                <Button
                    color="primary"
                    size="lg"
                    className="flex-1 font-semibold shadow-lg shadow-primary/20"
                    onPress={handleSaveSettings}
                    isLoading={isSaving}
                    isDisabled={!isDirty || settingsLoading}
                >
                    {isSaving ? text.saving : text.saveSettings}
                </Button>
                <Button
                    variant="flat"
                    size="lg"
                    className="font-semibold"
                    onPress={handleResetSettings}
                    isDisabled={settingsLoading}
                >
                    {text.resetDefaults}
                </Button>
            </div>

            <Modal isOpen={!!syncPromptLocale} onClose={() => setSyncPromptLocale(null)} backdrop="blur">
                <ModalContent>
                    {(onClose) => {
                        const promptLocaleLabel = syncPromptLocale === 'ru' ? 'Русский' : 'English';
                        return (
                            <>
                                <ModalHeader className="flex flex-col gap-1">{text.languageSyncPromptTitle}</ModalHeader>
                                <ModalBody>
                                    <p>{t('languageSyncPromptDesc', { locale: promptLocaleLabel })}</p>
                                </ModalBody>
                                <ModalFooter>
                                    <Button color="default" variant="flat" onPress={onClose}>
                                        {text.languageSyncSkip}
                                    </Button>
                                    <Button
                                        color="primary"
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
