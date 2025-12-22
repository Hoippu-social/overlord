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
    Divider,
    Spinner,
    Textarea,
    Tooltip,
    Switch,
    Tabs,
    Tab
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
    MicrophoneStage,
    SquaresFour,
    Desktop,
    MagicWand,
    ListDashes,
    FloppyDisk,
    Warning
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

const limitPresets = [0, 2, 4, 10, 20, 50];

const strings = {
    en: {
        title: 'Temporary Voice',
        subtitle: 'Automated voice channels that are created on demand.',
        refresh: 'Refresh',
        sendPanel: 'Send Control Panel',
        sendPanelDesc: 'Post the interface message to the text channel.',
        statusConfigured: 'System Active',
        statusNotConfigured: 'Not Configured',
        channelsTitle: 'Configuration',
        channelsDesc: 'Setup the structure for your temporary voice system.',
        modeCreate: 'Auto-Create',
        modeExisting: 'Manual Link',
        labelCategory: 'Category Name',
        labelHub: 'Hub Channel Name',
        labelInterface: 'Interface Channel Name',
        placeholderCategoryName: 'Temporary Voice',
        placeholderHubName: '➕ Join to Create',
        placeholderInterfaceName: 'temp-voice-controls',
        selectCategory: 'Select Category',
        selectHub: 'Select Voice Channel',
        selectInterface: 'Select Text Channel',
        statusTitle: 'System Status',
        statusDesc: 'Live metrics and connection status.',
        statusRooms: 'Active Rooms',
        notSet: 'Not configured',
        nameTemplateLabel: 'Room Template',
        userLimitLabel: 'User Limit',
        roomsTitle: 'Room Defaults',
        roomsDesc: 'Default settings for new temporary rooms.',
        nameTemplateField: 'Room Name Pattern',
        nameTemplatePlaceholder: 'e.g. {user}\'s Room',
        userLimitField: 'Max Users',
        userLimitPlaceholder: '0 = Unlimited',
        userLimitHint: 'Set to 0 for unlimited slots.',
        save: 'Save Changes',
        delete: 'Tear Down System',
        deleteTooltip: 'This will delete the configuration and optionally the channels.',
        dangerTitle: 'Danger Zone',
        dangerDesc: 'Irreversible actions for system removal.',
        confirmLabel: 'Type DELETE to confirm',
        confirmPlaceholder: 'DELETE',
        confirmButton: 'Delete System',
        errorLoad: 'Failed to load settings',
        errorSave: 'Failed to save settings',
        errorSendPanel: 'Failed to send panel',
        errorDelete: 'Failed to delete system',
        errorMissingChannels: 'Please fill in all channel fields',
        errorMissingPanel: 'Configuration incomplete',
        errorConfirmDelete: 'Incorrect confirmation text',
        defaultCategoryName: 'Temporary Voice',
        defaultHubName: 'Join to Create',
        defaultInterfaceName: 'temp-voice-controls',
        defaultNameTemplate: '{user}\'s Room',
        noLimit: 'Unlimited',
        channelsSection: 'Channel Setup',
        roomSection: 'Room Logic'
    },
    ru: {
        title: 'Временные Комнаты',
        subtitle: 'Автоматические голосовые каналы, создаваемые по требованию.',
        refresh: 'Обновить',
        sendPanel: 'Отправить Панель',
        sendPanelDesc: 'Отправить сообщение управления в текстовый канал.',
        statusConfigured: 'Система активна',
        statusNotConfigured: 'Не настроено',
        channelsTitle: 'Конфигурация',
        channelsDesc: 'Настройте структуру системы временных комнат.',
        modeCreate: 'Авто-создание',
        modeExisting: 'Ручная привязка',
        labelCategory: 'Название категории',
        labelHub: 'Название хаба',
        labelInterface: 'Название канала управления',
        placeholderCategoryName: 'Временные каналы',
        placeholderHubName: '➕ Создать комнату',
        placeholderInterfaceName: 'управление-комнатами',
        selectCategory: 'Выберите категорию',
        selectHub: 'Выберите голосовой канал',
        selectInterface: 'Выберите текстовый канал',
        statusTitle: 'Статус Системы',
        statusDesc: 'Текущие показатели и проверки.',
        statusRooms: 'Активных комнат',
        notSet: 'Не задано',
        nameTemplateLabel: 'Шаблон имени',
        userLimitLabel: 'Лимит мест',
        roomsTitle: 'Настройки Комнат',
        roomsDesc: 'Параметры по умолчанию для новых комнат.',
        nameTemplateField: 'Шаблон названия',
        nameTemplatePlaceholder: 'Например: Комната {user}',
        userLimitField: 'Макс. пользователей',
        userLimitPlaceholder: '0 = без лимита',
        userLimitHint: '0 означает отсутствие ограничений.',
        save: 'Сохранить изменения',
        delete: 'Удалить систему',
        deleteTooltip: 'Это удалит конфигурацию и созданные каналы.',
        dangerTitle: 'Опасная Зона',
        dangerDesc: 'Необратимые действия по удалению системы.',
        confirmLabel: 'Введите DELETE',
        confirmPlaceholder: 'DELETE',
        confirmButton: 'Удалить систему',
        errorLoad: 'Ошибка загрузки',
        errorSave: 'Ошибка сохранения',
        errorSendPanel: 'Ошибка отправки панели',
        errorDelete: 'Ошибка удаления',
        errorMissingChannels: 'Заполните все поля каналов',
        errorMissingPanel: 'Конфигурация не завершена',
        errorConfirmDelete: 'Неверный текст подтверждения',
        defaultCategoryName: 'Временные каналы',
        defaultHubName: 'Создать комнату',
        defaultInterfaceName: 'управление-комнатами',
        defaultNameTemplate: 'Комната {user}',
        noLimit: 'Без лимита',
        channelsSection: 'Настройка Каналов',
        roomSection: 'Логика Комнат'
    },
} as const;

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
        userLimit: '0',
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
            userLimit: cfg.userLimit === null || cfg.userLimit === undefined ? '0' : String(cfg.userLimit),
        }));
    };

    const fetchData = async () => {
        if (!guildId) return;
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/guilds/${guildId}/tempvoice`);
            const data: TempVoiceResponse = await res.json();
            if (!res.ok) throw new Error(text.errorLoad);

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
            if (!res.ok) throw new Error(text.errorSave);

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
            if (!res.ok) throw new Error(text.errorSendPanel);

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
            if (!res.ok) throw new Error(text.errorDelete);

            setConfig(null);
            setDeleteConfirm('');
            setForm(prev => ({ ...prev, categoryId: '', hubChannelId: '', interfaceChannelId: '' }));
            await fetchData();
        } catch (err: unknown) {
            setError(text.errorDelete);
        } finally {
            setDeleting(false);
        }
    };

    const limitLabel = (limit: number) => (limit === 0 ? text.noLimit : `${limit}`);

    // UI HELPER: Shared Input Styles
    const inputStyles = {
        inputWrapper: "bg-[#0A0B0E] border border-white/5 data-[hover=true]:border-white/10 group-data-[focus=true]:border-primary/50 transition-colors h-12 rounded-xl",
        input: "font-medium",
        label: "hidden"
    };

    return (
        <div className="space-y-8 pb-10 animate-fade-in min-h-screen">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-5">
                    <div className="w-16 h-16 rounded-[24px] bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 flex items-center justify-center text-white shadow-xl border border-white/5">
                        <MicrophoneStage size={32} weight="fill" className="text-violet-400" />
                    </div>
                    <div>
                        <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
                            {text.title}
                        </h1>
                        <p className="text-default-500 text-lg">{text.subtitle}</p>
                    </div>
                </div>
                <div className="flex gap-3">
                    <Button
                        onPress={fetchData}
                        isDisabled={loading}
                        isIconOnly
                        className="bg-[#181A20] border border-white/5 text-default-500"
                    >
                        <ArrowsClockwise size={20} className={loading ? "animate-spin" : ""} />
                    </Button>
                    {config && (
                        <Chip
                            classNames={{
                                base: "bg-emerald-500/10 border border-emerald-500/20 h-10 px-4",
                                content: "font-bold text-emerald-500"
                            }}
                            startContent={<Sparkle weight="fill" size={18} className="mr-1" />}
                        >
                            {text.statusConfigured}
                        </Chip>
                    )}
                </div>
            </div>

            {error && (
                <div className="bg-rose-500/10 border border-rose-500/20 text-rose-500 p-4 rounded-2xl flex items-center gap-3">
                    <Warning size={24} weight="fill" />
                    <p className="font-bold">{error}</p>
                </div>
            )}

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">

                {/* Column 1: Configuration (Span 2) */}
                <div className="xl:col-span-2 space-y-6">
                    <Card className="bg-[#181A20] border border-white/5 shadow-xl rounded-[32px]">
                        <CardBody className="p-8 space-y-8">

                            {/* Section 1: Connection Mode */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary shadow-inner-lg">
                                        <MagicWand size={24} weight="fill" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-white">{text.channelsTitle}</h3>
                                        <p className="text-default-500 text-sm">{text.channelsDesc}</p>
                                    </div>
                                </div>

                                <Tabs
                                    selectedKey={mode}
                                    onSelectionChange={(k) => setMode(k as Mode)}
                                    color="primary"
                                    radius="lg"
                                    classNames={{
                                        tabList: "bg-[#0A0B0E] border border-white/5 p-1",
                                        cursor: "shadow-lg",
                                        tabContent: "font-bold group-data-[selected=true]:text-white"
                                    }}
                                >
                                    <Tab key="create" title={text.modeCreate} />
                                    <Tab key="existing" title={text.modeExisting} />
                                </Tabs>
                            </div>

                            <Divider className="bg-white/5" />

                            {/* Section 2: Channel Inputs */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-8">
                                <div className="space-y-3">
                                    <label className="text-sm font-bold text-default-500 uppercase tracking-wider flex items-center gap-2">
                                        <SquaresFour weight="bold" /> {text.labelCategory}
                                    </label>
                                    {mode === 'create' ? (
                                        <Input
                                            value={form.categoryName}
                                            onChange={(e) => setForm({ ...form, categoryName: e.target.value })}
                                            placeholder={text.placeholderCategoryName}
                                            classNames={inputStyles}
                                        />
                                    ) : (
                                        <Select
                                            selectedKeys={form.categoryId ? [form.categoryId] : []}
                                            onSelectionChange={(keys) => setForm({ ...form, categoryId: Array.from(keys)[0] as string || '' })}
                                            items={channels.categories}
                                            placeholder={text.selectCategory}
                                            classNames={{
                                                trigger: "bg-[#0A0B0E] border border-white/5 h-12 rounded-xl",
                                                popoverContent: "bg-[#181A20] border border-white/10"
                                            }}
                                            renderValue={(items) => items.map(item => <span key={item.key} className="text-white font-medium">{item.textValue}</span>)}
                                        >
                                            {(item) => <SelectItem key={item.id} textValue={item.name || item.id} classNames={{ base: "data-[hover=true]:bg-white/5 text-default-400 data-[hover=true]:text-white" }}>{item.name || item.id}</SelectItem>}
                                        </Select>
                                    )}
                                </div>

                                <div className="space-y-3">
                                    <label className="text-sm font-bold text-default-500 uppercase tracking-wider flex items-center gap-2">
                                        <MicrophoneStage weight="bold" /> {text.labelHub}
                                    </label>
                                    {mode === 'create' ? (
                                        <Input
                                            value={form.hubName}
                                            onChange={(e) => setForm({ ...form, hubName: e.target.value })}
                                            placeholder={text.placeholderHubName}
                                            classNames={inputStyles}
                                        />
                                    ) : (
                                        <Select
                                            selectedKeys={form.hubChannelId ? [form.hubChannelId] : []}
                                            onSelectionChange={(keys) => setForm({ ...form, hubChannelId: Array.from(keys)[0] as string || '' })}
                                            items={channels.voice}
                                            placeholder={text.selectHub}
                                            classNames={{
                                                trigger: "bg-[#0A0B0E] border border-white/5 h-12 rounded-xl",
                                                popoverContent: "bg-[#181A20] border border-white/10"
                                            }}
                                            renderValue={(items) => items.map(item => <span key={item.key} className="text-white font-medium">{item.textValue}</span>)}
                                        >
                                            {(item) => <SelectItem key={item.id} textValue={item.name || item.id} classNames={{ base: "data-[hover=true]:bg-white/5 text-default-400 data-[hover=true]:text-white" }}>{item.name || item.id}</SelectItem>}
                                        </Select>
                                    )}
                                </div>

                                <div className="space-y-3 md:col-span-2">
                                    <label className="text-sm font-bold text-default-500 uppercase tracking-wider flex items-center gap-2">
                                        <Desktop weight="bold" /> {text.labelInterface}
                                    </label>
                                    {mode === 'create' ? (
                                        <Input
                                            value={form.interfaceName}
                                            onChange={(e) => setForm({ ...form, interfaceName: e.target.value })}
                                            placeholder={text.placeholderInterfaceName}
                                            classNames={inputStyles}
                                        />
                                    ) : (
                                        <Select
                                            selectedKeys={form.interfaceChannelId ? [form.interfaceChannelId] : []}
                                            onSelectionChange={(keys) => setForm({ ...form, interfaceChannelId: Array.from(keys)[0] as string || '' })}
                                            items={channels.text}
                                            placeholder={text.selectInterface}
                                            classNames={{
                                                trigger: "bg-[#0A0B0E] border border-white/5 h-12 rounded-xl",
                                                popoverContent: "bg-[#181A20] border border-white/10"
                                            }}
                                            renderValue={(items) => items.map(item => <span key={item.key} className="text-white font-medium">{item.textValue}</span>)}
                                        >
                                            {(item) => <SelectItem key={item.id} textValue={item.name || item.id} classNames={{ base: "data-[hover=true]:bg-white/5 text-default-400 data-[hover=true]:text-white" }}>{item.name || item.id}</SelectItem>}
                                        </Select>
                                    )}
                                </div>
                            </div>
                        </CardBody>
                    </Card>

                    <Card className="bg-[#181A20] border border-white/5 shadow-xl rounded-[32px]">
                        <CardBody className="p-8 space-y-8">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl bg-secondary/10 flex items-center justify-center text-secondary shadow-inner-lg">
                                    <ListDashes size={24} weight="fill" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-white">{text.roomsTitle}</h3>
                                    <p className="text-default-500 text-sm">{text.roomsDesc}</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-3">
                                    <label className="text-sm font-bold text-default-500 uppercase tracking-wider flex items-center gap-2">
                                        <TextT weight="bold" /> {text.nameTemplateField}
                                    </label>
                                    <Input
                                        value={form.nameTemplate}
                                        onChange={(e) => setForm({ ...form, nameTemplate: e.target.value })}
                                        placeholder={text.nameTemplatePlaceholder}
                                        classNames={inputStyles}
                                    />
                                    <p className="text-xs text-default-600">Variables: <code>{`{user}`}</code>, <code>{`{index}`}</code></p>
                                </div>

                                <div className="space-y-3">
                                    <label className="text-sm font-bold text-default-500 uppercase tracking-wider flex items-center gap-2">
                                        <UsersThree weight="bold" /> {text.userLimitField}
                                    </label>
                                    <Input
                                        type="number"
                                        value={String(form.userLimit)}
                                        onChange={(e) => setForm({ ...form, userLimit: e.target.value })}
                                        classNames={inputStyles}
                                        endContent={<span className="text-xs text-default-500 font-mono">USERS</span>}
                                    />
                                    <div className="flex flex-wrap gap-2">
                                        {limitPresets.map(limit => (
                                            <button
                                                key={limit}
                                                onClick={() => setForm(prev => ({ ...prev, userLimit: String(limit) }))}
                                                className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors border ${String(form.userLimit) === String(limit)
                                                        ? "bg-secondary/20 text-secondary border-secondary/50"
                                                        : "bg-[#0A0B0E] text-default-500 border-white/5 hover:bg-white/5"
                                                    }`}
                                            >
                                                {limit === 0 ? "∞" : limit}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </CardBody>
                    </Card>

                    <Button
                        size="lg"
                        color="primary"
                        onPress={handleSave}
                        isLoading={saving}
                        className="w-full h-16 rounded-2xl text-lg font-bold shadow-lg shadow-primary/20"
                        startContent={!saving && <FloppyDisk size={24} weight="fill" />}
                    >
                        {text.save}
                    </Button>
                </div>

                {/* Column 2: Status & Actions (Span 1) */}
                <div className="space-y-6">

                    {/* Status Card */}
                    <Card className="bg-[#181A20] border border-white/5 shadow-xl rounded-[32px]">
                        <CardBody className="p-6">
                            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                                <Sparkle weight="fill" className="text-yellow-500" /> {text.statusTitle}
                            </h3>

                            <div className="space-y-4">
                                <div className="bg-[#0A0B0E] p-4 rounded-2xl border border-white/5 flex justify-between items-center group">
                                    <span className="text-default-500 font-medium text-sm">{text.statusRooms}</span>
                                    <span className="text-2xl font-black text-white group-hover:scale-110 transition-transform">{roomsCount}</span>
                                </div>

                                <div className="space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-default-500">Hub</span>
                                        <span className={`font-bold ${config?.hubChannelId ? 'text-emerald-500' : 'text-default-400'}`}>
                                            {config?.hubChannelId ? 'Linked' : 'Missing'}
                                        </span>
                                    </div>
                                    <div className="h-1.5 w-full bg-[#0A0B0E] rounded-full overflow-hidden">
                                        <div className={`h-full transition-all ${config?.hubChannelId ? 'bg-emerald-500 w-full' : 'bg-default-800 w-0'}`} />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-default-500">Interface</span>
                                        <span className={`font-bold ${config?.interfaceChannelId ? 'text-emerald-500' : 'text-default-400'}`}>
                                            {config?.interfaceChannelId ? 'Linked' : 'Missing'}
                                        </span>
                                    </div>
                                    <div className="h-1.5 w-full bg-[#0A0B0E] rounded-full overflow-hidden">
                                        <div className={`h-full transition-all ${config?.interfaceChannelId ? 'bg-emerald-500 w-full' : 'bg-default-800 w-0'}`} />
                                    </div>
                                </div>
                            </div>
                        </CardBody>
                    </Card>

                    {/* Actions Card */}
                    {config && (
                        <Card className="bg-gradient-to-br from-violet-600/10 to-transparent border border-violet-500/20 shadow-xl rounded-[32px]">
                            <CardBody className="p-6">
                                <Desktop size={32} weight="fill" className="text-violet-400 mb-4" />
                                <h3 className="text-lg font-bold text-white mb-2">{text.sendPanel}</h3>
                                <p className="text-default-500 text-sm mb-4">{text.sendPanelDesc}</p>
                                <Button
                                    onPress={handleSendPanel}
                                    isLoading={sendingPanel}
                                    className="bg-violet-500 text-white font-bold w-full rounded-xl shadow-lg shadow-violet-500/20"
                                >
                                    Send Message
                                </Button>
                            </CardBody>
                        </Card>
                    )}

                    {/* Danger Zone */}
                    {config && (
                        <Card className="bg-rose-950/20 border border-rose-500/20 shadow-xl rounded-[32px]">
                            <CardBody className="p-6">
                                <h3 className="text-lg font-bold text-rose-500 mb-2">{text.dangerTitle}</h3>
                                <p className="text-rose-400/80 text-sm mb-4 leading-relaxed">{text.dangerDesc}</p>

                                <Input
                                    placeholder={text.confirmPlaceholder}
                                    value={deleteConfirm}
                                    onChange={(e) => setDeleteConfirm(e.target.value)}
                                    classNames={{
                                        inputWrapper: "bg-rose-950/40 border border-rose-500/30 mb-3",
                                        input: "text-rose-200 placeholder:text-rose-500/30 font-mono"
                                    }}
                                />

                                <Button
                                    onPress={handleDelete}
                                    isLoading={deleting}
                                    isDisabled={deleteConfirm.toUpperCase() !== 'DELETE'}
                                    className="bg-rose-500 text-white font-bold w-full rounded-xl shadow-lg shadow-rose-500/20 disabled:bg-rose-500/20 disabled:text-rose-500/50"
                                    startContent={<TrashSimple weight="fill" size={18} />}
                                >
                                    {text.confirmButton}
                                </Button>
                            </CardBody>
                        </Card>
                    )}

                </div>
            </div>
        </div>
    );
}
