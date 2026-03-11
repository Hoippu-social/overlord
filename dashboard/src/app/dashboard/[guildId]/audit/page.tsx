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
    Scroll,
    ShieldCheck,
    Users,
    ChatCircleText,
    Hash,
    IdentificationBadge,
    SpeakerHigh,
    UserPlus,
    Lock,
    Robot,
    CaretRight,
    Plus,
    Trash,
    Circle,
    CheckCircle,
    Info,
    Warning,
    WarningCircle,
    Clock
} from '@phosphor-icons/react';
import { useParams } from 'next/navigation';
import { useGuildLocale } from '@/lib/i18n';

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
        status: 'Status',
        details: 'Details',
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
        status: 'Статус',
        details: 'Детали',
    },
} as const;

const severityConfig: Record<string, { color: string; bgColor: string; icon: any }> = {
    INFO: { color: 'text-blue-400', bgColor: 'bg-blue-400/10', icon: Info },
    WARN: { color: 'text-amber-400', bgColor: 'bg-amber-400/10', icon: WarningCircle },
    ERROR: { color: 'text-rose-400', bgColor: 'bg-rose-400/10', icon: Warning },
};

function ListGroup({ children, title, description, action }: { children: React.ReactNode; title?: string; description?: string; action?: React.ReactNode }) {
    return (
        <div className="bg-[#181A20] rounded-[32px] border border-white/5 shadow-xl overflow-hidden">
            {(title || description) && (
                <div className="p-6 pb-2 flex items-start justify-between">
                    <div>
                        {title && <h2 className="text-xl font-bold text-white">{title}</h2>}
                        {description && <p className="text-sm text-default-400">{description}</p>}
                    </div>
                    {action}
                </div>
            )}
            <div className="p-4">
                {children}
            </div>
        </div>
    );
}

function ListItem({
    icon: Icon,
    iconColor = "text-white",
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
            className={`flex items-center gap-4 p-4 rounded-2xl transition-all border border-transparent ${onClick ? 'cursor-pointer hover:bg-white/5 hover:border-white/5 active:bg-white/10' : 'hover:bg-white/[0.02]'}`}
            onClick={onClick}
        >
            {Icon && (
                <div className={`w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center shrink-0 ${iconColor}`}>
                    <Icon size={24} weight="duotone" />
                </div>
            )}
            <div className="flex-1 flex flex-col justify-center min-w-0">
                <div className="text-[17px] font-bold text-white truncate">{label}</div>
                {subvalue && <div className="text-[14px] text-default-500 truncate font-medium">{subvalue}</div>}
            </div>
            {(value || rightElement) && (
                <div className="flex items-center gap-2">
                    {value && <div className="text-[17px] text-default-500">{value}</div>}
                    {rightElement}
                    {onClick && !rightElement && <CaretRight size={20} className="text-default-400" />}
                </div>
            )}
        </div>
    );
}

function renderAttachments(label: string, items?: any[]) {
    if (!items || !items.length) return null;
    return (
        <div className="text-xs text-default-500 mt-3 space-y-2 bg-[#0A0B0E] p-3 rounded-xl border border-white/5">
            <div className="font-bold text-default-400 uppercase tracking-widest text-[10px]">{label}</div>
            <div className="flex flex-wrap gap-2">
                {items.map((att: any) => (
                    <a
                        key={att.id || att.url}
                        className="flex items-center gap-2 text-primary hover:text-primary-400 bg-primary/10 hover:bg-primary/20 px-3 py-1.5 rounded-lg max-w-full truncate transition-colors"
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
    const text = strings[locale] || strings.en;

    const [events, setEvents] = useState<AuditEvent[]>([]);
    const [routes, setRoutes] = useState<Route[]>([]);
    const [channels, setChannels] = useState<Channel[]>([]);
    const [allChannels, setAllChannels] = useState<Channel[]>([]);
    const [enrichedUsers, setEnrichedUsers] = useState<Record<string, EnrichedUser>>({});
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const [selectedTag, setSelectedTag] = useState(TAGS[0].value);
    const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
    const [enabled, setEnabled] = useState(true);
    const isDirty = useRef(false);

    const fmtDate = (value: string) => {
        const d = new Date(value);
        return d.toLocaleTimeString(locale === 'ru' ? 'ru-RU' : 'en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
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

            // Merge all channels for name lookup (text + voice)
            const merged = new Map<string, Channel>();
            [...(Array.isArray(textChannels) ? textChannels : []),
            ...(Array.isArray(voiceChannels) ? voiceChannels : [])].forEach(c => merged.set(c.id, c));
            const allCh = Array.from(merged.values());

            setEvents(evData.events || []);
            setRoutes(routeData.routes || []);
            setChannels(Array.isArray(textChannels) ? textChannels : []);
            setAllChannels(allCh);

            // Enrich users referenced in events
            const events: AuditEvent[] = evData.events || [];
            const userIds = [...new Set(events.flatMap(ev => [ev.actorId, ev.targetId].filter(Boolean) as string[]))];
            if (userIds.length > 0) {
                try {
                    const enrichRes = await fetch(`/api/guilds/${guildId}/enrich`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ userIds }),
                    });
                    if (enrichRes.ok) {
                        const enrichData = await enrichRes.json();
                        if (enrichData.users) {
                            setEnrichedUsers(prev => ({ ...prev, ...enrichData.users }));
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

    return (
        <div className="space-y-8 pb-10 animate-fade-in">
            {/* Header */}
            <div>
                <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent mb-2">
                    {text.title}
                </h1>
                <div className="flex items-center gap-3 text-default-400">
                    <p className="text-lg">{text.routesDesc}</p>
                    <span className="w-1 h-1 rounded-full bg-white/20"></span>
                    <p className="text-sm flex items-center gap-2">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                        Live system monitoring
                    </p>
                </div>
            </div>

            {error && (
                <Card className="bg-rose-500/10 border border-rose-500/20 shadow-lg rounded-[24px]">
                    <CardBody className="flex-row items-center gap-3 p-4">
                        <WarningCircle size={24} weight="fill" className="text-rose-500" />
                        <div className="text-rose-400 font-medium">{error}</div>
                    </CardBody>
                </Card>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                {/* Left Column: Configuration */}
                <div className="lg:col-span-5 space-y-6 lg:sticky lg:top-8">
                    {/* Add Route Form */}
                    <Card className="bg-[#181A20] border border-white/5 shadow-xl rounded-[32px] overflow-visible">
                        <CardBody className="p-8 space-y-6">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-inner-lg">
                                    <Plus size={24} weight="bold" />
                                </div>
                                <h2 className="text-xl font-bold text-white">{text.addRoute}</h2>
                            </div>

                            <div className="space-y-5">
                                <Select
                                    label={text.selectTag}
                                    variant="bordered"
                                    classNames={{
                                        trigger: "bg-[#0A0B0E] border border-white/5 min-h-[64px] rounded-2xl data-[hover=true]:bg-[#0A0B0E] data-[hover=true]:border-white/10 transition-all",
                                        value: "text-lg font-medium pl-2 text-white",
                                        popoverContent: "bg-[#181A20] border border-white/10 rounded-2xl shadow-2xl",
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
                                                <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-primary"><Icon size={18} weight="duotone" /></div>
                                                <span className="text-white font-medium">{tag?.label}</span>
                                            </div>
                                        );
                                    })}
                                >
                                    {TAGS.map((tag) => (
                                        <SelectItem key={tag.value} textValue={tag.label} className="rounded-xl data-[hover=true]:bg-white/5">
                                            <div className="flex items-center gap-3">
                                                <tag.icon size={20} weight="duotone" className="text-primary" />
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
                                        listboxWrapper: "bg-[#1C1C1E] rounded-xl",
                                        popoverContent: "bg-[#181A20] border border-white/10 rounded-2xl shadow-2xl",
                                    }}
                                    inputProps={{
                                        classNames: {
                                            inputWrapper: "bg-[#0A0B0E] border border-white/5 min-h-[64px] rounded-2xl data-[hover=true]:bg-[#0A0B0E] data-[hover=true]:border-white/10 transition-all px-4",
                                            label: "hidden",
                                            input: "text-lg font-medium text-white placeholder:text-default-400",
                                        }
                                    }}
                                    listboxProps={{
                                        itemClasses: {
                                            base: "rounded-xl data-[hover=true]:bg-white/5 text-default-300 data-[hover=true]:text-white p-3",
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

                                <div className="flex items-center justify-between p-4 bg-[#0A0B0E] rounded-2xl border border-white/5">
                                    <span className="font-bold text-default-400 uppercase text-xs tracking-wider ml-1">{text.status}</span>
                                    <Switch
                                        isSelected={enabled}
                                        onValueChange={(val) => {
                                            setEnabled(val);
                                            isDirty.current = true;
                                        }}
                                        size="lg"
                                        color="success"
                                        classNames={{ wrapper: "group-data-[selected=true]:bg-emerald-500" }}
                                    />
                                </div>
                                <Button
                                    color="primary"
                                    size="lg"
                                    className="w-full h-14 rounded-2xl font-bold text-lg shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all"
                                    isLoading={saving}
                                    onPress={saveRoute}
                                    startContent={!saving && <CheckCircle weight="fill" size={24} />}
                                >
                                    {text.saveRoute}
                                </Button>
                            </div>
                        </CardBody>
                    </Card>

                    {/* Active Routes List */}
                    <ListGroup title={text.routes} description={routes.length > 0 ? `${routes.length} active mappings` : text.noRoutes}>
                        {routes.length === 0 ? (
                            <div className="p-8 text-center border-2 border-dashed border-white/5 rounded-2xl">
                                <p className="text-default-500">{text.noRoutes}</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {routes.map((r) => {
                                    const tagInfo = TAGS.find(t => t.value === r.tag);
                                    const ch = channels.find(c => c.id === r.channelId);
                                    return (
                                        <ListItem
                                            key={r.id}
                                            icon={tagInfo?.icon || Circle}
                                            iconColor={r.enabled ? "text-primary" : "text-default-500"}
                                            label={tagInfo?.label || r.tag}
                                            subvalue={`#${ch?.name || r.channelId}`}
                                            rightElement={
                                                <div className="flex items-center gap-2">
                                                    <Switch
                                                        size="sm"
                                                        isSelected={r.enabled}
                                                        onValueChange={() => toggleRouteEnabled(r)}
                                                        isDisabled={saving}
                                                        color="primary"
                                                    />
                                                    <Button
                                                        isIconOnly
                                                        variant="light"
                                                        color="danger"
                                                        size="sm"
                                                        onPress={() => deleteRoute(r.tag)}
                                                        className="text-default-400 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg"
                                                    >
                                                        <Trash size={18} weight="bold" />
                                                    </Button>
                                                </div>
                                            }
                                        />
                                    );
                                })}
                            </div>
                        )}
                    </ListGroup>
                </div>

                {/* Right Column: Feed */}
                <div className="lg:col-span-7 space-y-6">
                    <ListGroup
                        title={text.events}
                        description={text.eventsDesc}
                        action={
                            saving && (
                                <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 rounded-full">
                                    <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-primary">Syncing</span>
                                </div>
                            )
                        }
                    >
                        {events.length === 0 ? (
                            <div className="p-24 text-center text-default-500 flex flex-col items-center">
                                <Clock size={48} className="mb-4 opacity-20" weight="duotone" />
                                <p className="text-lg font-medium">{text.noEvents}</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {events.map((ev, index) => {
                                    const TagIcon = TAG_ICONS[ev.tag] || Circle;
                                    const sev = ev.severity ? severityConfig[ev.severity] : null;

                                    return (
                                        <div key={ev.id} className="relative pl-6 pb-2 group">
                                            {/* Timeline line */}
                                            {index !== events.length - 1 && (
                                                <div className="absolute left-[11px] top-12 bottom-0 w-[2px] bg-white/5 group-hover:bg-white/10 transition-colors rounded-full" />
                                            )}

                                            {/* Timeline dot */}
                                            <div className={`absolute left-0 top-3 w-6 h-6 rounded-full border-4 border-[#181A20] z-10 ${sev ? sev.bgColor.replace('/10', '') : 'bg-primary'}`} />

                                            <div className="bg-[#1F2128] rounded-[24px] p-6 border border-white/5 hover:border-white/10 transition-all shadow-md group-hover:shadow-xl group-hover:translate-x-1">
                                                {/* Header */}
                                                <div className="flex items-start justify-between gap-4 mb-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center shrink-0 ${sev ? sev.color : 'text-primary'}`}>
                                                            <TagIcon size={20} weight="duotone" />
                                                        </div>
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-bold text-white text-lg leading-none">{ev.payload?.event || 'Audit Event'}</span>
                                                                {sev && (
                                                                    <Chip size="sm" variant="flat" classNames={{ base: `${sev.bgColor} h-5`, content: `${sev.color} font-bold text-[10px] uppercase tracking-wider` }}>
                                                                        {ev.severity}
                                                                    </Chip>
                                                                )}
                                                            </div>
                                                            <div className="flex items-center gap-2 text-xs text-default-400 mt-1 font-mono">
                                                                <span className="uppercase tracking-wider font-bold text-primary/80">{ev.tag}</span>
                                                                <span>•</span>
                                                                <span>{fmtDate(ev.createdAt)}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Actors Grid */}
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                                                    {ev.actorId && (() => {
                                                        const user = enrichedUsers[ev.actorId];
                                                        return (
                                                            <div className="bg-[#141519] p-3 rounded-2xl border border-white/5 flex items-center gap-3">
                                                                {user ? (
                                                                    <Avatar
                                                                        src={user.avatar || undefined}
                                                                        name={user.name}
                                                                        size="sm"
                                                                        className="w-8 h-8 flex-shrink-0"
                                                                    />
                                                                ) : (
                                                                    <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-default-400 flex-shrink-0">
                                                                        <UserPlus size={16} />
                                                                    </div>
                                                                )}
                                                                <div className="min-w-0">
                                                                    <div className="text-[10px] uppercase font-bold text-default-500 tracking-wider mb-0.5">{text.from}</div>
                                                                    <div className="text-xs text-white truncate max-w-full font-semibold" title={ev.actorId}>
                                                                        {user?.name || ev.payload?.actorTag || ev.actorId}
                                                                    </div>
                                                                    {user && (
                                                                        <div className="text-[10px] text-default-500 truncate font-mono">
                                                                            {user.tag || user.username}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    })()}
                                                    {ev.targetId && ev.targetId !== ev.actorId && (() => {
                                                        const user = enrichedUsers[ev.targetId];
                                                        return (
                                                            <div className="bg-[#141519] p-3 rounded-2xl border border-white/5 flex items-center gap-3">
                                                                {user ? (
                                                                    <Avatar
                                                                        src={user.avatar || undefined}
                                                                        name={user.name}
                                                                        size="sm"
                                                                        className="w-8 h-8 flex-shrink-0"
                                                                    />
                                                                ) : (
                                                                    <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-default-400 flex-shrink-0">
                                                                        <IdentificationBadge size={16} />
                                                                    </div>
                                                                )}
                                                                <div className="min-w-0">
                                                                    <div className="text-[10px] uppercase font-bold text-default-500 tracking-wider mb-0.5">{text.to}</div>
                                                                    <div className="text-xs text-white truncate max-w-full font-semibold" title={ev.targetId}>
                                                                        {user?.name || ev.payload?.targetTag || ev.targetId}
                                                                    </div>
                                                                    {user && (
                                                                        <div className="text-[10px] text-default-500 truncate font-mono">
                                                                            {user.tag || user.username}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    })()}
                                                </div>

                                                {ev.channelId && (() => {
                                                    const ch = allChannels.find(c => c.id === ev.channelId);
                                                    const isVoice = ch?.type === 2 || ch?.type === 'voice';
                                                    return (
                                                        <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-primary/5 rounded-xl w-fit border border-primary/10">
                                                            {isVoice
                                                                ? <SpeakerHigh size={14} className="text-primary" />
                                                                : <Hash size={14} className="text-primary" />
                                                            }
                                                            <a href={`https://discord.com/channels/${guildId}/${ev.channelId}`} target="_blank" rel="noreferrer" className="text-xs font-bold text-primary hover:underline">
                                                                {ch?.name || ev.channelId}
                                                            </a>
                                                        </div>
                                                    );
                                                })()}

                                                {/* Content Diff */}
                                                {(ev.payload?.contentBefore || ev.payload?.contentAfter) && (
                                                    <div className="rounded-2xl border border-white/5 overflow-hidden font-mono text-sm">
                                                        {ev.payload?.contentBefore && (
                                                            <div className="bg-[#2A1818] p-3 border-b border-white/5">
                                                                <div className="text-[10px] font-bold text-rose-400 uppercase tracking-wider mb-1 opacity-75">Before</div>
                                                                <div className="text-rose-100/80 leading-relaxed break-words">{ev.payload.contentBefore}</div>
                                                            </div>
                                                        )}
                                                        {ev.payload?.contentAfter && (
                                                            <div className="bg-[#14261E] p-3">
                                                                <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider mb-1 opacity-75">After</div>
                                                                <div className="text-emerald-100/80 leading-relaxed break-words">{ev.payload.contentAfter}</div>
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
                    </ListGroup>
                </div>
            </div>
        </div>
    );
}
