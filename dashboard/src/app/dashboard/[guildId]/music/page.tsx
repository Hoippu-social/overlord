'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Card, CardBody, Button, Switch, Slider, Select, SelectItem, Input, Chip, SelectedItems, ButtonGroup, Checkbox, Divider } from "@nextui-org/react";
import { MusicNote, SpeakerHigh, Clock, Users, List, Prohibit, CheckCircle, FloppyDisk, ArrowClockwise } from "@phosphor-icons/react";
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
        pageTitle: 'Music Settings',
        pageSubtitle: 'Configure playback behavior and permissions',
        djTitle: 'DJ Roles',
        djDesc: 'Users with these roles can control the music player without voting',
        djSelectLabel: 'Select DJ Roles',
        djSelectPlaceholder: 'Choose roles',
        channelsTitle: 'Voice Channels',
        channelsNone: 'Function disabled (no channels selected)',
        channelsWhitelist: 'Only allow bot in selected channels',
        channelsBlacklist: 'Block bot from selected channels',
        whitelist: 'Whitelist',
        blacklist: 'Blacklist',
        channelsSelectLabel: 'Select Channels',
        channelsSelectPlaceholder: 'Choose voice channels',
        volumeTitle: 'Default Volume',
        volumeDesc: 'Set the initial volume for the bot when joining',
        maxDurationTitle: 'Max Track Duration',
        maxDurationDesc: 'Limit the length of songs that can be queued',
        maxDurationLabel: 'Max Duration',
        maxDurationPlaceholder: '30',
        maxDurationUnit: 'min',
        saveChanges: 'Save Changes',
        saving: 'Saving...',
        resetDefaults: 'Reset Defaults',
    },
    ru: {
        pageTitle: 'Настройки музыки',
        pageSubtitle: 'Настройте поведение плеера и права доступа',
        djTitle: 'DJ роли',
        djDesc: 'Пользователи с этими ролями управляют музыкой без голосования',
        djSelectLabel: 'Выберите DJ роли',
        djSelectPlaceholder: 'Выберите роли',
        channelsTitle: 'Голосовые каналы',
        channelsNone: 'Ограничения отключены (каналы не выбраны)',
        channelsWhitelist: 'Разрешить бота только в выбранных каналах',
        channelsBlacklist: 'Запретить бота в выбранных каналах',
        whitelist: 'Белый список',
        blacklist: 'Чёрный список',
        channelsSelectLabel: 'Выберите каналы',
        channelsSelectPlaceholder: 'Выберите голосовые каналы',
        volumeTitle: 'Громкость по умолчанию',
        volumeDesc: 'Начальная громкость при подключении',
        maxDurationTitle: 'Максимальная длительность',
        maxDurationDesc: 'Ограничьте длительность треков в очереди',
        maxDurationLabel: 'Макс. длительность',
        maxDurationPlaceholder: '30',
        maxDurationUnit: 'мин',
        saveChanges: 'Сохранить изменения',
        saving: 'Сохранение...',
        resetDefaults: 'Сбросить по умолчанию',
    },
} as const;

// Helper to convert hex to rgba
const hexToRgba = (hex: string, alpha: number) => {
    if (!hex || hex === '#000000') return `rgba(63, 63, 70, ${alpha})`; // Default zinc-700
    const cleanHex = hex.startsWith('#') ? hex.slice(1) : hex;
    if (cleanHex.length !== 6) return `rgba(63, 63, 70, ${alpha})`;

    const r = parseInt(cleanHex.substr(0, 2), 16);
    const g = parseInt(cleanHex.substr(2, 2), 16);
    const b = parseInt(cleanHex.substr(4, 2), 16);

    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};



export default function MusicSettingsPage({ params }: { params: Promise<{ guildId: string }> }) {
    const { guildId } = React.use(params);
    const { locale } = useGuildLocale(guildId);
    const text = strings[locale] || strings.en;
    const [roles, setRoles] = useState<Role[]>([]);
    const [channels, setChannels] = useState<Channel[]>([]);

    // Settings State
    const [djRoles, setDjRoles] = useState<Set<string>>(new Set([]));
    const [defaultVolume, setDefaultVolume] = useState<number>(50);
    const [maxDurationEnabled, setMaxDurationEnabled] = useState<boolean>(false);
    const [maxDuration, setMaxDuration] = useState<number>(30);

    // Channel Mode State
    const [channelMode, setChannelMode] = useState<'whitelist' | 'blacklist'>('blacklist');
    const [selectedChannels, setSelectedChannels] = useState<Set<string>>(new Set([]));

    // UI State
    const [isSaving, setIsSaving] = useState(false);
    const [initialLoaded, setInitialLoaded] = useState(false);

    // Store initial values for comparison
    const initialValues = useRef({
        djRoles: new Set<string>(),
        channelMode: 'blacklist' as 'whitelist' | 'blacklist',
        selectedChannels: new Set<string>(),
        defaultVolume: 50,
        maxDurationEnabled: false,
        maxDuration: 30,
    });

    useEffect(() => {
        // Load Roles
        fetch(`/api/guilds/${guildId}/roles`)
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) setRoles(data);
            })
            .catch(err => console.error('Failed to load roles:', err));

        // Load Channels
        fetch(`/api/guilds/${guildId}/channels`)
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) setChannels(data);
            })
            .catch(err => console.error('Failed to load channels:', err));

        const loadConfig = async () => {
            try {
                const res = await fetch(`/api/guilds/${guildId}/music`);
                if (!res.ok) {
                    const text = await res.text().catch(() => '');
                    throw new Error(text || `Music API returned ${res.status}`);
                }
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

                    // Store initial values
                    initialValues.current = {
                        djRoles: new Set(loadedRoles),
                        channelMode: loadedChannelMode,
                        selectedChannels: new Set(loadedChannels),
                        defaultVolume: loadedVolume,
                        maxDurationEnabled: false,
                        maxDuration: 30,
                    };
                }
            } catch (err) {
                console.error('Failed to load music config:', err);
            } finally {
                setInitialLoaded(true);
            }
        };

        loadConfig();
    }, [guildId]);

    // Calculate if current state differs from initial values
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

    // Save handler
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
                // Update initial values after successful save
                initialValues.current = {
                    djRoles: new Set(djRoles),
                    channelMode,
                    selectedChannels: new Set(selectedChannels),
                    defaultVolume,
                    maxDurationEnabled,
                    maxDuration,
                };
            } else {
                console.error('Failed to save config');
            }
        } catch (error) {
            console.error('Error saving config:', error);
        } finally {
            setIsSaving(false);
        }
    };

    // Reset handler
    const handleReset = () => {
        setDjRoles(new Set([]));
        setChannelMode('blacklist');
        setSelectedChannels(new Set([]));
        setDefaultVolume(50);
        setMaxDuration(30);
        setMaxDurationEnabled(false);
    };

    return (
        <>
            <div className="space-y-8 pb-10 animate-fade-in relative min-h-screen">
                <div className="flex items-center gap-4 mb-4">
                    <div className="w-16 h-16 rounded-[24px] bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 flex items-center justify-center text-white shadow-xl border border-white/5">
                        <MusicNote size={32} weight="fill" className="text-violet-400" />
                    </div>
                    <div>
                        <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
                            {text.pageTitle}
                        </h1>
                        <p className="text-default-500 text-lg">{text.pageSubtitle}</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">

                    {/* Top Row: Left - DJ Roles */}
                    <Card className="bg-[#181A20] border border-white/5 shadow-xl rounded-[32px] overflow-visible group hover:border-white/10 transition-colors h-full">
                        <CardBody className="p-8">
                            <div className="flex items-center gap-4 mb-8">
                                <div className="w-14 h-14 rounded-2xl bg-fuchsia-500/10 flex items-center justify-center text-fuchsia-500 shadow-inner-lg group-hover:scale-110 transition-transform duration-500">
                                    <Users size={28} weight="fill" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-white mb-1">{text.djTitle}</h3>
                                    <p className="text-default-500 text-sm">{text.djDesc}</p>
                                </div>
                            </div>

                            <Select
                                id="dj-roles-select"
                                items={roles}
                                aria-label={text.djSelectLabel}
                                variant="faded"
                                isMultiline={true}
                                selectionMode="multiple"
                                placeholder={text.djSelectPlaceholder}
                                selectedKeys={djRoles}
                                onSelectionChange={(keys) => setDjRoles(keys as Set<string>)}
                                classNames={{
                                    trigger: "bg-[#0A0B0E] border border-white/5 min-h-[100px] rounded-2xl data-[hover=true]:bg-[#0A0B0E] data-[hover=true]:border-white/10 transition-all p-4 items-start",
                                    value: "text-lg font-medium",
                                    popoverContent: "bg-[#181A20] border border-white/10 rounded-2xl shadow-2xl",
                                    listbox: "bg-transparent p-2 gap-1",
                                    innerWrapper: "pt-1"
                                }}
                                listboxProps={{
                                    itemClasses: { base: "py-2 px-2 min-h-[48px] rounded-xl data-[hover=true]:bg-white/5 text-default-500 data-[selected=true]:bg-white/10" },
                                }}
                                renderValue={(items: SelectedItems<Role>) => {
                                    return (
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
                                    );
                                }}
                            >
                                {(role) => {
                                    const hasColor = role.color && role.color !== '#000000';
                                    const textBorderColor = hasColor ? role.color : '#a1a1aa';
                                    const bgColor = hasColor ? role.color : '#52525b';
                                    const isSelected = djRoles.has(role.id);

                                    return (
                                        <SelectItem key={role.id} textValue={role.name}>
                                            <div className="flex items-center gap-3 w-full">
                                                <Checkbox isSelected={isSelected} color="secondary" disableAnimation classNames={{ wrapper: "before:border-white/30" }} />
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

                    {/* Top Row: Right - Playback Settings (Merged) */}
                    <Card className="bg-[#181A20] border border-white/5 shadow-xl rounded-[32px] overflow-visible group hover:border-white/10 transition-colors h-full">
                        <CardBody className="p-8 space-y-8">
                            {/* Volume Section */}
                            <div className="space-y-6">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 shadow-inner-lg group-hover:scale-110 transition-transform duration-500">
                                        <SpeakerHigh size={24} weight="fill" />
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="text-lg font-bold text-white mb-0.5">{text.volumeTitle}</h3>
                                        <p className="text-default-500 text-xs">{text.volumeDesc}</p>
                                    </div>
                                    <span className="text-3xl font-black text-white tabular-nums">{defaultVolume}<span className="text-xl text-default-500 ml-1">%</span></span>
                                </div>

                                <Slider
                                    aria-label="Default Volume"
                                    size="md"
                                    step={1}
                                    maxValue={100}
                                    minValue={0}
                                    value={defaultVolume}
                                    onChange={(value) => setDefaultVolume(value as number)}
                                    color="success"
                                    showSteps={false}
                                    className="w-full"
                                    classNames={{
                                        track: "h-2 bg-white/5 border border-white/5",
                                        filler: "bg-gradient-to-r from-emerald-500 to-teal-400",
                                        thumb: "w-6 h-6 bg-white border-2 border-emerald-500 shadow-xl after:bg-emerald-500 after:w-1.5 after:h-1.5"
                                    }}
                                />
                            </div>

                            <Divider className="bg-white/5" />

                            {/* Max Duration Section */}
                            <div className="space-y-6">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500 shadow-inner-lg group-hover:scale-110 transition-transform duration-500">
                                        <Clock size={24} weight="fill" />
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="text-lg font-bold text-white mb-0.5">{text.maxDurationTitle}</h3>
                                        <p className="text-default-500 text-xs">{text.maxDurationDesc}</p>
                                    </div>
                                    <Switch
                                        isSelected={maxDurationEnabled}
                                        onValueChange={setMaxDurationEnabled}
                                        color="warning"
                                        size="sm"
                                        classNames={{ wrapper: "group-data-[selected=true]:bg-amber-500" }}
                                    />
                                </div>

                                <div className={`transition-all duration-300 ease-in-out overflow-hidden ${maxDurationEnabled ? 'max-h-[100px] opacity-100' : 'max-h-0 opacity-0 pointer-events-none'}`}>
                                    <Input
                                        type="number"
                                        placeholder={text.maxDurationPlaceholder}
                                        value={maxDuration.toString()}
                                        onValueChange={(value) => setMaxDuration(parseInt(value) || 0)}
                                        startContent={
                                            <div className="pointer-events-none flex items-center">
                                                <span className="text-default-400 text-xs font-bold uppercase mr-2">{text.maxDurationLabel}</span>
                                            </div>
                                        }
                                        endContent={
                                            <div className="pointer-events-none flex items-center">
                                                <span className="text-default-400 text-xs font-mono">{text.maxDurationUnit}</span>
                                            </div>
                                        }
                                        classNames={{
                                            inputWrapper: "bg-[#0A0B0E] border border-white/5 h-12 rounded-xl data-[hover=true]:bg-[#0A0B0E] data-[hover=true]:border-white/10 transition-all",
                                            input: "text-base font-bold text-right",
                                        }}
                                    />
                                </div>
                            </div>
                        </CardBody>
                    </Card>

                    {/* Bottom Row: Full Width - Voice Channels */}
                    <Card className="bg-[#181A20] border border-white/5 shadow-xl rounded-[32px] overflow-visible group hover:border-white/10 transition-colors xl:col-span-2">
                        <CardBody className="p-8">
                            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6 mb-8">
                                <div className="flex items-center gap-4">
                                    <div className="w-14 h-14 rounded-2xl bg-rose-500/10 flex items-center justify-center text-rose-500 shadow-inner-lg group-hover:scale-110 transition-transform duration-500">
                                        {channelMode === 'whitelist' ? <CheckCircle size={28} weight="fill" /> : <Prohibit size={28} weight="fill" />}
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-white mb-1">{text.channelsTitle}</h3>
                                        <p className="text-default-500 text-sm">
                                            {selectedChannels.size === 0
                                                ? text.channelsNone
                                                : channelMode === 'whitelist'
                                                    ? text.channelsWhitelist
                                                    : text.channelsBlacklist}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex bg-[#0A0B0E] p-1.5 rounded-2xl border border-white/5 self-start">
                                    <Button
                                        size="sm"
                                        className={`rounded-xl font-bold transition-all px-6 ${channelMode === 'whitelist' ? 'bg-emerald-500/20 text-emerald-400 shadow-lg' : 'bg-transparent text-default-500'}`}
                                        onPress={() => setChannelMode('whitelist')}
                                    >
                                        {text.whitelist}
                                    </Button>
                                    <Button
                                        size="sm"
                                        className={`rounded-xl font-bold transition-all px-6 ${channelMode === 'blacklist' ? 'bg-rose-500/20 text-rose-400 shadow-lg' : 'bg-transparent text-default-500'}`}
                                        onPress={() => setChannelMode('blacklist')}
                                    >
                                        {text.blacklist}
                                    </Button>
                                </div>
                            </div>

                            <Select
                                id="channel-select"
                                items={channels}
                                aria-label={text.channelsSelectLabel}
                                variant="faded"
                                isMultiline={true}
                                selectionMode="multiple"
                                placeholder={text.channelsSelectPlaceholder}
                                selectedKeys={selectedChannels}
                                onSelectionChange={(keys) => setSelectedChannels(keys as Set<string>)}
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
                                                    <SpeakerHigh size={14} className="text-default-400" />
                                                    <span>{item.textValue}</span>
                                                </div>
                                            </Chip>
                                        ))}
                                    </div>
                                )}
                            >
                                {(channel) => (
                                    <SelectItem key={channel.id} textValue={channel.name}>
                                        <div className="flex items-center gap-3">
                                            <SpeakerHigh size={20} className="text-default-400" />
                                            <span className="text-base font-bold text-white">{channel.name}</span>
                                        </div>
                                    </SelectItem>
                                )}
                            </Select>
                        </CardBody>
                    </Card>
                </div>

                {/* Added spacer for floating bar */}
                <div className="h-24"></div>
            </div>

            {/* Floating Action Bar - Fixed to viewport bottom */}
            <div className={`fixed bottom-6 left-0 right-0 z-50 flex justify-center px-4 transition-all duration-300 transform ${isDirty ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0 pointer-events-none'}`}>
                <div className="bg-[#181A20]/80 backdrop-blur-xl border border-white/10 shadow-2xl rounded-[24px] p-2 flex gap-3 w-full max-w-2xl transform transition-all duration-300 hover:scale-[1.01] hover:bg-[#181A20]/90">
                    <Button
                        color="primary"
                        size="lg"
                        className="flex-1 h-14 rounded-2xl font-bold text-lg shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all duration-300"
                        onPress={handleSave}
                        isLoading={isSaving}
                        startContent={!isSaving && <CheckCircle size={24} weight="fill" />}
                    >
                        {isSaving ? text.saving : text.saveChanges}
                    </Button>
                    <Button
                        variant="bordered"
                        size="lg"
                        className="h-14 w-14 min-w-14 rounded-2xl border-white/10 text-default-500 hover:text-white hover:bg-white/5 hover:border-white/20"
                        onPress={handleReset}
                        isIconOnly
                        aria-label={text.resetDefaults}
                    >
                        <ArrowClockwise size={24} weight="bold" />
                    </Button>
                </div>
            </div>
        </>
    );
}
