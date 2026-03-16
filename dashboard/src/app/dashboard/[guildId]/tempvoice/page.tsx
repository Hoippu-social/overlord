'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { use } from 'react';
import {
    Spinner,
} from '@nextui-org/react';
import {
    ArrowsClockwise,
    TextT,
    UsersThree,
    MicrophoneStage,
    SquaresFour,
    Desktop,
    Kanban,
    GearSix,
    Power,
    Warning,
    TrashSimple,
    ChatTeardropText
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
        title: 'Voice Rooms',
        subtitle: 'Automated temporary voice channels',
        refresh: 'Refresh',
        sendPanel: 'Deploy Control Panel',
        sendPanelDesc: 'Post the room interface message to the text channel.',
        statusConfigured: 'System Online',
        statusNotConfigured: 'Not Configured',
        channelsTitle: 'Infrastructure',
        channelsDesc: 'Configure the parent structural elements.',
        modeCreate: 'Auto-Create',
        modeExisting: 'Manual Link',
        labelCategory: 'Target Category',
        labelHub: 'Hub Voice Channel',
        labelInterface: 'Control Text Channel',
        placeholderCategoryName: 'Temporary Voice',
        placeholderHubName: '➕ Join to Create',
        placeholderInterfaceName: 'voice-controls',
        selectCategory: 'Select Category...',
        selectHub: 'Select Voice Channel...',
        selectInterface: 'Select Text Channel...',
        statusTitle: 'System Status',
        statusRooms: 'Active Rooms',
        nameTemplateLabel: 'Room Template',
        userLimitLabel: 'User Limit',
        roomsTitle: 'Room Policies',
        roomsDesc: 'Default behavior for generated rooms.',
        nameTemplateField: 'Naming Pattern',
        nameTemplatePlaceholder: '{user}\'s Room',
        userLimitField: 'Max Capacity',
        userLimitPlaceholder: '0 = Unlimited',
        userLimitHint: 'Set to 0 for unlimited slots.',
        save: 'Save Configuration',
        delete: 'Tear Down System',
        deleteTooltip: 'This will delete the configuration and optionally the channels.',
        dangerTitle: 'Danger Zone',
        dangerDesc: 'Irreversible action. This will wipe the voice room configuration.',
        confirmPlaceholder: 'Type DELETE',
        confirmButton: 'Delete System',
        errorLoad: 'Failed to load settings',
        errorSave: 'Failed to save settings',
        errorSendPanel: 'Failed to deploy panel',
        errorDelete: 'Failed to delete system',
        errorMissingChannels: 'Please fill in all channel fields',
        errorMissingPanel: 'Configuration incomplete',
        errorConfirmDelete: 'Incorrect confirmation text',
        defaultCategoryName: 'Temporary Voice',
        defaultHubName: 'Join to Create',
        defaultInterfaceName: 'voice-controls',
        defaultNameTemplate: '{user}\'s Room',
        noLimit: 'Unlimited',
    },
    ru: {
        title: 'Голосовые комнаты',
        subtitle: 'Автоматические временные каналы',
        refresh: 'Обновить',
        sendPanel: 'Развернуть Панель',
        sendPanelDesc: 'Отправить сообщение управления в текстовый канал.',
        statusConfigured: 'Система Онлайн',
        statusNotConfigured: 'Не настроено',
        channelsTitle: 'Инфраструктура',
        channelsDesc: 'Настройте родительские структурные элементы.',
        modeCreate: 'Авто-создание',
        modeExisting: 'Ручная привязка',
        labelCategory: 'Целевая Категория',
        labelHub: 'Хаб (Голосовой Канал)',
        labelInterface: 'Управление (Текстовый Канал)',
        placeholderCategoryName: 'Временные каналы',
        placeholderHubName: '➕ Создать комнату',
        placeholderInterfaceName: 'управление-войсом',
        selectCategory: 'Выберите категорию...',
        selectHub: 'Выберите голосовой канал...',
        selectInterface: 'Выберите текстовый канал...',
        statusTitle: 'Статус Системы',
        statusRooms: 'Активных комнат',
        nameTemplateLabel: 'Шаблон имени',
        userLimitLabel: 'Лимит мест',
        roomsTitle: 'Политики Комнат',
        roomsDesc: 'Поведение по умолчанию для новых комнат.',
        nameTemplateField: 'Паттерн Названия',
        nameTemplatePlaceholder: 'Комната {user}',
        userLimitField: 'Макс. Вместимость',
        userLimitPlaceholder: '0 = Без лимита',
        userLimitHint: '0 означает отсутствие ограничений.',
        save: 'Сохранить Конфигурацию',
        delete: 'Удалить Систему',
        deleteTooltip: 'Это удалит конфигурацию и созданные каналы.',
        dangerTitle: 'Опасная Зона',
        dangerDesc: 'Необратимое действие. Конфигурация комнат будет удалена.',
        confirmPlaceholder: 'Введите DELETE',
        confirmButton: 'Удалить систему',
        errorLoad: 'Ошибка загрузки',
        errorSave: 'Ошибка сохранения',
        errorSendPanel: 'Ошибка развертывания панели',
        errorDelete: 'Ошибка удаления',
        errorMissingChannels: 'Заполните все поля каналов',
        errorMissingPanel: 'Конфигурация не завершена',
        errorConfirmDelete: 'Неверный текст подтверждения',
        defaultCategoryName: 'Временные каналы',
        defaultHubName: 'Создать комнату',
        defaultInterfaceName: 'управление-войсом',
        defaultNameTemplate: 'Комната {user}',
        noLimit: 'Без лимита',
    },
} as const;

export default function TempVoicePage({ params }: { params: Promise<{ guildId: string }> }) {
    const { guildId } = use(params);
    const { locale } = useGuildLocale(guildId);
    const text = strings[locale] || strings.en;

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
        } catch {
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
        } catch {
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
        } catch {
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
        } catch {
            setError(text.errorDelete);
        } finally {
            setDeleting(false);
        }
    };

    // Shared UI classes
    const cardClass = "bg-[var(--surface-card)] border border-[var(--border-subtle)] rounded-[24px] p-6 shadow-sm";
    const headerIconClass = "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-inner";

    return (
        <div className="space-y-6 pb-12 animate-fade-in max-w-[1200px] mx-auto w-full">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 py-4">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-[var(--color-primary-1)]/10 text-[var(--color-primary-1)] flex items-center justify-center border border-[var(--color-primary-1)]/20 shadow-[0_0_15px_rgba(117,241,106,0.1)]">
                        <MicrophoneStage size={28} weight="duotone" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-white tracking-tight">{text.title}</h1>
                        <p className="text-[var(--text-muted)] text-sm mt-0.5">{text.subtitle}</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {config && (
                        <div className="px-3 py-1.5 rounded-full bg-[var(--color-primary-1)]/10 border border-[var(--color-primary-1)]/20 text-[var(--color-primary-1)] flex items-center gap-2 text-xs font-bold shadow-sm">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--color-primary-1)] opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--color-primary-1)]"></span>
                            </span>
                            {text.statusConfigured}
                        </div>
                    )}
                    <button onClick={fetchData} disabled={loading} className="w-10 h-10 rounded-full bg-[var(--surface-card)] border border-[var(--border-subtle)] hover:bg-[var(--surface-hover)] text-[var(--text-secondary)] hover:text-white transition-colors flex items-center justify-center disabled:opacity-50">
                        <ArrowsClockwise size={20} className={loading ? "animate-spin" : ""} />
                    </button>
                    <button onClick={handleSave} disabled={saving} className="h-10 px-5 rounded-full bg-[var(--color-primary-1)] text-black font-bold text-sm shadow-[0_0_20px_rgba(117,241,106,0.2)] hover:bg-[#86f27d] transition-colors flex items-center justify-center disabled:opacity-50">
                        {saving ? <Spinner size="sm" color="default" className="text-black" /> : text.save}
                    </button>
                </div>
            </div>

            {error && (
                <div className="bg-[var(--color-destructive)]/10 border border-[var(--color-destructive)]/20 text-[var(--color-destructive)] p-4 rounded-2xl flex items-center gap-3 text-sm font-bold">
                    <Warning size={20} weight="fill" />
                    {error}
                </div>
            )}

            {/* Jira-style Board Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

                {/* Column 1: Infrastructure (Jira Ticket Like) */}
                <div className="lg:col-span-2 space-y-6">
                    <div className={cardClass}>
                        <div className="flex items-center justify-between mb-8 border-b border-[var(--border-divider)] pb-6">
                            <div className="flex items-center gap-4">
                                <div className={`${headerIconClass} bg-[#3b82f6]/10 text-[#3b82f6]`}>
                                    <Kanban size={20} weight="duotone" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-white">{text.channelsTitle}</h2>
                                    <p className="text-xs text-[var(--text-muted)] mt-1">{text.channelsDesc}</p>
                                </div>
                            </div>

                            <div className="flex bg-[var(--surface-hover)] p-1 rounded-xl border border-[var(--border-divider)]">
                                <button
                                    onClick={() => setMode('create')}
                                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${mode === 'create' ? 'bg-[var(--surface-card)] text-white shadow-sm' : 'text-[var(--text-muted)] hover:text-white'}`}
                                >
                                    {text.modeCreate}
                                </button>
                                <button
                                    onClick={() => setMode('existing')}
                                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${mode === 'existing' ? 'bg-[var(--surface-card)] text-white shadow-sm' : 'text-[var(--text-muted)] hover:text-white'}`}
                                >
                                    {text.modeExisting}
                                </button>
                            </div>
                        </div>

                        <div className="space-y-6">
                            {/* Category Ticket */}
                            <div className="bg-[var(--surface-hover)] border border-[var(--border-divider)] rounded-2xl p-4 flex flex-col md:flex-row md:items-center gap-4 group">
                                <div className="w-10 h-10 rounded-full bg-[#1e293b] flex items-center justify-center shrink-0 border border-white/5 group-hover:border-[#3b82f6]/30 transition-colors">
                                    <SquaresFour size={20} className="text-[#94a3b8]" weight="duotone" />
                                </div>
                                <div className="flex-1 space-y-2">
                                    <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">{text.labelCategory}</label>
                                    {mode === 'create' ? (
                                        <input
                                            value={form.categoryName}
                                            onChange={(e) => setForm({ ...form, categoryName: e.target.value })}
                                            placeholder={text.placeholderCategoryName}
                                            className="w-full bg-transparent border-0 border-b border-[var(--border-subtle)] focus:border-[#3b82f6] text-white text-sm pb-1 outline-none transition-colors"
                                        />
                                    ) : (
                                        <select
                                            value={form.categoryId}
                                            onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                                            className="w-full bg-transparent border-0 border-b border-[var(--border-subtle)] focus:border-[#3b82f6] text-white text-sm pb-1 outline-none transition-colors appearance-none cursor-pointer"
                                        >
                                            <option value="" disabled className="bg-[#111]">{text.selectCategory}</option>
                                            {channels.categories.map(c => <option key={c.id} value={c.id} className="bg-[#111]">{c.name || c.id}</option>)}
                                        </select>
                                    )}
                                </div>
                            </div>

                            {/* Hub Ticket */}
                            <div className="bg-[var(--surface-hover)] border border-[var(--border-divider)] rounded-2xl p-4 flex flex-col md:flex-row md:items-center gap-4 group">
                                <div className="w-10 h-10 rounded-full bg-[#1e293b] flex items-center justify-center shrink-0 border border-white/5 group-hover:border-[var(--color-primary-1)]/30 transition-colors">
                                    <MicrophoneStage size={20} className="text-[#94a3b8]" weight="duotone" />
                                </div>
                                <div className="flex-1 space-y-2">
                                    <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">{text.labelHub}</label>
                                    {mode === 'create' ? (
                                        <input
                                            value={form.hubName}
                                            onChange={(e) => setForm({ ...form, hubName: e.target.value })}
                                            placeholder={text.placeholderHubName}
                                            className="w-full bg-transparent border-0 border-b border-[var(--border-subtle)] focus:border-[var(--color-primary-1)] text-white text-sm pb-1 outline-none transition-colors"
                                        />
                                    ) : (
                                        <select
                                            value={form.hubChannelId}
                                            onChange={(e) => setForm({ ...form, hubChannelId: e.target.value })}
                                            className="w-full bg-transparent border-0 border-b border-[var(--border-subtle)] focus:border-[var(--color-primary-1)] text-white text-sm pb-1 outline-none transition-colors appearance-none cursor-pointer"
                                        >
                                            <option value="" disabled className="bg-[#111]">{text.selectHub}</option>
                                            {channels.voice.map(c => <option key={c.id} value={c.id} className="bg-[#111]">{c.name || c.id}</option>)}
                                        </select>
                                    )}
                                </div>
                            </div>

                            {/* Interface Ticket */}
                            <div className="bg-[var(--surface-hover)] border border-[var(--border-divider)] rounded-2xl p-4 flex flex-col md:flex-row md:items-center gap-4 group">
                                <div className="w-10 h-10 rounded-full bg-[#1e293b] flex items-center justify-center shrink-0 border border-white/5 group-hover:border-[var(--color-primary-2)]/30 transition-colors">
                                    <ChatTeardropText size={20} className="text-[#94a3b8]" weight="duotone" />
                                </div>
                                <div className="flex-1 space-y-2">
                                    <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">{text.labelInterface}</label>
                                    {mode === 'create' ? (
                                        <input
                                            value={form.interfaceName}
                                            onChange={(e) => setForm({ ...form, interfaceName: e.target.value })}
                                            placeholder={text.placeholderInterfaceName}
                                            className="w-full bg-transparent border-0 border-b border-[var(--border-subtle)] focus:border-[var(--color-primary-2)] text-white text-sm pb-1 outline-none transition-colors"
                                        />
                                    ) : (
                                        <select
                                            value={form.interfaceChannelId}
                                            onChange={(e) => setForm({ ...form, interfaceChannelId: e.target.value })}
                                            className="w-full bg-transparent border-0 border-b border-[var(--border-subtle)] focus:border-[var(--color-primary-2)] text-white text-sm pb-1 outline-none transition-colors appearance-none cursor-pointer"
                                        >
                                            <option value="" disabled className="bg-[#111]">{text.selectInterface}</option>
                                            {channels.text.map(c => <option key={c.id} value={c.id} className="bg-[#111]">{c.name || c.id}</option>)}
                                        </select>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Room Settings */}
                    <div className={cardClass}>
                        <div className="flex items-center gap-4 mb-6 border-b border-[var(--border-divider)] pb-4">
                            <div className={`${headerIconClass} bg-[var(--color-warning)]/10 text-[var(--color-warning)]`}>
                                <GearSix size={20} weight="duotone" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-white">{text.roomsTitle}</h2>
                                <p className="text-xs text-[var(--text-muted)] mt-1">{text.roomsDesc}</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2 group">
                                <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">{text.nameTemplateField}</label>
                                <div className="bg-[var(--surface-hover)] border border-[var(--border-divider)] group-focus-within:border-[var(--color-warning)]/50 rounded-xl px-4 py-3 transition-colors">
                                    <input
                                        value={form.nameTemplate}
                                        onChange={(e) => setForm({ ...form, nameTemplate: e.target.value })}
                                        placeholder={text.nameTemplatePlaceholder}
                                        className="w-full bg-transparent border-none text-white text-sm outline-none"
                                    />
                                </div>
                                <p className="text-[10px] text-[var(--text-muted)] pt-1">Variables: <code className="text-[#94a3b8] bg-[#1e293b] px-1 py-0.5 rounded">{`{user}`}</code>, <code className="text-[#94a3b8] bg-[#1e293b] px-1 py-0.5 rounded">{`{index}`}</code></p>
                            </div>

                            <div className="space-y-2 group">
                                <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">{text.userLimitField}</label>
                                <div className="bg-[var(--surface-hover)] border border-[var(--border-divider)] group-focus-within:border-[var(--color-warning)]/50 rounded-xl px-4 py-3 transition-colors flex items-center">
                                    <input
                                        type="number"
                                        value={String(form.userLimit)}
                                        onChange={(e) => setForm({ ...form, userLimit: e.target.value })}
                                        className="w-full bg-transparent border-none text-white text-sm font-mono tabular-nums outline-none"
                                    />
                                    <UsersThree size={16} className="text-[var(--text-muted)]" />
                                </div>
                                <div className="flex flex-wrap gap-1.5 pt-1">
                                    {limitPresets.map(limit => (
                                        <button
                                            key={limit}
                                            onClick={() => setForm(prev => ({ ...prev, userLimit: String(limit) }))}
                                            className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors border ${String(form.userLimit) === String(limit)
                                                ? "bg-[var(--color-warning)]/20 text-[var(--color-warning)] border-[var(--color-warning)]/30"
                                                : "bg-[var(--surface-hover)] text-[var(--text-muted)] border-[var(--border-divider)] hover:text-white hover:border-[var(--border-subtle)]"
                                                }`}
                                        >
                                            {limit === 0 ? "∞" : limit}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Column 2: Status & Dangerous Actions */}
                <div className="space-y-6">
                    {/* Metrics/Status Card */}
                    <div className={`${cardClass} bg-[#111] overflow-hidden relative`}>
                        {/* Decorative background pulse if rooms exist */}
                        {roomsCount > 0 && <div className="absolute top-0 right-0 -mr-6 -mt-6 w-32 h-32 bg-[var(--color-primary-1)]/10 blur-[40px] rounded-full point-events-none" />}

                        <h3 className="text-sm font-bold text-[var(--text-muted)] uppercase tracking-widest mb-6 flex items-center gap-2">
                            <Power size={16} /> {text.statusTitle}
                        </h3>

                        <div className="flex items-end justify-between mb-8 cursor-default group">
                            <span className="text-sm font-bold text-[var(--text-secondary)]">{text.statusRooms}</span>
                            <span className="text-5xl font-black font-akony text-[var(--text-primary)] transition-transform group-hover:scale-105 origin-right">{roomsCount}</span>
                        </div>

                        <div className="space-y-4 pt-4 border-t border-[var(--border-divider)]">
                            <div className="flex items-center justify-between text-xs font-bold">
                                <span className="text-[var(--text-muted)] uppercase tracking-wider">Hub</span>
                                <span className={`flex items-center gap-1.5 ${config?.hubChannelId ? 'text-[var(--color-primary-1)]' : 'text-[var(--text-muted)]'}`}>
                                    <div className={`w-1.5 h-1.5 rounded-full ${config?.hubChannelId ? 'bg-[var(--color-primary-1)] shadow-[0_0_8px_currentColor]' : 'bg-[var(--text-muted)]'}`}></div>
                                    {config?.hubChannelId ? 'Linked' : 'Missing'}
                                </span>
                            </div>
                            <div className="flex items-center justify-between text-xs font-bold">
                                <span className="text-[var(--text-muted)] uppercase tracking-wider">Interface</span>
                                <span className={`flex items-center gap-1.5 ${config?.interfaceChannelId ? 'text-[var(--color-primary-1)]' : 'text-[var(--text-muted)]'}`}>
                                    <div className={`w-1.5 h-1.5 rounded-full ${config?.interfaceChannelId ? 'bg-[var(--color-primary-1)] shadow-[0_0_8px_currentColor]' : 'bg-[var(--text-muted)]'}`}></div>
                                    {config?.interfaceChannelId ? 'Linked' : 'Missing'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Deploy Action */}
                    {config && (
                        <div className={`${cardClass} border-[var(--color-primary-2)]/20 shadow-[0_4px_30px_rgba(143,94,255,0.05)]`}>
                            <h3 className="text-lg font-bold text-white mb-2">{text.sendPanel}</h3>
                            <p className="text-[var(--text-muted)] text-xs mb-4">{text.sendPanelDesc}</p>
                            <button
                                onClick={handleSendPanel}
                                disabled={sendingPanel}
                                className="w-full h-10 rounded-xl bg-[var(--color-primary-2)] text-white font-bold text-sm hover:bg-[#a67cff] transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {sendingPanel ? <Spinner size="sm" color="white" /> : <Desktop size={16} weight="bold" />}
                                {sendingPanel ? 'Deploying...' : text.sendPanel}
                            </button>
                        </div>
                    )}

                    {/* Danger Zone */}
                    {config && (
                        <div className={`${cardClass} border-[var(--color-destructive)]/30 bg-[#180a0d]`}>
                            <h3 className="text-lg font-bold text-[var(--color-destructive)] mb-2 flex items-center gap-2">
                                <Warning size={18} weight="fill" />
                                {text.dangerTitle}
                            </h3>
                            <p className="text-[var(--color-destructive)]/70 text-xs mb-4">{text.dangerDesc}</p>

                            <input
                                placeholder={text.confirmPlaceholder}
                                value={deleteConfirm}
                                onChange={(e) => setDeleteConfirm(e.target.value)}
                                className="w-full bg-black/50 border border-[var(--color-destructive)]/30 rounded-xl h-10 px-4 text-xs font-mono text-[var(--color-destructive)] placeholder-[var(--color-destructive)]/30 outline-none focus:border-[var(--color-destructive)] transition-colors mb-3"
                            />

                            <button
                                onClick={handleDelete}
                                disabled={deleting || deleteConfirm.toUpperCase() !== 'DELETE'}
                                className="w-full h-10 rounded-xl bg-[var(--color-destructive)] text-white font-bold text-sm hover:bg-[#ff4d6d] transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:bg-[#331118] disabled:text-[#ff4d6d]/50"
                            >
                                {deleting ? <Spinner size="sm" color="white" /> : <TrashSimple size={16} weight="bold" />}
                                {text.confirmButton}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
