'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
    Card,
    CardBody,
    Button,
    Input,
    Select,
    SelectItem,
    Chip,
    ButtonGroup,
    Divider,
    Spinner,
    Textarea,
    Tooltip
} from '@nextui-org/react';
import {
    ArrowsClockwise,
    Buildings,
    ChatsTeardrop,
    UsersFour,
    ShieldCheck,
    TrashSimple,
    Sparkle,
    TextT,
    UsersThree,
} from '@phosphor-icons/react';
import { useGuildLocale } from '@/lib/i18n';

type Mode = 'create' | 'existing';

type ChannelOption = {
    id: string;
    name?: string;
    type?: number | string;
};

type TempVoiceConfig = {
    categoryId: string | null;
    hubChannelId: string;
    interfaceChannelId?: string | null;
    nameTemplate: string;
    userLimit?: number | null;
};

type TempVoiceResponse = {
    config?: TempVoiceConfig | null;
    roomsCount?: number;
    channels?: {
        categories?: ChannelOption[];
        voice?: ChannelOption[];
        text?: ChannelOption[];
    };
    error?: string;
};

const limitPresets = [0, 4, 8, 12, 25, 50];

const strings = {
    en: {
        title: 'Temporary Voice',
        subtitle: 'Configure temporary voice rooms and the control panel for /setupv.',
        refresh: 'Refresh',
        sendPanel: 'Send panel',
        statusConfigured: 'Configured',
        statusNotConfigured: 'Not configured',
        channelsTitle: 'Channels & Panel',
        channelsDesc: 'Create new channels automatically or select existing ones for the temp-voice system.',
        modeCreate: 'Create new',
        modeExisting: 'Use existing',
        labelCategory: 'Category',
        labelHub: 'Hub (voice)',
        labelInterface: 'Panel (text)',
        placeholderCategoryName: 'Temporary Voice',
        placeholderHubName: 'Join to Create',
        placeholderInterfaceName: 'temp-voice-control',
        selectCategory: 'Select a category',
        selectHub: 'Select a voice channel',
        selectInterface: 'Select a text channel',
        statusTitle: 'Status',
        statusDesc: 'Current temp-voice configuration summary.',
        statusRooms: 'Active rooms',
        notSet: 'Not set',
        nameTemplateLabel: 'Name template',
        userLimitLabel: 'User limit',
        roomsTitle: 'Room settings',
        roomsDesc: 'Set the room name template and member limit for created rooms.',
        nameTemplateField: 'Room name template',
        nameTemplatePlaceholder: 'Example: Room {user}',
        userLimitField: 'User limit',
        userLimitPlaceholder: '0 = no limit',
        userLimitHint: '0 means no limit.',
        save: 'Save settings',
        delete: 'Delete system',
        deleteTooltip: 'Deletes the category, channels, and panel created by the system.',
        dangerTitle: 'Delete system',
        dangerDesc: 'This will remove the temp-voice setup, channels, and panel. Type DELETE to confirm.',
        confirmLabel: 'Type to confirm',
        confirmPlaceholder: 'DELETE',
        confirmButton: 'Confirm delete',
        errorLoad: 'Failed to load temp-voice settings.',
        errorSave: 'Failed to save settings.',
        errorSendPanel: 'Failed to send control panel.',
        errorDelete: 'Failed to delete temp-voice settings.',
        errorMissingChannels: 'Select the category, hub, and panel channels.',
        errorMissingPanel: 'Select the category, hub, and panel channels before sending.',
        errorConfirmDelete: 'Type DELETE to confirm deletion.',
        defaultCategoryName: 'Temporary Voice',
        defaultHubName: 'Join to Create',
        defaultInterfaceName: 'temp-voice-control',
        defaultNameTemplate: 'Room {user}',
        noLimit: 'No limit',
    },
    ru: {
        title: 'Временные комнаты',
        subtitle: 'Настройка временных голосовых комнат и панели управления /setupv.',
        refresh: 'Обновить',
        sendPanel: 'Отправить панель',
        statusConfigured: 'Настроено',
        statusNotConfigured: 'Не настроено',
        channelsTitle: 'Каналы и панель',
        channelsDesc: 'Создайте новые каналы автоматически или выберите существующие для системы временных комнат.',
        modeCreate: 'Создать',
        modeExisting: 'Использовать существующие',
        labelCategory: 'Категория',
        labelHub: 'Хаб (voice)',
        labelInterface: 'Панель (text)',
        placeholderCategoryName: 'Временные комнаты',
        placeholderHubName: 'Войти, чтобы создать',
        placeholderInterfaceName: 'temp-voice-control',
        selectCategory: 'Выберите категорию',
        selectHub: 'Выберите голосовой канал',
        selectInterface: 'Выберите текстовый канал',
        statusTitle: 'Состояние',
        statusDesc: 'Сводка настроек системы временных комнат.',
        statusRooms: 'Активных комнат',
        notSet: 'Не задано',
        nameTemplateLabel: 'Шаблон названия',
        userLimitLabel: 'Лимит пользователей',
        roomsTitle: 'Параметры комнат',
        roomsDesc: 'Настройте шаблон названия и лимит участников для создаваемых комнат.',
        nameTemplateField: 'Шаблон названия комнаты',
        nameTemplatePlaceholder: 'Например: комната {user}',
        userLimitField: 'Лимит пользователей',
        userLimitPlaceholder: '0 = без лимита',
        userLimitHint: '0 означает без лимита.',
        save: 'Сохранить',
        delete: 'Удалить систему',
        deleteTooltip: 'Удалит категорию, каналы и панель, созданные системой.',
        dangerTitle: 'Удалить систему',
        dangerDesc: 'Это удалит настройки, каналы и панель. Для подтверждения введите DELETE.',
        confirmLabel: 'Подтверждение',
        confirmPlaceholder: 'DELETE',
        confirmButton: 'Подтвердить удаление',
        errorLoad: 'Не удалось загрузить настройки временных комнат.',
        errorSave: 'Не удалось сохранить настройки.',
        errorSendPanel: 'Не удалось отправить панель управления.',
        errorDelete: 'Не удалось удалить настройки временных комнат.',
        errorMissingChannels: 'Выберите категорию, хаб и канал панели.',
        errorMissingPanel: 'Выберите категорию, хаб и канал панели перед отправкой.',
        errorConfirmDelete: 'Введите DELETE для подтверждения удаления.',
        defaultCategoryName: 'Временные комнаты',
        defaultHubName: 'Войти, чтобы создать',
        defaultInterfaceName: 'temp-voice-control',
        defaultNameTemplate: 'Комната {user}',
        noLimit: 'Без лимита',
    },
} as const;

const ChannelItem = ({ item }: { item: ChannelOption }) => (
    <div className="flex items-center gap-2 w-full px-2 py-1.5">
        <span className="text-base truncate">{item.name || item.id}</span>
    </div>
);

export default function TempVoicePage({ params }: { params: Promise<{ guildId: string }> }) {
    const { guildId } = React.use(params);
    const { locale } = useGuildLocale(guildId);
    const text = strings[locale];

    const defaults = useMemo(() => ({
        categoryName: text.defaultCategoryName,
        hubName: text.defaultHubName,
        interfaceName: text.defaultInterfaceName,
        nameTemplate: text.defaultNameTemplate,
    }), [text]);

    const [mode, setMode] = useState<Mode>('create');
    const [channels, setChannels] = useState<{ categories: ChannelOption[]; voice: ChannelOption[]; text: ChannelOption[] }>({
        categories: [],
        voice: [],
        text: [],
    });
    const [form, setForm] = useState({
        categoryName: '',
        hubName: '',
        interfaceName: '',
        categoryId: '',
        hubChannelId: '',
        interfaceChannelId: '',
        nameTemplate: '',
        userLimit: '',
    });
    const [config, setConfig] = useState<TempVoiceConfig | null>(null);
    const [roomsCount, setRoomsCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [sendingPanel, setSendingPanel] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState('');

    useEffect(() => {
        setForm((prev) => ({
            ...prev,
            categoryName: prev.categoryName || defaults.categoryName,
            hubName: prev.hubName || defaults.hubName,
            interfaceName: prev.interfaceName || defaults.interfaceName,
            nameTemplate: prev.nameTemplate || defaults.nameTemplate,
        }));
    }, [defaults]);

    const channelNameById = useMemo(() => {
        const map = new Map<string, string>();
        for (const ch of [...channels.categories, ...channels.voice, ...channels.text]) {
            if (ch?.id && ch?.name) map.set(ch.id, ch.name);
        }
        return map;
    }, [channels]);

    const resolveChannelName = (id?: string | null) => {
        if (!id) return null;
        return channelNameById.get(id) || null;
    };

    const applyConfigToForm = (cfg: TempVoiceConfig | null) => {
        if (!cfg) return;
        setForm((prev) => ({
            ...prev,
            categoryId: cfg.categoryId || '',
            hubChannelId: cfg.hubChannelId || '',
            interfaceChannelId: cfg.interfaceChannelId || '',
            nameTemplate: cfg.nameTemplate || defaults.nameTemplate,
            userLimit: cfg.userLimit === null || cfg.userLimit === undefined ? '' : String(cfg.userLimit),
        }));
    };

    const fetchData = async () => {
        if (!guildId) return;
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/guilds/${guildId}/tempvoice`);
            const data: TempVoiceResponse = await res.json();
            if (!res.ok) {
                throw new Error(text.errorLoad);
            }
            setConfig(data.config || null);
            setRoomsCount(data.roomsCount || 0);
            setChannels({
                categories: data.channels?.categories || [],
                voice: data.channels?.voice || [],
                text: data.channels?.text || [],
            });
            if (data.config) {
                setMode('existing');
                applyConfigToForm(data.config);
            }
        } catch (err: unknown) {
            setError(text.errorLoad);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [guildId]);

    const handleSave = async () => {
        if (!guildId) return;
        setSaving(true);
        setError(null);
        try {
            const payload: Record<string, unknown> = {
                mode,
                nameTemplate: form.nameTemplate.trim() || defaults.nameTemplate,
                userLimit: form.userLimit === '' ? null : Number(form.userLimit),
            };

            if (mode === 'create') {
                payload.categoryName = form.categoryName.trim() || defaults.categoryName;
                payload.hubName = form.hubName.trim() || defaults.hubName;
                payload.interfaceName = form.interfaceName.trim() || defaults.interfaceName;
            } else {
                if (!form.categoryId || !form.hubChannelId || !form.interfaceChannelId) {
                    setError(text.errorMissingChannels);
                    setSaving(false);
                    return;
                }
                payload.categoryId = form.categoryId;
                payload.hubChannelId = form.hubChannelId;
                payload.interfaceChannelId = form.interfaceChannelId;
            }

            const res = await fetch(`/api/guilds/${guildId}/tempvoice`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (!res.ok) {
                throw new Error(text.errorSave);
            }

            setConfig(data.config || null);
            applyConfigToForm(data.config || null);
            await fetchData();
        } catch (err: unknown) {
            setError(text.errorSave);
        } finally {
            setSaving(false);
        }
    };

    const handleSendPanel = async () => {
        if (!guildId) return;
        setSendingPanel(true);
        setError(null);
        try {
            const categoryId = form.categoryId || config?.categoryId || '';
            const hubChannelId = form.hubChannelId || config?.hubChannelId || '';
            const interfaceChannelId = form.interfaceChannelId || config?.interfaceChannelId || '';
            if (!categoryId || !hubChannelId || !interfaceChannelId) {
                throw new Error(text.errorMissingPanel);
            }

            const res = await fetch(`/api/guilds/${guildId}/tempvoice`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    mode: 'existing',
                    categoryId,
                    hubChannelId,
                    interfaceChannelId,
                    nameTemplate: form.nameTemplate.trim() || defaults.nameTemplate,
                    userLimit: form.userLimit === '' ? null : Number(form.userLimit),
                    sendPanel: true,
                }),
            });

            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(text.errorSendPanel);
            }

            if (data.config) {
                setConfig(data.config);
                applyConfigToForm(data.config);
            }
        } catch (err: unknown) {
            setError(text.errorSendPanel);
        } finally {
            setSendingPanel(false);
        }
    };

    const handleDelete = async () => {
        if (!guildId) return;
        if (deleteConfirm.trim().toUpperCase() !== 'DELETE') {
            setError(text.errorConfirmDelete);
            return;
        }
        setDeleting(true);
        setError(null);
        try {
            const res = await fetch(`/api/guilds/${guildId}/tempvoice`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ confirm: true }),
            });
            const data = await res.json();
            if (!res.ok) {
                throw new Error(text.errorDelete);
            }
            setConfig(null);
            setDeleteConfirm('');
            setForm((prev) => ({
                ...prev,
                categoryId: '',
                hubChannelId: '',
                interfaceChannelId: '',
            }));
            await fetchData();
        } catch (err: unknown) {
            setError(text.errorDelete);
        } finally {
            setDeleting(false);
        }
    };

    const limitLabel = (limit: number) => (limit === 0 ? text.noLimit : `${limit}`);

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold">{text.title}</h1>
                    <p className="text-default-500">{text.subtitle}</p>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="flat"
                        startContent={<ArrowsClockwise size={18} />}
                        onPress={fetchData}
                        isDisabled={loading}
                    >
                        {text.refresh}
                    </Button>
                    <Button
                        variant="flat"
                        onPress={handleSendPanel}
                        isLoading={sendingPanel}
                        isDisabled={loading || sendingPanel}
                    >
                        {text.sendPanel}
                    </Button>
                    <Chip color={config ? 'success' : 'warning'} variant="flat" startContent={<Sparkle size={16} />}>
                        {config ? text.statusConfigured : text.statusNotConfigured}
                    </Chip>
                </div>
            </div>

            {error && (
                <Card className="bg-danger-50 border-danger-200 border">
                    <CardBody className="text-danger text-sm">{error}</CardBody>
                </Card>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <Card className="bg-surface border border-divider lg:col-span-2">
                    <CardBody className="p-6 space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-primary/10 text-primary">
                                <Buildings size={24} weight="fill" />
                            </div>
                            <div className="flex-1">
                                <h3 className="text-xl font-bold">{text.channelsTitle}</h3>
                                <p className="text-default-500 text-sm">{text.channelsDesc}</p>
                            </div>
                            <ButtonGroup radius="sm">
                                <Button
                                    color={mode === 'create' ? 'primary' : 'default'}
                                    variant={mode === 'create' ? 'solid' : 'flat'}
                                    onPress={() => setMode('create')}
                                >
                                    {text.modeCreate}
                                </Button>
                                <Button
                                    color={mode === 'existing' ? 'primary' : 'default'}
                                    variant={mode === 'existing' ? 'solid' : 'flat'}
                                    onPress={() => setMode('existing')}
                                >
                                    {text.modeExisting}
                                </Button>
                            </ButtonGroup>
                        </div>

                        <Divider />

                        {mode === 'create' ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Input
                                    label={text.labelCategory}
                                    placeholder={text.placeholderCategoryName}
                                    value={form.categoryName}
                                    onChange={(e) => setForm({ ...form, categoryName: e.target.value })}
                                    variant="bordered"
                                />
                                <Input
                                    label={text.labelHub}
                                    placeholder={text.placeholderHubName}
                                    value={form.hubName}
                                    onChange={(e) => setForm({ ...form, hubName: e.target.value })}
                                    variant="bordered"
                                />
                                <Input
                                    label={text.labelInterface}
                                    placeholder={text.placeholderInterfaceName}
                                    value={form.interfaceName}
                                    onChange={(e) => setForm({ ...form, interfaceName: e.target.value })}
                                    variant="bordered"
                                />
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <Select
                                    label={text.labelCategory}
                                    variant="bordered"
                                    placeholder={text.selectCategory}
                                    selectedKeys={form.categoryId ? [form.categoryId] : []}
                                    onSelectionChange={(keys) => {
                                        const value = Array.from(keys)[0] as string | undefined;
                                        setForm({ ...form, categoryId: value || '' });
                                    }}
                                    items={channels.categories}
                                    classNames={{
                                        trigger: "min-h-unit-12 py-2",
                                        value: "text-large",
                                        listbox: "p-1 space-y-1",
                                    }}
                                    listboxProps={{
                                        itemClasses: {
                                            base: "px-2 py-2 min-h-[44px]",
                                        },
                                    }}
                                >
                                    {(item) => (
                                        <SelectItem key={item.id} textValue={item.name || item.id} className="text-large">
                                            <ChannelItem item={item} />
                                        </SelectItem>
                                    )}
                                </Select>
                                <Select
                                    label={text.labelHub}
                                    variant="bordered"
                                    placeholder={text.selectHub}
                                    selectedKeys={form.hubChannelId ? [form.hubChannelId] : []}
                                    onSelectionChange={(keys) => {
                                        const value = Array.from(keys)[0] as string | undefined;
                                        setForm({ ...form, hubChannelId: value || '' });
                                    }}
                                    items={channels.voice}
                                    classNames={{
                                        trigger: "min-h-unit-12 py-2",
                                        value: "text-large",
                                        listbox: "p-1 space-y-1",
                                    }}
                                    listboxProps={{
                                        itemClasses: {
                                            base: "px-2 py-2 min-h-[44px]",
                                        },
                                    }}
                                >
                                    {(item) => (
                                        <SelectItem key={item.id} textValue={item.name || item.id} className="text-large">
                                            <ChannelItem item={item} />
                                        </SelectItem>
                                    )}
                                </Select>
                                <Select
                                    label={text.labelInterface}
                                    variant="bordered"
                                    placeholder={text.selectInterface}
                                    selectedKeys={form.interfaceChannelId ? [form.interfaceChannelId] : []}
                                    onSelectionChange={(keys) => {
                                        const value = Array.from(keys)[0] as string | undefined;
                                        setForm({ ...form, interfaceChannelId: value || '' });
                                    }}
                                    items={channels.text}
                                    classNames={{
                                        trigger: "min-h-unit-12 py-2",
                                        value: "text-large",
                                        listbox: "p-1 flex flex-col gap-1",
                                    }}
                                    listboxProps={{
                                        itemClasses: {
                                            base: "px-2 py-2 min-h-[44px]",
                                        },
                                    }}
                                >
                                    {(item) => (
                                        <SelectItem key={item.id} textValue={item.name || item.id} className="text-large">
                                            <ChannelItem item={item} />
                                        </SelectItem>
                                    )}
                                </Select>
                            </div>
                        )}
                    </CardBody>
                </Card>

                <Card className="bg-surface border border-divider">
                    <CardBody className="p-6 space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-xl bg-secondary/10 text-secondary">
                                    <ChatsTeardrop size={24} weight="fill" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold">{text.statusTitle}</h3>
                                    <p className="text-default-500 text-sm">{text.statusDesc}</p>
                                </div>
                            </div>
                            {loading && <Spinner size="sm" color="secondary" />}
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <StatusChip
                                label={text.labelCategory}
                                value={resolveChannelName(config?.categoryId) || text.notSet}
                                hint={config?.categoryId && !resolveChannelName(config?.categoryId) ? `ID: ${config.categoryId}` : undefined}
                            />
                            <StatusChip
                                label={text.labelHub}
                                value={resolveChannelName(config?.hubChannelId) || text.notSet}
                                hint={config?.hubChannelId && !resolveChannelName(config?.hubChannelId) ? `ID: ${config.hubChannelId}` : undefined}
                            />
                            <StatusChip
                                label={text.labelInterface}
                                value={resolveChannelName(config?.interfaceChannelId) || text.notSet}
                                hint={config?.interfaceChannelId && !resolveChannelName(config?.interfaceChannelId) ? `ID: ${config.interfaceChannelId}` : undefined}
                            />
                            <StatusChip label={text.statusRooms} value={roomsCount.toString()} />
                        </div>

                        <Divider />

                        <div className="space-y-2">
                            <p className="text-sm text-default-500">{text.nameTemplateLabel}</p>
                            <Chip color="secondary" variant="flat">{config?.nameTemplate || defaults.nameTemplate}</Chip>
                            <p className="text-sm text-default-500">{text.userLimitLabel}</p>
                            <Chip color="secondary" variant="flat">{config?.userLimit ?? text.noLimit}</Chip>
                        </div>
                    </CardBody>
                </Card>
            </div>

            <Card className="bg-surface border border-divider">
                <CardBody className="p-6 space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-success/10 text-success">
                            <UsersFour size={24} weight="fill" />
                        </div>
                        <div className="flex-1">
                            <h3 className="text-xl font-bold">{text.roomsTitle}</h3>
                            <p className="text-default-500 text-sm">{text.roomsDesc}</p>
                        </div>
                    </div>

                    <div className="space-y-5">
                        <div className="space-y-2">
                            <FieldLabel icon={<TextT size={18} />} text={text.nameTemplateField} />
                            <Textarea
                                minRows={2}
                                placeholder={text.nameTemplatePlaceholder}
                                value={form.nameTemplate}
                                onChange={(e) => setForm({ ...form, nameTemplate: e.target.value })}
                                variant="bordered"
                            />
                        </div>

                        <div className="space-y-3 w-full">
                            <FieldLabel icon={<UsersThree size={18} />} text={text.userLimitField} />
                            <Input
                                type="number"
                                placeholder={text.userLimitPlaceholder}
                                value={form.userLimit}
                                onChange={(e) => setForm({ ...form, userLimit: e.target.value })}
                                variant="bordered"
                            />

                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                {limitPresets.map((limit) => {
                                    const selected = form.userLimit === String(limit);
                                    return (
                                        <Button
                                            key={limit}
                                            size="sm"
                                            fullWidth
                                            radius="lg"
                                            variant={selected ? 'solid' : 'bordered'}
                                            color="primary"
                                            onPress={() => setForm((prev) => ({ ...prev, userLimit: String(limit) }))}
                                        >
                                            {limitLabel(limit)}
                                        </Button>
                                    );
                                })}
                            </div>
                            <p className="text-xs text-default-500">{text.userLimitHint}</p>
                        </div>
                    </div>

                    <Divider />

                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <Button color="primary" onPress={handleSave} isLoading={saving} isDisabled={loading || saving}>
                            {text.save}
                        </Button>
                        <Tooltip content={text.deleteTooltip}>
                            <Button
                                color="danger"
                                variant="flat"
                                onPress={handleDelete}
                                isLoading={deleting}
                                isDisabled={deleting || loading}
                                startContent={<TrashSimple size={18} />}
                            >
                                {text.delete}
                            </Button>
                        </Tooltip>
                    </div>
                </CardBody>
            </Card>

            <Card className="bg-surface border border-danger/30">
                <CardBody className="p-6 space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-danger/10 text-danger">
                            <ShieldCheck size={24} weight="fill" />
                        </div>
                        <div className="flex-1">
                            <h3 className="text-xl font-bold text-danger">{text.dangerTitle}</h3>
                            <p className="text-default-500 text-sm">{text.dangerDesc}</p>
                        </div>
                    </div>

                    <div className="flex flex-col md:flex-row gap-3 items-end">
                        <Input
                            label={text.confirmLabel}
                            placeholder={text.confirmPlaceholder}
                            value={deleteConfirm}
                            onChange={(e) => setDeleteConfirm(e.target.value)}
                            variant="bordered"
                            className="md:flex-1"
                        />
                        <Button
                            color="danger"
                            variant="solid"
                            onPress={handleDelete}
                            isLoading={deleting}
                            isDisabled={deleting || loading}
                            startContent={<TrashSimple size={18} />}
                        >
                            {text.confirmButton}
                        </Button>
                    </div>
                </CardBody>
            </Card>
        </div>
    );
}

function StatusChip({ label, value, hint }: { label: string; value: string; hint?: string }) {
    return (
        <div className="p-3 rounded-lg border border-divider bg-default-50 space-y-1">
            <p className="text-xs uppercase tracking-wide text-default-500 font-semibold">{label}</p>
            {hint ? (
                <Tooltip content={hint} placement="top" delay={300}>
                    <p className="font-semibold truncate">{value}</p>
                </Tooltip>
            ) : (
                <p className="font-semibold truncate">{value}</p>
            )}
        </div>
    );
}

function FieldLabel({ icon, text }: { icon: React.ReactNode; text: string }) {
    return (
        <div className="flex items-center gap-2 text-sm font-semibold text-default-500">
            <span className="text-default-400">{icon}</span>
            <span className="uppercase tracking-wide">{text}</span>
        </div>
    );
}
