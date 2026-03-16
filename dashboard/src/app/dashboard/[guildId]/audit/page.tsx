'use client';

import React, { useEffect, useMemo, useState, useRef } from 'react';
import {
    Card,
    CardHeader,
    CardBody,
    Chip,
    ScrollShadow,
    Divider,
    Select,
    SelectItem,
    Switch,
    Button,
    Tooltip,
    Autocomplete,
    AutocompleteItem,
    Avatar
} from '@nextui-org/react';
import {
    Plus, Trash, Circle, Hash, Shield, EnvelopeSimple, MagnifyingGlass, WarningCircle, CheckCircle, Warning, UserPlus, IdentificationBadge, SpeakerHigh, UserMinus, ShieldCheck, Door, MonitorPlay, UsersThree, Info, Key, Clock, ShieldStar, Eye, UserCircle, Wrench, X, AppWindow, Users, ChatsCircle, Crown, ChatCircleText, Robot, CaretRight, Folder, Lock, Scroll
} from "@phosphor-icons/react";
import { useParams } from 'next/navigation';
import { useGuildLocale, useGuildTimezone } from '@/lib/i18n';
import { SectionBlock } from '@/components/SectionBlock';

type AuditEvent = {
    id: number;
    guildId: string;
    tag: string;
    actorId?: string | null;
    targetId?: string | null;
    channelId?: string | null;
    messageId?: string | null;
    payload?: any;
    severity?: string | null;
    createdAt: string;
};

type Route = {
    id: number;
    guildId: string;
    tag: string;
    channelId: string;
    enabled: boolean;
    template?: string | null;
    createdAt: string;
    updatedAt: string;
};

type Channel = { id: string; name?: string | null; type?: number | string | null };

type EnrichedUser = {
    id: string;
    name: string;
    username?: string;
    tag?: string;
    avatar: string | null;
};

const TAGS = [
    { value: 'moderation', label: 'Moderation', icon: ShieldCheck },
    { value: 'member', label: 'Member', icon: Users },
    { value: 'message', label: 'Message', icon: ChatCircleText },
    { value: 'channel', label: 'Channel', icon: Hash },
    { value: 'role', label: 'Role', icon: IdentificationBadge },
    { value: 'voice', label: 'Voice', icon: SpeakerHigh },
    { value: 'invites', label: 'Invites', icon: UserPlus },
    { value: 'security', label: 'Security', icon: Lock },
    { value: 'bot', label: 'Bot', icon: Robot },
];

const TAG_ICONS: Record<string, any> = TAGS.reduce((acc, tag) => ({ ...acc, [tag.value]: tag.icon }), {});

const strings = {
    en: {
        title: 'Audit Log',
        routes: 'Active routes',
        routesDesc: 'Map audit tags to Discord channels',
        noRoutes: 'No routes configured.',
        events: 'Recent activity',
        eventsDesc: 'Last 50 audit events (auto-updates)',
        noEvents: 'No events yet.',
        tag: 'Tag',
        channel: 'Channel',
        enable: 'Enable',
        disable: 'Disable',
        saveRoute: 'Save route',
        deleteRoute: 'Delete route',
        selectTag: 'Select tag',
        selectChannel: 'Select channel',
        attachments: 'Attachments',
        addRoute: 'Add New Route',
        from: 'From',
        to: 'To',
        user: 'User',
        deletedBy: 'Deleted By',
        messageAuthor: 'Message Author',
        reason: 'Reason',
        until: 'Timeout Until',
        status: 'Status',
        details: 'Details',
        duration: 'Duration',
    },
    ru: {
        title: 'Журнал аудита',
        routes: 'Активные маршруты',
        routesDesc: 'Связка тегов аудита с каналами Discord',
        noRoutes: 'Маршруты не настроены.',
        events: 'Недавняя активность',
        eventsDesc: 'Последние 50 событий (обновляется автоматически)',
        noEvents: 'Событий пока нет.',
        tag: 'Тег',
        channel: 'Канал',
        enable: 'Включить',
        disable: 'Выключить',
        saveRoute: 'Сохранить маршрут',
        deleteRoute: 'Удалить маршрут',
        selectTag: 'Выберите тег',
        selectChannel: 'Выберите канал',
        attachments: 'Вложения',
        addRoute: 'Добавить маршрут',
        from: 'Отправитель',
        to: 'Получатель',
        user: 'Пользователь',
        deletedBy: 'Удалил',
        messageAuthor: 'Автор сообщения',
        reason: 'Причина',
        until: 'Таймаут до',
        status: 'Статус',
        details: 'Детали',
        duration: 'Длительность',
    },
} as const;

const severityConfig: Record<string, { color: string; bgColor: string; icon: any }> = {
    INFO: { color: 'text-blue-400', bgColor: 'bg-blue-400/10', icon: Info },
    WARN: { color: 'text-amber-400', bgColor: 'bg-amber-400/10', icon: WarningCircle },
    ERROR: { color: 'text-rose-400', bgColor: 'bg-rose-400/10', icon: Warning },
};

function ListItem({
    icon: Icon,
    iconColor = "text-[var(--text-primary)]",
    label,
    value,
    subvalue,
    rightElement,
    onClick
}: {
    icon?: any;
    iconColor?: string;
    label: string | React.ReactNode;
    value?: string | React.ReactNode;
    subvalue?: string;
    rightElement?: React.ReactNode;
    onClick?: () => void;
}) {
    return (
        <div
            className={`flex items-center gap-4 p-3 rounded-xl transition-all border border-transparent ${onClick ? 'cursor-pointer hover:bg-[var(--surface-hover)] active:bg-[var(--surface-card)]' : ''}`}
            onClick={onClick}
        >
            {Icon && (
                <div className={`w-10 h-10 rounded-xl bg-[var(--surface-card)] border border-[var(--border-subtle)] flex items-center justify-center shrink-0 ${iconColor}`}>
                    <Icon size={20} weight="duotone" />
                </div>
            )}
            <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-[var(--text-primary)] truncate">{label}</div>
                {subvalue && <div className="text-xs text-[var(--text-muted)] truncate mt-0.5">{subvalue}</div>}
            </div>
            {(value || rightElement) && (
                <div className="flex items-center gap-2">
                    {value && <div className="text-sm text-[var(--text-secondary)]">{value}</div>}
                    {rightElement}
                    {onClick && !rightElement && <CaretRight size={16} className="text-[var(--text-muted)]" />}
                </div>
            )}
        </div>
    );
}

function renderAttachments(label: string, items?: any[]) {
    if (!items || !items.length) return null;
    return (
        <div className="text-xs text-[var(--text-muted)] mt-3 space-y-2 bg-[var(--surface-sidebar)] p-3 rounded-xl border border-[var(--border-divider)]">
            <div className="font-bold text-[var(--text-secondary)] uppercase tracking-widest text-[10px]">{label}</div>
            <div className="flex flex-wrap gap-2">
                {items.map((att: any) => (
                    <a
                        key={att.id || att.url}
                        className="flex items-center gap-2 text-[var(--color-primary-1)] hover:text-white bg-[var(--color-primary-1)]/10 hover:bg-[var(--color-primary-1)]/20 px-3 py-1.5 rounded-lg max-w-full truncate transition-colors"
                        href={att.url || att.proxyUrl}
                        target="_blank"
                        rel="noreferrer"
                    >
                        <span className="truncate text-sm font-medium">{att.name || 'Attachment'}</span>
                    </a>
                ))}
            </div>
        </div>
    );
}

export default function AuditPage() {
    const params = useParams<{ guildId: string }>();
    const guildId = params.guildId;
    const { locale } = useGuildLocale(guildId);
    const guildTimezone = useGuildTimezone(guildId);
    const text = strings[locale] || strings.en;

    const [events, setEvents] = useState<AuditEvent[]>([]);
    const [routes, setRoutes] = useState<Route[]>([]);
    const [channels, setChannels] = useState<Channel[]>([]);
    const [allChannels, setAllChannels] = useState<Channel[]>([]);
    const [enrichedUsers, setEnrichedUsers] = useState<Record<string, EnrichedUser>>({});
    const [enrichedChannels, setEnrichedChannels] = useState<Record<string, Channel>>({});
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const [selectedTag, setSelectedTag] = useState(TAGS[0].value);
    const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
    const [enabled, setEnabled] = useState(true);
    const [mounted, setMounted] = useState(false);
    const isDirty = useRef(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const getChannelName = (id: string) => {
        return enrichedChannels[id]?.name || allChannels.find(c => c.id === id)?.name || id;
    };

    const fmtDate = (value: string) => {
        const d = new Date(value);
        return d.toLocaleTimeString(locale === 'ru' ? 'ru-RU' : 'en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
            timeZone: guildTimezone
        });
    };

    const loadData = async () => {
        try {
            const [evRes, routeRes, textChRes, voiceChRes] = await Promise.all([
                fetch(`/api/guilds/${guildId}/audit/events?limit=50`),
                fetch(`/api/guilds/${guildId}/audit/routes`),
                fetch(`/api/guilds/${guildId}/text-channels`),
                fetch(`/api/guilds/${guildId}/channels`),
            ]);

            if (!evRes.ok || !routeRes.ok) {
                throw new Error(`Failed: events ${evRes.status}, routes ${routeRes.status}`);
            }

            const evData = await evRes.json();
            const routeData = await routeRes.json();
            const textChannels: Channel[] = textChRes.ok ? (await textChRes.json()) : [];
            const voiceChannels: Channel[] = voiceChRes.ok ? (await voiceChRes.json()) : [];

            const merged = new Map<string, Channel>();
            [...(Array.isArray(textChannels) ? textChannels : []),
            ...(Array.isArray(voiceChannels) ? voiceChannels : [])].forEach(c => merged.set(c.id, c));
            const allCh = Array.from(merged.values());

            setEvents(evData.events || []);
            setRoutes(routeData.routes || []);
            setChannels(Array.isArray(textChannels) ? textChannels : []);
            setAllChannels(allCh);

            const eventsData: AuditEvent[] = evData.events || [];
            const userIds = [...new Set(eventsData.flatMap(ev => [ev.actorId, ev.targetId].filter(Boolean) as string[]))];
            const channelIds = [...new Set([
                ...eventsData.map(ev => ev.channelId).filter(Boolean),
                ...routeData.routes?.map((r: Route) => r.channelId).filter(Boolean)
            ] as string[])];

            if (userIds.length > 0 || channelIds.length > 0) {
                try {
                    const enrichRes = await fetch(`/api/guilds/${guildId}/enrich`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ userIds, channelIds }),
                    });
                    if (enrichRes.ok) {
                        const enrichData = await enrichRes.json();
                        if (enrichData.users) {
                            setEnrichedUsers(prev => ({ ...prev, ...enrichData.users }));
                        }
                        if (enrichData.channels) {
                            setEnrichedChannels(prev => ({ ...prev, ...enrichData.channels }));
                        }
                    }
                } catch { /* enrich is best-effort */ }
            }

        } catch (err: any) {
            setError(err.message || 'Failed to load audit data');
        }
    };

    useEffect(() => {
        loadData();
        const id = setInterval(loadData, 5000);
        return () => clearInterval(id);
    }, [guildId]);

    const currentRoutesMap = useMemo(() => {
        const map = new Map<string, Route>();
        routes.forEach((r) => map.set(r.tag, r));
        return map;
    }, [routes]);

    useEffect(() => {
        if (isDirty.current) return;

        const r = currentRoutesMap.get(selectedTag);
        if (r) {
            setSelectedChannelId(r.channelId);
            setEnabled(r.enabled);
        } else {
            setSelectedChannelId(null);
            setEnabled(true);
        }
    }, [selectedTag, currentRoutesMap]);

    const saveRoute = async () => {
        if (!selectedChannelId) return;
        setSaving(true);
        try {
            await fetch(`/api/guilds/${guildId}/audit/routes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tag: selectedTag,
                    channelId: selectedChannelId,
                    enabled,
                }),
            });
            await loadData();
            isDirty.current = false;
        } finally {
            setSaving(false);
        }
    };

    const deleteRoute = async (tag: string) => {
        setSaving(true);
        try {
            await fetch(`/api/guilds/${guildId}/audit/routes`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tag }),
            });
            await loadData();
        } finally {
            setSaving(false);
        }
    };

    const toggleRouteEnabled = async (route: Route) => {
        setSaving(true);
        try {
            await fetch(`/api/guilds/${guildId}/audit/routes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    enabled: !route.enabled,
                    tag: route.tag,
                    channelId: route.channelId
                }),
            });
            await loadData();
        } finally {
            setSaving(false);
        }
    };

    if (!mounted) return null;

    return (
        <div className="space-y-6 pb-10 animate-fade-in">

            {error && (
                <div className="bg-[var(--color-destructive)]/10 border border-[var(--color-destructive)]/20 rounded-2xl p-4 flex items-center gap-3">
                    <WarningCircle size={20} weight="fill" className="text-[var(--color-destructive)]" />
                    <div className="text-[var(--color-destructive)] text-sm font-medium">{error}</div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Left Column: Configuration */}
                <div className="lg:col-span-5 space-y-6 lg:sticky lg:top-8">
                    {/* Add Route Form */}
                    <div className="bg-[var(--surface-card)] border border-[var(--border-subtle)] rounded-2xl p-6 space-y-6 shadow-sm">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-[var(--color-primary-2)]/10 flex items-center justify-center text-[var(--color-primary-2)]">
                                <Plus size={20} weight="bold" />
                            </div>
                            <h2 className="text-lg font-bold text-[var(--text-primary)]">{text.addRoute}</h2>
                        </div>

                        <div className="space-y-5">
                            <Select
                                label={text.selectTag}
                                variant="bordered"
                                classNames={{
                                    trigger: "bg-[var(--surface-hover)] border border-[var(--border-subtle)] min-h-[64px] rounded-2xl data-[hover=true]:bg-[var(--surface-hover)] data-[hover=true]:border-[var(--border-focus)] transition-all",
                                    value: "text-lg font-medium pl-2 text-[var(--text-primary)]",
                                    popoverContent: "bg-[var(--surface-card)] border border-[var(--border-subtle)] rounded-2xl shadow-2xl",
                                    listbox: "bg-transparent p-2 gap-1"
                                }}
                                selectedKeys={new Set([selectedTag])}
                                onSelectionChange={(keys) => {
                                    const [val] = Array.from(keys) as string[];
                                    if (val) {
                                        setSelectedTag(val);
                                        isDirty.current = false;
                                    }
                                }}
                                renderValue={(items) => items.map(item => {
                                    const tag = TAGS.find(t => t.value === item.key);
                                    const Icon = tag?.icon || Circle;
                                    return (
                                        <div key={item.key} className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-[var(--surface-sidebar)] border border-[var(--border-divider)] flex items-center justify-center text-[var(--color-primary-1)]"><Icon size={18} weight="duotone" /></div>
                                            <span className="text-[var(--text-primary)] font-medium">{tag?.label}</span>
                                        </div>
                                    );
                                })}
                            >
                                {TAGS.map((tag) => (
                                    <SelectItem key={tag.value} textValue={tag.label} className="rounded-xl data-[hover=true]:bg-[var(--surface-hover)]">
                                        <div className="flex items-center gap-3">
                                            <tag.icon size={20} weight="duotone" className="text-[var(--color-primary-1)]" />
                                            <span className="text-base font-medium">{tag.label}</span>
                                        </div>
                                    </SelectItem>
                                ))}
                            </Select>

                            <Autocomplete
                                label={text.selectChannel}
                                variant="bordered"
                                allowsCustomValue={false}
                                defaultItems={channels}
                                selectedKey={selectedChannelId}
                                onSelectionChange={(key) => {
                                    isDirty.current = true;
                                    setSelectedChannelId(key as string || null);
                                }}
                                classNames={{
                                    base: "w-full",
                                    listboxWrapper: "bg-[var(--surface-hover)] rounded-xl",
                                    popoverContent: "bg-[var(--surface-card)] border border-[var(--border-subtle)] rounded-2xl shadow-2xl",
                                }}
                                inputProps={{
                                    classNames: {
                                        inputWrapper: "bg-[var(--surface-hover)] border border-[var(--border-subtle)] min-h-[64px] rounded-2xl data-[hover=true]:bg-[var(--surface-hover)] data-[hover=true]:border-[var(--border-focus)] transition-all px-4",
                                        label: "hidden",
                                        input: "text-lg font-medium text-[var(--text-primary)] placeholder:text-[var(--text-muted)]",
                                    }
                                }}
                                listboxProps={{
                                    itemClasses: {
                                        base: "rounded-xl data-[hover=true]:bg-[var(--surface-hover)] text-[var(--text-secondary)] data-[hover=true]:text-[var(--text-primary)] p-3",
                                    }
                                }}
                            >
                                {(ch) => (
                                    <AutocompleteItem key={ch.id} textValue={ch.name || ch.id}>
                                        <div className="flex items-center gap-2">
                                            <Hash size={18} className="text-default-400" />
                                            <span className="text-base font-bold">{ch.name || ch.id}</span>
                                        </div>
                                    </AutocompleteItem>
                                )}
                            </Autocomplete>

                            <div className="flex items-center justify-between p-4 bg-[var(--surface-hover)] rounded-2xl border border-[var(--border-divider)]">
                                <span className="font-bold text-[var(--text-muted)] uppercase text-xs tracking-wider ml-1">{text.status}</span>
                                <Switch
                                    isSelected={enabled}
                                    onValueChange={(val) => {
                                        setEnabled(val);
                                        isDirty.current = true;
                                    }}
                                    size="lg"
                                    color="success"
                                    classNames={{ wrapper: "group-data-[selected=true]:bg-[var(--color-primary-1)]" }}
                                />
                            </div>
                            <Button
                                className="w-full h-14 rounded-2xl font-bold text-lg bg-[var(--color-primary-1)] text-black shadow-[0_0_20px_rgba(117,241,106,0.15)] hover:shadow-[0_0_25px_rgba(117,241,106,0.25)] transition-all"
                                isLoading={saving}
                                onPress={saveRoute}
                                startContent={!saving && <CheckCircle weight="fill" size={24} />}
                            >
                                {text.saveRoute}
                            </Button>
                        </div>
                    </div>

                    {/* Active Routes List */}
                    <SectionBlock title={text.routes} description={routes.length > 0 ? `${routes.length} active mappings` : text.noRoutes} noPadding>
                        {routes.length === 0 ? (
                            <div className="p-6 text-center">
                                <p className="text-sm text-white/30">{text.noRoutes}</p>
                            </div>
                        ) : (
                            <div className="p-2 space-y-1">
                                {routes.map((r) => {
                                    const tagInfo = TAGS.find(t => t.value === r.tag);
                                    const ch = channels.find(c => c.id === r.channelId);
                                    return (
                                        <ListItem
                                            key={r.id}
                                            icon={tagInfo?.icon || Circle}
                                            iconColor={r.enabled ? "text-[#75F16A]" : "text-white/20"}
                                            label={tagInfo?.label || r.tag}
                                            subvalue={`#${getChannelName(r.channelId)}`}
                                            rightElement={
                                                <div className="flex items-center gap-2">
                                                    <Switch
                                                        size="sm"
                                                        isSelected={r.enabled}
                                                        onValueChange={() => toggleRouteEnabled(r)}
                                                        isDisabled={saving}
                                                        color="success"
                                                    />
                                                    <Button
                                                        isIconOnly
                                                        variant="light"
                                                        size="sm"
                                                        onPress={() => deleteRoute(r.tag)}
                                                        className="text-[var(--text-muted)] hover:text-[var(--color-destructive)] rounded-lg min-w-8 w-8 h-8"
                                                    >
                                                        <Trash size={16} />
                                                    </Button>
                                                </div>
                                            }
                                        />
                                    );
                                })}
                            </div>
                        )}
                    </SectionBlock>
                </div>

                {/* Right Column: Feed */}
                <div className="lg:col-span-7 space-y-6">
                    <SectionBlock
                        title={text.events}
                        description={text.eventsDesc}
                        action={
                            saving ? (
                                <div className="flex items-center gap-2 px-3 py-1.5 bg-[var(--color-primary-2)]/10 rounded-full">
                                    <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary-2)] animate-pulse" />
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-primary-2)]">Syncing</span>
                                </div>
                            ) : undefined
                        }
                        className="bg-transparent border-none shadow-none"
                    >
                        {events.length === 0 ? (
                            <div className="py-12 text-center flex flex-col items-center">
                                <Clock size={32} className="mb-3 text-[var(--text-muted)]" weight="duotone" />
                                <p className="text-sm text-[var(--text-secondary)]">{text.noEvents}</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {events.map((ev, index) => {
                                    const TagIcon = TAG_ICONS[ev.tag] || Circle;
                                    const sev = ev.severity ? severityConfig[ev.severity] : null;

                                    return (
                                        <div key={ev.id} className="relative pl-12 pb-2 group">
                                            {/* Timeline line */}
                                            {index !== events.length - 1 && (
                                                <div className="absolute left-[11px] top-12 bottom-0 w-[2px] bg-[var(--border-divider)] group-hover:bg-[var(--border-subtle)] transition-colors rounded-full" />
                                            )}

                                            {/* Timeline dot */}
                                            <div className={`absolute left-0 top-3 w-6 h-6 rounded-full border-4 border-[var(--surface-sidebar)] z-10 ${sev ? sev.bgColor.replace('/10', '') : 'bg-[var(--color-primary-1)]'}`} />

                                            <div className="bg-[var(--surface-card)] rounded-[24px] p-6 border border-[var(--border-subtle)] hover:border-[var(--border-focus)] transition-all shadow-md group-hover:shadow-xl group-hover:translate-x-1">
                                                {/* Header */}
                                                <div className="flex items-start justify-between gap-4 mb-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-10 h-10 rounded-xl bg-[var(--surface-hover)] flex items-center justify-center shrink-0 ${sev ? sev.color : 'text-[var(--color-primary-1)]'}`}>
                                                            <TagIcon size={20} weight="duotone" />
                                                        </div>
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-bold text-[var(--text-primary)] text-lg leading-none">
                                                                    {typeof (ev.payload?.event || ev.payload?.action || ev.tag) === 'string'
                                                                        ? (ev.payload?.event || ev.payload?.action || ev.tag).replace(/_/g, ' ')
                                                                        : (ev.payload?.event || ev.payload?.action || ev.tag)}
                                                                </span>
                                                                {sev && (
                                                                    <Chip size="sm" variant="flat" classNames={{ base: `${sev.bgColor} h-5`, content: `${sev.color} font-bold text-[10px] uppercase tracking-wider` }}>
                                                                        {ev.severity}
                                                                    </Chip>
                                                                )}
                                                            </div>
                                                            <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] mt-1 font-mono">
                                                                <span className="uppercase tracking-wider font-bold text-[var(--color-primary-1)]/80">{ev.tag}</span>
                                                                <span>•</span>
                                                                <span>{fmtDate(ev.createdAt)}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Actors & Channel Grid */}
                                                {(ev.actorId || ev.targetId || ev.channelId) && (
                                                    <div className={`grid ${[ev.actorId && ev.actorId !== ev.targetId, ev.targetId, ev.channelId && ev.payload?.event !== 'voice_move'].filter(Boolean).length === 1 ? 'grid-cols-1 max-w-xs' :
                                                        [ev.actorId && ev.actorId !== ev.targetId, ev.targetId, ev.channelId && ev.payload?.event !== 'voice_move'].filter(Boolean).length === 2 ? 'grid-cols-1 md:grid-cols-2' :
                                                            'grid-cols-1 md:grid-cols-3'
                                                        } gap-3 mb-4`}>
                                                        {ev.actorId === ev.targetId && ev.actorId && (
                                                            <div className="bg-[var(--surface-hover)] p-3 rounded-2xl border border-[var(--border-divider)] flex items-center gap-3">
                                                                <div className="w-8 h-8 rounded-lg overflow-hidden bg-[var(--surface-card)] flex items-center justify-center text-[var(--text-muted)] shrink-0">
                                                                    {enrichedUsers[ev.actorId]?.avatar ? <img src={enrichedUsers[ev.actorId].avatar || undefined} className="w-full h-full object-cover" alt="" /> : <UserCircle size={16} />}
                                                                </div>
                                                                <div className="min-w-0">
                                                                    <div className="text-[10px] uppercase font-bold text-[var(--text-muted)] tracking-wider mb-0.5">{text.user}</div>
                                                                    <span className="font-mono text-xs text-[var(--text-primary)] truncate max-w-full block" title={ev.actorId || undefined}>
                                                                        {ev.payload?.actorTag || enrichedUsers[ev.actorId]?.tag || ev.actorId}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        )}
                                                        {ev.actorId !== ev.targetId && ev.actorId && (
                                                            <div className="bg-[var(--surface-hover)] p-3 rounded-2xl border border-[var(--border-divider)] flex items-center gap-3">
                                                                <div className="w-8 h-8 rounded-lg overflow-hidden bg-[var(--surface-card)] flex items-center justify-center text-[var(--text-muted)] shrink-0">
                                                                    {enrichedUsers[ev.actorId]?.avatar ? <img src={enrichedUsers[ev.actorId].avatar || undefined} className="w-full h-full object-cover" alt="" /> : <UserCircle size={16} />}
                                                                </div>
                                                                <div className="min-w-0">
                                                                    <div className="text-[10px] uppercase font-bold text-[var(--text-muted)] tracking-wider mb-0.5">
                                                                        {ev.payload?.event === 'message_delete' ? text.deletedBy : (ev.targetId ? text.from : text.user)}
                                                                    </div>
                                                                    <span className="font-mono text-xs text-[var(--text-primary)] truncate max-w-full block" title={ev.actorId || undefined}>
                                                                        {ev.payload?.actorTag || enrichedUsers[ev.actorId]?.tag || ev.actorId}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        )}
                                                        {ev.actorId !== ev.targetId && ev.targetId && (
                                                            <div className="bg-[var(--surface-hover)] p-3 rounded-2xl border border-[var(--border-divider)] flex items-center gap-3">
                                                                <div className="w-8 h-8 rounded-lg overflow-hidden bg-[var(--surface-card)] flex items-center justify-center text-[var(--text-muted)] shrink-0">
                                                                    {enrichedUsers[ev.targetId]?.avatar ? <img src={enrichedUsers[ev.targetId].avatar || undefined} className="w-full h-full object-cover" alt="" /> : <UserCircle size={16} />}
                                                                </div>
                                                                <div className="min-w-0">
                                                                    <div className="text-[10px] uppercase font-bold text-[var(--text-muted)] tracking-wider mb-0.5">
                                                                        {(ev.payload?.event === 'message_delete' || ev.payload?.event === 'message_edit') ? text.messageAuthor : (ev.actorId ? text.to : text.user)}
                                                                    </div>
                                                                    <span className="font-mono text-xs text-[var(--text-primary)] truncate max-w-full block" title={ev.targetId || undefined}>
                                                                        {ev.payload?.targetTag || enrichedUsers[ev.targetId]?.tag || ev.targetId}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        )}
                                                        {ev.channelId && ev.payload?.event !== 'voice_move' && (
                                                            <div className="bg-[var(--surface-hover)] p-3 rounded-2xl border border-[var(--border-divider)] flex items-center gap-3">
                                                                <div className="w-8 h-8 rounded-lg bg-[var(--surface-card)] flex items-center justify-center text-[var(--color-primary-1)] shrink-0">
                                                                    {(() => {
                                                                        const ch = allChannels.find(c => c.id === ev.channelId);
                                                                        const isVoice = ch?.type === 2 || ch?.type === 13 || ch?.type === '2' || ch?.type === '13';
                                                                        return isVoice ? <SpeakerHigh size={16} /> : <Hash size={16} />;
                                                                    })()}
                                                                </div>
                                                                <div className="min-w-0">
                                                                    <div className="text-[10px] uppercase font-bold text-[var(--text-muted)] tracking-wider mb-0.5">{text.channel}</div>
                                                                    <span className="font-bold text-xs text-[var(--color-primary-1)] truncate block">
                                                                        {getChannelName(ev.channelId)}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                {/* Voice Move Specifics */}
                                                {ev.payload?.event === 'voice_move' && (
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                                                        <div className="bg-[var(--surface-hover)] p-3 rounded-2xl border border-[var(--border-divider)]">
                                                            <div className="text-[10px] uppercase font-bold text-[var(--text-muted)] tracking-wider mb-2">From</div>
                                                            <div className="flex items-center gap-2 px-3 py-2 bg-[var(--color-primary-1)]/5 rounded-xl border border-[var(--color-primary-1)]/10 w-fit">
                                                                <SpeakerHigh size={14} className="text-[var(--text-muted)]" />
                                                                <a href={`/dashboard/${guildId}/stats/channels?channelId=${ev.payload.fromChannelId}`} className="text-xs font-bold text-[var(--color-primary-1)] hover:underline">
                                                                    {getChannelName(ev.payload.fromChannelId)}
                                                                </a>
                                                            </div>
                                                        </div>
                                                        <div className="bg-[var(--surface-hover)] p-3 rounded-2xl border border-[var(--border-divider)]">
                                                            <div className="text-[10px] uppercase font-bold text-[var(--text-muted)] tracking-wider mb-2">To</div>
                                                            <div className="flex items-center gap-2 px-3 py-2 bg-[var(--color-primary-1)]/5 rounded-xl border border-[var(--color-primary-1)]/10 w-fit">
                                                                <SpeakerHigh size={14} className="text-[var(--color-primary-1)]" />
                                                                <a href={`/dashboard/${guildId}/stats/channels?channelId=${ev.payload.toChannelId}`} className="text-xs font-bold text-[var(--color-primary-1)] hover:underline">
                                                                    {getChannelName(ev.payload.toChannelId)}
                                                                </a>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Reason & Timeout Info */}
                                                {(ev.payload?.reason || ev.payload?.until) && (
                                                    <div className="space-y-3 mb-4">
                                                        {ev.payload?.reason && (
                                                            <div className="bg-[var(--surface-hover)] p-4 rounded-2xl border border-[var(--border-divider)]">
                                                                <div className="text-[10px] uppercase font-bold text-[var(--text-muted)] tracking-wider mb-1">{text.reason}</div>
                                                                <div className="text-sm text-[var(--text-primary)]">{ev.payload.reason}</div>
                                                            </div>
                                                        )}
                                                        {ev.payload?.until && (() => {
                                                            const untilTime = new Date(ev.payload.until).getTime();
                                                            const now = new Date(ev.createdAt).getTime();
                                                            const durationMs = untilTime - now;
                                                            let durationStr = '';
                                                            if (durationMs > 0) {
                                                                const minutes = Math.round(durationMs / 60000);
                                                                const hours = Math.floor(minutes / 60);
                                                                const days = Math.floor(hours / 24);
                                                                if (days > 0) durationStr = `${days}д ${hours % 24}ч`;
                                                                else if (hours > 0) durationStr = `${hours}ч ${minutes % 60}м`;
                                                                else durationStr = `${minutes}м`;
                                                            }

                                                            return (
                                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                                    <div className="bg-[var(--surface-hover)] p-3 rounded-2xl border border-[var(--border-divider)]">
                                                                        <div className="text-[10px] uppercase font-bold text-[var(--text-muted)] tracking-wider mb-1">{text.until}</div>
                                                                        <div className="text-sm font-mono text-[var(--text-primary)]">
                                                                            {new Date(ev.payload.until).toLocaleString(locale === 'ru' ? 'ru' : 'en')}
                                                                        </div>
                                                                    </div>
                                                                    {durationStr && (
                                                                        <div className="bg-[var(--surface-hover)] p-3 rounded-2xl border border-[var(--border-divider)]">
                                                                            <div className="text-[10px] uppercase font-bold text-[var(--text-muted)] tracking-wider mb-1">{text.duration}</div>
                                                                            <div className="text-sm font-bold text-[var(--text-primary)]">{durationStr}</div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        })()}
                                                    </div>
                                                )}

                                                {/* Content Diff */}
                                                {(ev.payload?.contentBefore || ev.payload?.contentAfter) && (
                                                    <div className="rounded-2xl border border-[var(--border-subtle)] overflow-hidden font-mono text-sm">
                                                        {ev.payload?.contentBefore && (
                                                            <div className="bg-rose-500/5 p-3 border-b border-[var(--border-divider)]">
                                                                <div className="text-[10px] font-bold text-rose-400 uppercase tracking-wider mb-1 opacity-75">Before</div>
                                                                <div className="text-rose-200/80 leading-relaxed break-words">{ev.payload.contentBefore}</div>
                                                            </div>
                                                        )}
                                                        {ev.payload?.contentAfter && (
                                                            <div className="bg-emerald-500/5 p-3">
                                                                <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider mb-1 opacity-75">After</div>
                                                                <div className="text-emerald-200/80 leading-relaxed break-words">{ev.payload.contentAfter}</div>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                <div className="mt-2">
                                                    {renderAttachments(text.attachments, ev.payload?.attachments)}
                                                    {renderAttachments(`${text.attachments} (Old)`, ev.payload?.attachmentsBefore)}
                                                    {renderAttachments(`${text.attachments} (New)`, ev.payload?.attachmentsAfter)}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </SectionBlock>
                </div>
            </div>
        </div>
    );
}
