'use client';

import React, { useEffect, useState, useCallback, use, useRef } from 'react';
import Link from 'next/link';
import {
    Pulse, ShieldCheck, Ticket, Users, Database,
    Cpu, Circle, CheckCircle, Lightning, Scroll, Gear, ArrowRight, Robot, UserCircle, SpeakerHigh, Hash, MusicNotesSimple, Play, SkipForward,
    CaretDown, CaretUp, Pause
} from '@phosphor-icons/react';
import { useGuildLocale } from '@/lib/i18n';
import { DashboardAudioPlayer } from '@/components/music/DashboardAudioPlayer';
import { fetchWithTimeout, withTimeout } from '@/lib/requestTimeout';
import { FitSingleLineText } from '@/components/common/FitSingleLineText';
import { hyphenateServerName } from '@/lib/textHyphenation';

/* ─── Types ─────────────────────────────────────────────────────── */
interface GuildSummary {
    guild: {
        id: string;
        name?: string | null;
        icon?: string | null;
    };
    counts: {
        roles: number;
        voiceChannels: number;
        textChannels: number;
        totalChannels: number;
        members?: number | null;
        onlineMembers?: number | null;
    };
    lastSyncedAt?: string;
}

interface SystemStats {
    cpu: number;
    memory: number;
    ping: number | null;
    uptime: string;
    botStatus: 'ONLINE' | 'OFFLINE' | 'PARTIAL';
}

interface AuditEvent {
    id: number | string;
    tag: string;
    actorId?: string | null;
    targetId?: string | null;
    channelId?: string | null;
    payload?: string | null;
    createdAt: string;
}

const PAGE_DATA_TIMEOUT_MS = 6000;
const ENRICH_TIMEOUT_MS = 3500;

/* ─── Strings ────────────────────────────────────────────────────── */
const strings = {
    en: {
        systemHealth: 'System Health',
        metricsSummary: 'Summary',
        botEvents: 'Bot Events',
        serverEvents: 'Server Events',
        quickLaunch: 'Quick Launch',
        botStatus: 'Bot Status',
        uptime: 'Uptime',
        ping: 'Latency',
        cpu: 'CPU Load',
        ram: 'Memory',
        synced: 'Synced',
        members: 'Members',
        online: 'Online',
        settings: 'Settings',
        moderation: 'Moderation',
        tickets: 'Tickets',
        audit: 'Audit Logs',
        noActivity: 'No recent activity recorded.',
        openTickets: 'Open Tickets',
        activeVoice: 'Active Voice Rooms',
    },
    ru: {
        systemHealth: 'Состояние системы',
        metricsSummary: 'Сводка',
        botEvents: 'События бота',
        serverEvents: 'События сервера',
        quickLaunch: 'Быстрый запуск',
        botStatus: 'Статус бота',
        uptime: 'Аптайм',
        ping: 'Задержка',
        cpu: 'Нагрузка CPU',
        ram: 'ОЗУ',
        synced: 'Синхр.',
        members: 'Участников',
        online: 'Онлайн',
        settings: 'Настройки',
        moderation: 'Модерация',
        tickets: 'Тикеты',
        audit: 'Журнал аудита',
        noActivity: 'Нет недавней активности.',
        openTickets: 'Открытых тикетов',
        activeVoice: 'Активных войс-румов',
    }
} as const;

/* ─── Helpers ────────────────────────────────────────────────────── */
function relativeTimeShort(iso: string) {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'now';
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h`;
    return `${Math.floor(h / 24)}d`;
}

function parseEventLabel(event: AuditEvent): string {
    try {
        const p = typeof event.payload === 'string' ? JSON.parse(event.payload) : (event.payload || {});
        return (p.event || p.action)?.replace(/_/g, ' ') ?? event.tag;
    } catch {
        return event.tag;
    }
}

function tagColor(tag: string): string {
    const m: Record<string, string> = {
        ban: 'var(--color-destructive)', kick: 'var(--color-destructive)', mute: 'var(--color-warning)',
        unmute: 'var(--color-success)', unban: 'var(--color-success)', warn: 'var(--color-warning)',
        invites: 'var(--color-primary-2)', channels: 'var(--color-primary-1)', roles: 'var(--color-primary-1)',
    };
    return m[tag] ?? 'var(--text-secondary)';
}

function InlineUserBadge({ userId, users, fallbackLabel }: { userId?: string | null, users: Record<string, any>, fallbackLabel: string }) {
    if (!userId) return null;
    const user = users[userId];
    const name = user?.name || fallbackLabel;
    const tag = user?.tag || userId;
    return (
        <span className="inline-flex items-center gap-2 p-1 pr-2.5 bg-[var(--surface-sidebar)] border border-[var(--border-divider)] rounded-lg w-fit shadow-sm">
            {user?.avatar ? (
                <img src={user.avatar} className="w-5 h-5 rounded-md border border-black/50 object-cover bg-[var(--surface-hover)]" alt="" />
            ) : (
                <div className="w-5 h-5 rounded-md bg-[var(--surface-hover)] border border-[var(--border-divider)] flex items-center justify-center text-[var(--text-muted)]">
                    <UserCircle size={14} weight="fill" />
                </div>
            )}
            <span className="flex items-baseline gap-1.5 min-w-0">
                <span className="text-[13px] font-bold text-white leading-none truncate max-w-[120px]">{name}</span>
                <span className="text-[10px] text-[var(--text-muted)] leading-none font-mono truncate max-w-[90px]">{tag}</span>
            </span>
        </span>
    );
}

function InlineChannelBadge({ channelId, channels, guildId }: { channelId?: string | null, channels: Record<string, any>, guildId: string }) {
    if (!channelId) return null;
    const chData = channels[channelId];
    const name = chData?.name || channelId;
    const isVoice = chData?.type === 2 || chData?.type === 13 || chData?.type === '2' || chData?.type === '13';
    const ChIcon = isVoice ? SpeakerHigh : Hash;
    return (
        <a href={`https://discord.com/channels/${guildId}/${channelId}`} target="_blank" rel="noreferrer" className="inline-flex flex-shrink-0 items-center gap-1.5 px-2 py-1 bg-[var(--color-primary-1)]/10 hover:bg-[var(--color-primary-1)]/20 border border-[var(--color-primary-1)]/20 rounded-lg w-fit transition-colors group shadow-sm min-w-0">
            <ChIcon size={14} className="text-[var(--color-primary-1)] shrink-0" />
            <span className="text-[13px] font-bold text-[var(--color-primary-1)] group-hover:text-white leading-none transition-colors truncate max-w-[150px]">{name}</span>
        </a>
    );
}

function renderServerEventContent(ev: AuditEvent, users: Record<string, any>, channels: Record<string, any>, guildId: string, locale: string) {
    const p = typeof ev.payload === 'string' ? JSON.parse(ev.payload) : (ev.payload || {});
    let action = p.event || p.action || ev.tag;
    if (typeof action === 'string') action = action.replace(/_/g, ' ');

    const actor = ev.actorId ? <InlineUserBadge userId={ev.actorId} users={users} fallbackLabel="System" /> : <span className="font-bold text-white/50 uppercase tracking-wider text-[10px] px-2 py-1 bg-[var(--surface-hover)] rounded-md border border-[var(--border-divider)]">System</span>;
    const target = ev.targetId ? <InlineUserBadge userId={ev.targetId} users={users} fallbackLabel="User" /> : null;
    const channel = ev.channelId ? <InlineChannelBadge channelId={ev.channelId} channels={channels} guildId={guildId} /> : null;

    const Wrapper = ({ children }: { children: React.ReactNode }) => (
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1.5 text-[13px] text-[var(--text-secondary)]">
            {children}
        </div>
    );

    if (locale === 'ru') {
        if (ev.tag === 'ban') return <Wrapper>{actor} <span>забанил</span> {target}</Wrapper>;
        if (ev.tag === 'kick') return <Wrapper>{actor} <span>кикнул</span> {target}</Wrapper>;
        if (ev.tag === 'mute') return <Wrapper>{actor} <span>замутил</span> {target}</Wrapper>;
        if (ev.tag === 'unmute') return <Wrapper>{actor} <span>размутил</span> {target}</Wrapper>;
        if (ev.tag === 'warn') return <Wrapper>{actor} <span>выдал предупреждение</span> {target}</Wrapper>;
        if (ev.tag === 'channels') {
            if (action?.includes('CREATE')) return <Wrapper>{actor} <span>создал канал</span> {channel}</Wrapper>;
            if (action?.includes('DELETE')) return <Wrapper>{actor} <span>удалил канал</span> <span className="opacity-50 pointer-events-none grayscale">{channel}</span></Wrapper>;
            if (action?.includes('UPDATE')) return <Wrapper>{actor} <span>обновил настройки канала</span> {channel}</Wrapper>;
            return <Wrapper>{actor} <span>изменил канал</span> {channel}</Wrapper>;
        }
        if (ev.tag === 'security') return <Wrapper>{actor} <span className="font-bold text-white">включил защиту сервера</span></Wrapper>;
        if (ev.tag === 'role') {
            if (action?.includes('CREATE')) return <Wrapper>{actor} <span>создал роль</span></Wrapper>;
            if (action?.includes('DELETE')) return <Wrapper>{actor} <span>удалил роль</span></Wrapper>;
            return <Wrapper>{actor} <span>изменил роль</span></Wrapper>;
        }
        return <Wrapper>{actor} <span>{action}</span> {target} {channel}</Wrapper>;
    }

    // Default English
    if (ev.tag === 'ban') return <Wrapper>{actor} <span>banned</span> {target}</Wrapper>;
    if (ev.tag === 'kick') return <Wrapper>{actor} <span>kicked</span> {target}</Wrapper>;
    if (ev.tag === 'mute') return <Wrapper>{actor} <span>muted</span> {target}</Wrapper>;
    if (ev.tag === 'unmute') return <Wrapper>{actor} <span>unmuted</span> {target}</Wrapper>;
    if (ev.tag === 'warn') return <Wrapper>{actor} <span>warned</span> {target}</Wrapper>;
    if (ev.tag === 'channels') {
        if (action?.includes('CREATE')) return <Wrapper>{actor} <span>created channel</span> {channel}</Wrapper>;
        if (action?.includes('DELETE')) return <Wrapper>{actor} <span>deleted channel</span> <span className="opacity-50 pointer-events-none grayscale">{channel}</span></Wrapper>;
        if (action?.includes('UPDATE')) return <Wrapper>{actor} <span>updated channel</span> {channel}</Wrapper>;
        return <Wrapper>{actor} <span>modified channel</span> {channel}</Wrapper>;
    }
    if (ev.tag === 'security') return <Wrapper>{actor} <span className="font-bold text-white">activated security measures</span></Wrapper>;
    if (ev.tag === 'role') {
        if (action?.includes('CREATE')) return <Wrapper>{actor} <span>created a role</span></Wrapper>;
        if (action?.includes('DELETE')) return <Wrapper>{actor} <span>deleted a role</span></Wrapper>;
        return <Wrapper>{actor} <span>modified a role</span></Wrapper>;
    }
    return <Wrapper>{actor} <span>{action}</span> {target} {channel}</Wrapper>;
}

/* ─── Reusable UI ─────────────────────────────────────────────────── */
function HealthRow({ label, value, status = 'neutral' }: { label: string, value: React.ReactNode, status?: 'good' | 'warn' | 'bad' | 'neutral' }) {
    const colors = {
        good: 'text-[var(--color-primary-1)]',
        warn: 'text-[var(--color-warning)]',
        bad: 'text-[var(--color-destructive)]',
        neutral: 'text-[var(--text-primary)]'
    };
    return (
        <div className="flex justify-between items-center py-2 border-b border-[var(--border-divider)] last:border-0">
            <span className="text-sm text-[var(--text-secondary)]">{label}</span>
            <span className={`text-sm font-bold font-akony ${colors[status]}`}>{value}</span>
        </div>
    );
}

function SectionHeader({ title, icon: Icon }: { title: string, icon: any }) {
    return (
        <div className="flex min-w-0 items-center gap-2 mb-4">
            <Icon size={16} className="shrink-0 text-[var(--text-muted)]" />
            <h2 className="min-w-0 max-w-full flex-1 overflow-hidden text-[var(--text-muted)]">
                <FitSingleLineText
                    className="font-akony uppercase tracking-widest"
                    minFontSize={7}
                    maxFontSize={12}
                    mobileOnly
                >
                    {title}
                </FitSingleLineText>
            </h2>
        </div>
    );
}

/* ─── Main Component ──────────────────────────────────────────────── */
async function readJson<T>(
    url: string,
    init: RequestInit | undefined,
    timeoutMs: number,
    label: string
): Promise<T | null> {
    try {
        const response = await fetchWithTimeout(url, { cache: 'no-store', ...(init || {}) }, timeoutMs, label);
        if (!response.ok) {
            return null;
        }

        return await withTimeout(
            async () => await response.json() as T,
            timeoutMs,
            `${label} body`
        );
    } catch (error) {
        console.error(`[HubPage] ${label} failed:`, error);
        return null;
    }
}

export default function HubPage({ params }: { params: Promise<{ guildId: string }> }) {
    const { guildId } = use(params);
    const { locale } = useGuildLocale(guildId);
    const t = strings[locale];

    const [guild, setGuild] = useState<GuildSummary | null>(null);
    const [sys, setSys] = useState<SystemStats | null>(null);
    const [events, setEvents] = useState<AuditEvent[]>([]);
    const [enrichedUsers, setEnrichedUsers] = useState<Record<string, any>>({});
    const [allChannels, setAllChannels] = useState<Record<string, any>>({});
    const fetchInFlightRef = useRef(false);
    const isMountedRef = useRef(true);

    useEffect(() => {
        isMountedRef.current = true;

        return () => {
            isMountedRef.current = false;
        };
    }, []);

    const enrichEvents = useCallback(async (fetchedEvents: AuditEvent[]) => {
        const rareTags = ['ban', 'kick', 'mute', 'unmute', 'warn', 'security', 'channels', 'role'];
        const serverEventsToDisplay = fetchedEvents
            .filter((event) => rareTags.includes(event.tag))
            .slice(0, 3);

        const botEventsToDisplay = fetchedEvents
            .filter((event) => event.tag === 'bot_event' || event.tag === 'dashboard_event')
            .slice(0, 4);

        const eventsToEnrich = [...serverEventsToDisplay, ...botEventsToDisplay];
        const userIds = [...new Set(eventsToEnrich.flatMap((event) => [event.actorId, event.targetId].filter(Boolean) as string[]))];
        const channelIds = [...new Set(eventsToEnrich.flatMap((event) => [event.channelId].filter(Boolean) as string[]))];

        if (userIds.length === 0 && channelIds.length === 0) {
            return;
        }

        const data = await readJson<{ channels?: Record<string, any>; users?: Record<string, any> }>(
            `/api/guilds/${guildId}/enrich`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userIds, channelIds }),
            },
            ENRICH_TIMEOUT_MS,
            `Guild enrich (${guildId})`
        );

        if (!data || !isMountedRef.current) {
            return;
        }

        if (data.users) {
            setEnrichedUsers((current) => ({ ...current, ...data.users }));
        }
        if (data.channels) {
            setAllChannels((current) => ({ ...current, ...data.channels }));
        }
    }, [guildId]);

    const fetchAll = useCallback(async () => {
        if (fetchInFlightRef.current) {
            return;
        }

        fetchInFlightRef.current = true;

        try {
            const guildPromise = readJson<GuildSummary>(
                `/api/guilds/${guildId}`,
                undefined,
                PAGE_DATA_TIMEOUT_MS,
                `Guild summary (${guildId})`
            );
            const systemPromise = readJson<SystemStats>(
                '/api/system',
                undefined,
                PAGE_DATA_TIMEOUT_MS,
                'System summary'
            );
            const auditPromise = readJson<{ events?: AuditEvent[] }>(
                `/api/guilds/${guildId}/audit/events?limit=20`,
                undefined,
                PAGE_DATA_TIMEOUT_MS,
                `Audit events (${guildId})`
            );

            void guildPromise.then((guildData) => {
                if (guildData && isMountedRef.current) {
                    setGuild(guildData);
                }
            });

            void systemPromise.then((systemData) => {
                if (systemData && isMountedRef.current) {
                    setSys(systemData);
                }
            });

            void auditPromise.then((auditData) => {
                if (!auditData || !Array.isArray(auditData.events) || !isMountedRef.current) {
                    return;
                }

                const fetchedEvents = auditData.events;
                setEvents(fetchedEvents);
                void enrichEvents(fetchedEvents);
            });

            await Promise.allSettled([guildPromise, systemPromise, auditPromise]);
        } finally {
            fetchInFlightRef.current = false;
        }
    }, [enrichEvents, guildId]);

    useEffect(() => {
        void fetchAll();
        const interval = setInterval(() => {
            void fetchAll();
        }, 3000);
        return () => clearInterval(interval);
    }, [fetchAll]);

    const botStatusColor = sys?.botStatus === 'ONLINE' ? 'good' : sys?.botStatus === 'PARTIAL' ? 'warn' : 'bad';
    const pingStatus = sys && sys.ping !== null ? (sys.ping < 100 ? 'good' : sys.ping < 250 ? 'warn' : 'bad') : 'neutral';

    return (
        <div className="animate-fade-in pb-12 w-full">
            {/* 110% Scale wrapper for better visibility on large monitors */}
            <div className="dashboard-hub-scale origin-top-left">
                <div className="flex min-w-0 flex-col gap-8">

                    {/* ─── HEADER ROW (Green Block) ─── */}
                    <div className="flex flex-col min-w-0">
                        <div className="bg-[var(--surface-card)] rounded-[24px] border border-[var(--border-subtle)] px-5 py-5 sm:px-8 flex flex-col md:flex-row items-center justify-between gap-6 min-w-0">
                            <div className="flex w-full min-w-0 items-center gap-4 md:w-auto">
                                {guild?.guild.icon ? (
                                    <img
                                        src={`https://cdn.discordapp.com/icons/${guildId}/${guild.guild.icon}.png?size=128`}
                                        alt="Server Icon"
                                        className="w-14 h-14 shrink-0 rounded-[14px] object-cover border border-[var(--border-divider)]"
                                    />
                                ) : (
                                    <div className="w-14 h-14 shrink-0 rounded-[14px] bg-[var(--surface-hover)] border border-[var(--border-divider)] flex items-center justify-center">
                                        <span className="text-[var(--text-muted)] font-akony text-2xl">{guild?.guild.name?.charAt(0) ?? '?'}</span>
                                    </div>
                                )}
                                <div className="min-w-0 flex-1">
                                    <h1 className="dashboard-title-clamp-2 dashboard-title-hyphenate-2 max-w-full text-[clamp(1rem,5.4vw,1.25rem)] font-bold leading-tight text-white">{hyphenateServerName(guild?.guild.name)}</h1>
                                    <div className="flex min-w-0 items-center gap-2 mt-1">
                                        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[var(--surface-hover)] border border-[var(--border-divider)]">
                                            <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary-1)] animate-pulse shadow-[0_0_10px_rgba(117,241,106,0.4)]"></div>
                                            <span className="text-[10px] tabular-nums font-bold text-[var(--color-primary-1)]">
                                                {guild?.counts.onlineMembers || 0}
                                            </span>
                                        </div>
                                        <span className="min-w-0 truncate text-xs text-[var(--text-muted)] font-medium">/ {guild?.counts.members || 0} {t.members.toLowerCase()}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ─── MAIN CONTENT ─── */}
                    <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">

                        {/* ─── LEFT COLUMN (8 cols) ─── */}
                        <div className="xl:col-span-8 flex flex-col gap-8">

                            {/* Audio Player (Purple Block) */}
                            <div className="flex flex-col min-w-0">
                                <SectionHeader title="Audio Player" icon={MusicNotesSimple} />
                                <DashboardAudioPlayer guildId={guildId} />
                            </div>

                            {/* Events Row (Black Blocks) */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 flex-1">
                                {/* Bot Events */}
                                <div className="flex flex-col h-full min-w-0">
                                    <SectionHeader title={t.botEvents} icon={Gear} />
                                    <div className="bg-[var(--surface-card)] rounded-[24px] border border-[var(--border-subtle)] overflow-hidden flex flex-col flex-1">
                                        {events.filter(ev => ev.tag === 'bot_event' || ev.tag === 'dashboard_event').length > 0 ? (
                                            <div className="divide-y divide-[var(--border-divider)]">
                                                {events.filter(ev => ev.tag === 'bot_event' || ev.tag === 'dashboard_event').slice(0, 4).map((ev) => (
                                                    <div key={ev.id} className="group px-6 py-4 flex items-center gap-4 hover:bg-[var(--surface-hover)] transition-colors">
                                                        <div className="w-10 h-10 rounded-xl bg-[var(--color-primary-1)]/10 flex items-center justify-center text-[var(--color-primary-1)] shrink-0 border border-[var(--color-primary-1)]/20 shadow-[0_0_15px_rgba(117,241,106,0.1)]">
                                                            <Robot size={22} weight="duotone" />
                                                        </div>
                                                        <div className="flex-1 min-w-0 flex flex-col justify-center">
                                                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[13px] text-[var(--text-secondary)]">
                                                                {ev.actorId ? (
                                                                    <InlineUserBadge userId={ev.actorId} users={enrichedUsers} fallbackLabel="System" />
                                                                ) : (
                                                                    <span className="font-bold text-white/50 uppercase tracking-wider text-[10px] px-2 py-1 bg-[var(--surface-hover)] rounded-md border border-[var(--border-divider)] mr-1">System</span>
                                                                )}
                                                                <span className="font-bold text-[13px] text-white/90 capitalize drop-shadow-sm">{parseEventLabel(ev)}</span>
                                                            </div>
                                                            <div className="flex items-center gap-2 mt-1.5 font-mono">
                                                                <span className="text-[10px] text-[var(--text-muted)] opacity-60">• {relativeTimeShort(ev.createdAt)}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="p-8 text-center text-[var(--text-muted)] text-sm flex-1 flex flex-col items-center justify-center font-medium">
                                                {t.noActivity}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Server Events */}
                                <div className="flex flex-col h-full min-w-0">
                                    <SectionHeader title={t.serverEvents} icon={Scroll} />
                                    <div className="bg-[var(--surface-card)] rounded-[24px] border border-[var(--border-subtle)] overflow-hidden flex flex-col flex-1 justify-between">
                                        {events.filter(ev => ['ban', 'kick', 'mute', 'unmute', 'warn', 'security', 'channels', 'role'].includes(ev.tag)).length > 0 ? (
                                            <div className="divide-y divide-[var(--border-divider)]">
                                                {events.filter(ev => ['ban', 'kick', 'mute', 'unmute', 'warn', 'security', 'channels', 'role'].includes(ev.tag)).slice(0, 3).map((ev) => (
                                                    <div key={ev.id} className="group px-6 py-4 flex items-center gap-4 hover:bg-[var(--surface-hover)] transition-colors">
                                                        <div className="w-10 h-10 rounded-xl bg-[var(--surface-hover)] flex items-center justify-center shrink-0 border border-[var(--border-subtle)]" style={{ color: tagColor(ev.tag) }}>
                                                            <ShieldCheck size={22} weight="duotone" />
                                                        </div>
                                                        <div className="flex-1 min-w-0 flex flex-col justify-center">
                                                            <div className="w-full">
                                                                {renderServerEventContent(ev, enrichedUsers, allChannels, guildId, locale)}
                                                            </div>
                                                            <div className="flex items-center gap-2 mt-1.5 font-mono">
                                                                <span className="text-[10px] text-[var(--text-muted)] opacity-60">• {relativeTimeShort(ev.createdAt)}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="p-8 text-center text-[var(--text-muted)] text-sm flex-1 flex flex-col items-center justify-center font-medium">
                                                {t.noActivity}
                                            </div>
                                        )}
                                        <Link href={`/dashboard/${guildId}/audit`} className="block w-full py-3 text-center text-sm font-bold text-[var(--text-secondary)] hover:text-white bg-[var(--surface-hover)] transition-colors border-t border-[var(--border-divider)] mb-0 mt-auto">
                                            View Full History
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* ─── RIGHT COLUMN (4 cols) ─── */}
                        <div className="xl:col-span-4 flex flex-col gap-8">

                            {/* Summary (Red Block 1) */}
                            <div className="flex flex-col min-w-0">
                                <SectionHeader title={t.metricsSummary} icon={Lightning} />
                                <div className="flex flex-col gap-3">
                                    <Link href={`/dashboard/${guildId}/tickets`} className="bg-[var(--surface-card)] border border-[var(--border-subtle)] hover:border-[var(--color-destructive)]/50 rounded-2xl p-4 flex items-center justify-between transition-colors group">
                                        <div className="flex items-center gap-3">
                                            <div className="w-2 h-2 rounded-full bg-[var(--color-destructive)] animate-pulse shadow-[0_0_10px_rgba(244,63,94,0.5)]"></div>
                                            <span className="text-sm font-bold text-[var(--text-secondary)] group-hover:text-white transition-colors">{t.openTickets}</span>
                                        </div>
                                        <span className="text-sm font-akony text-white">3</span>
                                    </Link>

                                    <Link href={`/dashboard/${guildId}/tempvoice`} className="bg-[var(--surface-card)] border border-[var(--border-subtle)] hover:border-[var(--color-primary-1)]/50 rounded-2xl p-4 flex items-center justify-between transition-colors group">
                                        <div className="flex items-center gap-3">
                                            <div className="w-2 h-2 rounded-full bg-[var(--color-primary-1)]"></div>
                                            <span className="text-sm font-bold text-[var(--text-secondary)] group-hover:text-white transition-colors">{t.activeVoice}</span>
                                        </div>
                                        <span className="text-sm font-akony text-white">1</span>
                                    </Link>
                                </div>
                            </div>

                            {/* Quick Launch (Red Block 2) */}
                            <div className="flex flex-col min-w-0 flex-1">
                                <SectionHeader title={t.quickLaunch} icon={Pulse} />
                                <div className="grid grid-cols-2 gap-3 content-start">
                                    {[
                                        { label: t.settings, icon: Gear, href: `/dashboard/${guildId}/settings` },
                                        { label: t.moderation, icon: ShieldCheck, href: `/dashboard/${guildId}/moderation` },
                                        { label: t.tickets, icon: Ticket, href: `/dashboard/${guildId}/tickets` },
                                        { label: t.audit, icon: Scroll, href: `/dashboard/${guildId}/audit` },
                                    ].map(item => (
                                        <Link key={item.href} href={item.href} className="bg-[var(--surface-card)] border border-[var(--border-subtle)] hover:bg-[var(--surface-hover)] rounded-2xl p-4 flex flex-col items-center gap-2 transition-colors">
                                            <item.icon size={20} className="text-[var(--text-secondary)]" />
                                            <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase text-center w-full truncate">{item.label}</span>
                                        </Link>
                                    ))}
                                </div>
                            </div>

                        </div>
                    </div>

                    {/* ─── FOOTER ─── */}
                    <div className="flex flex-col w-full opacity-50 hover:opacity-100 transition-opacity mt-4 mb-4">
                        <div className="flex items-center gap-2 mb-2 px-2">
                            <Cpu size={14} className="text-[var(--text-muted)] border-[var(--border-subtle)]" />
                            <h2 className="text-[10px] font-akony tracking-widest uppercase text-[var(--text-muted)]">{t.systemHealth}</h2>
                        </div>
                        <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-[var(--text-muted)] px-2">
                            <span className="flex items-center gap-1.5"><span className={`w-2 h-2 rounded-full ${botStatusColor === 'good' ? 'bg-[var(--color-primary-1)]' : 'bg-[var(--color-destructive)]'}`}></span> {sys?.botStatus || 'UNKNOWN'}</span>
                            <span className="opacity-40">•</span>
                            <span>{t.uptime}: {sys?.uptime || '—'}</span>
                            <span className="opacity-40">•</span>
                            <span className={`font-bold ${pingStatus === 'good' ? 'text-[var(--color-primary-1)]' : 'text-white'}`}>{sys?.ping ? `${sys.ping}ms` : '—'} ping</span>
                            <span className="opacity-40">•</span>
                            <span>CPU: {sys?.cpu != null ? `${sys.cpu}%` : '—'}</span>
                            <span className="opacity-40">•</span>
                            <span>RAM: {sys?.memory != null ? `${sys.memory}MB` : '—'}</span>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}
