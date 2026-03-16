'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { use } from 'react';
import { Switch, Slider, Select, SelectItem, SelectedItems } from "@nextui-org/react";
import { MusicNote, SpeakerHigh, Clock, Users, ArrowClockwise, FadersHorizontal, Waveform, PlayCircle, PauseCircle, SkipForward, SkipBack, Repeat, Shuffle } from "@phosphor-icons/react";
import { useGuildLocale } from "@/lib/i18n";

interface Role {
    id: string;
    name: string;
    color: string;
    position: number;
    icon?: string | null;
}

interface Channel {
    id: string;
    name: string;
    type: string;
    position: number;
}

const strings = {
    en: {
        pageTitle: 'Now Playing',
        pageSubtitle: 'Music Configuration & Controls',
        djTitle: 'DJ Access',
        djDesc: 'Roles allowed to control music without voting',
        djSelectPlaceholder: 'Search roles...',
        channelsTitle: 'Voice Channels',
        channelsNone: 'Any voice channel',
        channelsWhitelist: 'Allowed Channels',
        channelsBlacklist: 'Blocked Channels',
        whitelist: 'Whitelist',
        blacklist: 'Blacklist',
        channelsSelectPlaceholder: 'Search voice channels...',
        volumeTitle: 'Default Volume',
        maxDurationTitle: 'Track Length Limit',
        maxDurationDesc: 'Maximum track duration allowed to be queued',
        maxDurationUnits: 'MIN',
        saveChanges: 'Save Configuration',
        saving: 'Saving...',
        resetDefaults: 'Reset',
        currentlyPlaying: 'Not Playing',
        artist: 'Queue Empty',
    },
    ru: {
        pageTitle: 'Сейчас играет',
        pageSubtitle: 'Настройки музыки и управление',
        djTitle: 'DJ Доступ',
        djDesc: 'Роли, которые могут управлять музыкой без голосования',
        djSelectPlaceholder: 'Поиск ролей...',
        channelsTitle: 'Голосовые каналы',
        channelsNone: 'Любой канал',
        channelsWhitelist: 'Разрешенные каналы',
        channelsBlacklist: 'Заблокированные каналы',
        whitelist: 'Разрешить',
        blacklist: 'Запретить',
        channelsSelectPlaceholder: 'Поиск голосовых каналов...',
        volumeTitle: 'Начальная громкость',
        maxDurationTitle: 'Лимит длительности',
        maxDurationDesc: 'Максимальная длина трека',
        maxDurationUnits: 'МИН',
        saveChanges: 'Сохранить',
        saving: 'Сохранение...',
        resetDefaults: 'Сброс',
        currentlyPlaying: 'Ничего не играет',
        artist: 'Очередь пуста',
    },
} as const;

export default function MusicSettingsPage({ params }: { params: Promise<{ guildId: string }> }) {
    const { guildId } = use(params);
    const { locale } = useGuildLocale(guildId);
    const text = strings[locale] || strings.en;

    const [roles, setRoles] = useState<Role[]>([]);
    const [channels, setChannels] = useState<Channel[]>([]);

    const [djRoles, setDjRoles] = useState<Set<string>>(new Set([]));
    const [defaultVolume, setDefaultVolume] = useState<number>(50);
    const [maxDurationEnabled, setMaxDurationEnabled] = useState<boolean>(false);
    const [maxDuration, setMaxDuration] = useState<number>(30);

    const [channelMode, setChannelMode] = useState<'whitelist' | 'blacklist'>('blacklist');
    const [selectedChannels, setSelectedChannels] = useState<Set<string>>(new Set([]));

    const [isSaving, setIsSaving] = useState(false);
    const [initialLoaded, setInitialLoaded] = useState(false);

    // Dummy player state
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(0);

    const initialValues = useRef({
        djRoles: new Set<string>(),
        channelMode: 'blacklist' as 'whitelist' | 'blacklist',
        selectedChannels: new Set<string>(),
        defaultVolume: 50,
        maxDurationEnabled: false,
        maxDuration: 30,
    });

    useEffect(() => {
        fetch(`/api/guilds/${guildId}/roles`).then(res => res.json()).then(data => {
            if (Array.isArray(data)) setRoles(data);
        }).catch(() => { });

        fetch(`/api/guilds/${guildId}/channels`).then(res => res.json()).then(data => {
            if (Array.isArray(data)) setChannels(data);
        }).catch(() => { });

        const loadConfig = async () => {
            try {
                const res = await fetch(`/api/guilds/${guildId}/music`);
                if (!res.ok) return;
                const data = await res.json();
                if (data.config) {
                    const config = data.config;
                    const loadedChannelMode = config.channelMode || 'blacklist';
                    const loadedChannels = config.allowedChannels ? JSON.parse(config.allowedChannels) : [];
                    const loadedRoles = config.djRoles ? JSON.parse(config.djRoles) : [];
                    const loadedVolume = typeof config.defaultVolume === 'number' ? config.defaultVolume : 50;

                    setChannelMode(loadedChannelMode);
                    setSelectedChannels(new Set(loadedChannels));
                    setDjRoles(new Set(loadedRoles));
                    setDefaultVolume(loadedVolume);

                    initialValues.current = {
                        djRoles: new Set(loadedRoles),
                        channelMode: loadedChannelMode,
                        selectedChannels: new Set(loadedChannels),
                        defaultVolume: loadedVolume,
                        maxDurationEnabled: false,
                        maxDuration: 30,
                    };
                }
            } finally {
                setInitialLoaded(true);
            }
        };

        loadConfig();
    }, [guildId]);

    const isDirty = useMemo(() => {
        if (!initialLoaded) return false;
        const setsEqual = (a: Set<string>, b: Set<string>) => {
            if (a.size !== b.size) return false;
            for (const item of a) if (!b.has(item)) return false;
            return true;
        };
        return (
            !setsEqual(djRoles, initialValues.current.djRoles) ||
            channelMode !== initialValues.current.channelMode ||
            !setsEqual(selectedChannels, initialValues.current.selectedChannels) ||
            defaultVolume !== initialValues.current.defaultVolume ||
            maxDurationEnabled !== initialValues.current.maxDurationEnabled ||
            maxDuration !== initialValues.current.maxDuration
        );
    }, [initialLoaded, djRoles, channelMode, selectedChannels, defaultVolume, maxDuration, maxDurationEnabled]);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const response = await fetch(`/api/guilds/${guildId}/music`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    channelMode,
                    allowedChannels: Array.from(selectedChannels),
                    djMode: djRoles.size > 0,
                    djRoles: Array.from(djRoles),
                    defaultVolume,
                }),
            });
            if (response.ok) {
                initialValues.current = {
                    djRoles: new Set(djRoles),
                    channelMode,
                    selectedChannels: new Set(selectedChannels),
                    defaultVolume,
                    maxDurationEnabled,
                    maxDuration,
                };
            }
        } finally {
            setIsSaving(false);
        }
    };

    const handleReset = () => {
        setDjRoles(new Set([]));
        setChannelMode('blacklist');
        setSelectedChannels(new Set([]));
        setDefaultVolume(50);
        setMaxDuration(30);
        setMaxDurationEnabled(false);
    };

    return (
        <div className="space-y-8 pb-32 animate-fade-in max-w-[1000px] w-full mx-auto">
            {/* Player Interface Component */}
            <div className="w-full bg-[var(--surface-card)] border border-[var(--border-subtle)] rounded-[32px] overflow-hidden shadow-2xl shadow-black/50 p-8 flex flex-col md:flex-row gap-8 items-center bg-gradient-to-br from-[#111111] to-[#0a0a0a]">

                {/* Album Cover Area */}
                <div className="w-48 h-48 md:w-64 md:h-64 rounded-2xl bg-[var(--surface-hover)] border border-[var(--border-subtle)] flex items-center justify-center shadow-lg shrink-0 relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-tr from-[#8f5eff]/20 to-transparent mix-blend-overlay"></div>
                    <MusicNote size={64} weight="duotone" className="text-[var(--text-muted)] group-hover:scale-110 transition-transform duration-500" />
                    {!isPlaying && <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><PlayCircle size={48} weight="fill" className="text-white drop-shadow-md" /></div>}
                </div>

                {/* Track Info & Controls */}
                <div className="flex-1 w-full space-y-6 flex flex-col justify-center">
                    <div className="text-center md:text-left">
                        <h2 className="text-3xl font-bold text-[var(--text-primary)] mb-1 tracking-tight">{text.currentlyPlaying}</h2>
                        <p className="text-lg text-[var(--color-primary-2)] font-medium">{text.artist}</p>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-2">
                        <Slider
                            aria-label="Track Progress"
                            size="sm"
                            step={1}
                            maxValue={100}
                            minValue={0}
                            value={progress}
                            onChange={(val) => setProgress(val as number)}
                            classNames={{
                                track: "h-1.5 bg-[var(--surface-hover)]",
                                filler: "bg-[var(--color-primary-2)]",
                                thumb: "w-4 h-4 bg-white hidden group-hover:block"
                            }}
                            className="group"
                        />
                        <div className="flex justify-between text-xs text-[var(--text-muted)] font-mono tabular-nums">
                            <span>0:00</span>
                            <span>-:--</span>
                        </div>
                    </div>

                    {/* Playback Controls */}
                    <div className="flex items-center justify-center md:justify-start gap-6">
                        <button className="text-[var(--text-muted)] hover:text-white transition-colors"><Shuffle size={20} weight="bold" /></button>
                        <button className="text-[var(--text-primary)] hover:text-[var(--color-primary-2)] transition-colors"><SkipBack size={32} weight="fill" /></button>
                        <button onClick={() => setIsPlaying(!isPlaying)} className="w-16 h-16 bg-[var(--color-primary-2)] hover:bg-[#a67cff] rounded-full flex items-center justify-center text-white shadow-[0_0_30px_rgba(143,94,255,0.3)] transition-all hover:scale-105 active:scale-95">
                            {isPlaying ? <PauseCircle size={36} weight="fill" /> : <PlayCircle size={36} weight="fill" />}
                        </button>
                        <button className="text-[var(--text-primary)] hover:text-[var(--color-primary-2)] transition-colors"><SkipForward size={32} weight="fill" /></button>
                        <button className="text-[var(--text-muted)] hover:text-white transition-colors"><Repeat size={20} weight="bold" /></button>
                    </div>
                </div>
            </div>

            {/* Settings Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* Volume & Configuration */}
                <div className="bg-[var(--surface-card)] border border-[var(--border-subtle)] rounded-[24px] p-6 space-y-8">
                    <div className="flex items-center gap-3 border-b border-[var(--border-divider)] pb-4">
                        <FadersHorizontal size={24} className="text-[var(--color-primary-2)]" weight="duotone" />
                        <h3 className="font-bold text-lg text-[var(--text-primary)]">{text.volumeTitle} & Config</h3>
                    </div>

                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <span className="text-sm font-bold text-[var(--text-secondary)]">{text.volumeTitle}</span>
                            <span className="text-xl font-akony text-[var(--text-primary)]">{defaultVolume}%</span>
                        </div>
                        <Slider
                            aria-label="Default Volume"
                            size="md"
                            step={1}
                            maxValue={100}
                            minValue={0}
                            value={defaultVolume}
                            onChange={(value) => setDefaultVolume(value as number)}
                            classNames={{
                                track: "h-2 bg-[var(--surface-hover)] border border-[var(--border-subtle)]",
                                filler: "bg-[var(--color-primary-2)]",
                                thumb: "w-6 h-6 bg-[var(--surface-card)] border-[4px] border-[var(--color-primary-2)]"
                            }}
                        />
                    </div>

                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <div>
                                <h4 className="font-bold text-sm text-[var(--text-primary)]">{text.maxDurationTitle}</h4>
                                <p className="text-xs text-[var(--text-muted)]">{text.maxDurationDesc}</p>
                            </div>
                            <Switch checked={maxDurationEnabled} onChange={(e) => setMaxDurationEnabled(e.target.checked)} color="secondary" />
                        </div>
                        {maxDurationEnabled && (
                            <div className="mt-4 flex items-center bg-[var(--surface-hover)] rounded-xl border border-[var(--border-divider)] px-4 py-2">
                                <input
                                    type="number"
                                    value={maxDuration}
                                    onChange={(e) => setMaxDuration(parseInt(e.target.value) || 0)}
                                    className="bg-transparent text-2xl font-bold text-white w-full outline-none"
                                />
                                <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">{text.maxDurationUnits}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Permissions & Channels */}
                <div className="bg-[var(--surface-card)] border border-[var(--border-subtle)] rounded-[24px] p-6 space-y-8 flex flex-col h-full">
                    <div className="flex items-center gap-3 border-b border-[var(--border-divider)] pb-4">
                        <Users size={24} className="text-[var(--color-primary-1)]" weight="duotone" />
                        <h3 className="font-bold text-lg text-[var(--text-primary)]">Access & Roles</h3>
                    </div>

                    <div className="space-y-3">
                        <h4 className="font-bold text-sm text-[var(--text-primary)]">{text.djTitle}</h4>
                        <Select
                            items={roles}
                            aria-label={text.djTitle}
                            variant="bordered"
                            isMultiline={true}
                            selectionMode="multiple"
                            placeholder={text.djSelectPlaceholder}
                            selectedKeys={djRoles}
                            onSelectionChange={(keys) => setDjRoles(keys as Set<string>)}
                            classNames={{
                                trigger: "bg-[var(--surface-hover)] border border-[var(--border-divider)] rounded-xl hover:bg-[#1a1a1a] min-h-12",
                                value: "text-sm",
                                popoverContent: "bg-[var(--surface-card)] border border-[var(--border-subtle)]",
                            }}
                        >
                            {(role) => (
                                <SelectItem key={role.id} textValue={role.name}>
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: role.color && role.color !== '#000000' ? role.color : '#ffffff' }}></div>
                                        <span className="text-sm">{role.name}</span>
                                    </div>
                                </SelectItem>
                            )}
                        </Select>
                    </div>

                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <h4 className="font-bold text-sm text-[var(--text-primary)]">{text.channelsTitle}</h4>
                            <div className="flex gap-1 bg-[var(--surface-hover)] rounded-lg p-1 border border-[var(--border-divider)]">
                                <button
                                    className={`px-3 py-1 text-xs rounded-md font-bold transition-colors ${channelMode === 'whitelist' ? 'bg-[var(--surface-card)] text-[var(--color-primary-1)] shadow-sm' : 'text-[var(--text-muted)]'}`}
                                    onClick={() => setChannelMode('whitelist')}
                                >
                                    {text.whitelist}
                                </button>
                                <button
                                    className={`px-3 py-1 text-xs rounded-md font-bold transition-colors ${channelMode === 'blacklist' ? 'bg-[var(--surface-card)] text-[var(--color-destructive)] shadow-sm' : 'text-[var(--text-muted)]'}`}
                                    onClick={() => setChannelMode('blacklist')}
                                >
                                    {text.blacklist}
                                </button>
                            </div>
                        </div>
                        <Select
                            items={channels}
                            aria-label={text.channelsTitle}
                            variant="bordered"
                            isMultiline={true}
                            selectionMode="multiple"
                            placeholder={text.channelsSelectPlaceholder}
                            selectedKeys={selectedChannels}
                            onSelectionChange={(keys) => setSelectedChannels(keys as Set<string>)}
                            classNames={{
                                trigger: "bg-[var(--surface-hover)] border border-[var(--border-divider)] rounded-xl hover:bg-[#1a1a1a] min-h-12",
                                value: "text-sm",
                                popoverContent: "bg-[var(--surface-card)] border border-[var(--border-subtle)]",
                            }}
                        >
                            {(channel) => (
                                <SelectItem key={channel.id} textValue={channel.name}>
                                    <div className="flex items-center gap-2">
                                        <SpeakerHigh size={16} className="text-[var(--text-muted)]" />
                                        <span className="text-sm">{channel.name}</span>
                                    </div>
                                </SelectItem>
                            )}
                        </Select>
                    </div>
                </div>

            </div>

            {/* Floating Action Bar */}
            <div className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex justify-center px-4 w-full max-w-lg transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${isDirty ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-24 opacity-0 scale-95 pointer-events-none'}`}>
                <div className="bg-[var(--surface-card)]/90 backdrop-blur-2xl border border-[var(--border-subtle)] shadow-2xl rounded-full p-2 flex gap-2 w-full">
                    <button
                        className="flex-1 h-12 rounded-full font-bold text-sm bg-[var(--color-primary-1)] text-black hover:bg-[#86f27d] transition-colors flex items-center justify-center gap-2"
                        onClick={handleSave}
                        disabled={isSaving}
                    >
                        {isSaving ? text.saving : text.saveChanges}
                    </button>
                    <button
                        className="h-12 w-12 min-w-12 rounded-full bg-[var(--surface-hover)] hover:bg-[var(--border-divider)] text-[var(--text-secondary)] hover:text-white transition-colors flex items-center justify-center"
                        onClick={handleReset}
                        title={text.resetDefaults}
                    >
                        <ArrowClockwise size={20} weight="bold" />
                    </button>
                </div>
            </div>
        </div>
    );
}
