'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardBody, Button, Switch, Slider, Select, SelectItem, Input, Chip, SelectedItems, ButtonGroup, Checkbox } from "@nextui-org/react";
import { MusicNote, SpeakerHigh, Clock, Users, List, Prohibit, CheckCircle } from "@phosphor-icons/react";

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

// Helper to determine text color based on background
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

export default function MusicSettingsPage({ params }: { params: Promise<{ guildId: string }> }) {
    const { guildId } = React.use(params);
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
    const [isDirty, setIsDirty] = useState(false);
    const [initialLoaded, setInitialLoaded] = useState(false);

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

        // Load existing music config
        fetch(`/api/guilds/${guildId}/music`)
            .then(res => res.json())
            .then(data => {
                if (data.config) {
                    const config = data.config;
                    if (config.channelMode) setChannelMode(config.channelMode);
                    if (config.allowedChannels) {
                        try {
                            const channels = JSON.parse(config.allowedChannels);
                            setSelectedChannels(new Set(channels));
                        } catch (e) { /* ignore parse errors */ }
                    }
                    if (config.djRoles) {
                        try {
                            const roles = JSON.parse(config.djRoles);
                            setDjRoles(new Set(roles));
                        } catch (e) { /* ignore parse errors */ }
                    }
                }
                setInitialLoaded(true);
            })
            .catch(err => console.error('Failed to load music config:', err));
    }, [guildId]);

    // Track dirty state after initial load
    useEffect(() => {
        if (initialLoaded) {
            setIsDirty(true);
        }
    }, [djRoles, channelMode, selectedChannels, defaultVolume, maxDuration, maxDurationEnabled]);

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
                }),
            });
            if (response.ok) {
                setIsDirty(false);
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
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold">Music Settings</h1>
                <p className="text-default-500">Configure playback behavior and permissions</p>
            </div>

            <div className="flex flex-col gap-6 w-full">
                {/* DJ Role */}
                <Card className="bg-surface border border-divider w-full">
                    <CardBody className="p-6 space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-primary/10 rounded-lg text-primary"><Users size={24} /></div>
                            <div>
                                <h3 className="text-xl font-bold">DJ Roles</h3>
                                <p className="text-default-500 text-sm">Users with these roles can control the music player without voting</p>
                            </div>
                        </div>

                        <Select
                            id="dj-roles-select"
                            items={roles}
                            label="Select DJ Roles"
                            variant="bordered"
                            isMultiline={true}
                            selectionMode="multiple"
                            placeholder="Choose roles"
                            selectedKeys={djRoles}
                            onSelectionChange={(keys) => setDjRoles(keys as Set<string>)}
                            color="secondary"
                            classNames={{
                                trigger: "min-h-unit-12 py-2",
                                value: "text-large",
                                popoverContent: "bg-surface border border-divider",
                                listbox: "p-1",
                            }}
                            listboxProps={{
                                itemClasses: {
                                    base: "py-2 min-h-[48px]",
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
                                // Use different colors for roles without assigned color
                                const hasColor = role.color && role.color !== '#000000';
                                const textBorderColor = hasColor ? role.color : '#a1a1aa'; // zinc-400 for text/border
                                const bgColor = hasColor ? role.color : '#52525b'; // zinc-600 for background
                                const isSelected = djRoles.has(role.id);

                                return (
                                    <SelectItem key={role.id} textValue={role.name} className="data-[hover=true]:bg-default/40">
                                        <div className="flex items-center gap-3 py-1">
                                            {/* Explicit Checkbox */}
                                            <Checkbox isSelected={isSelected} color="secondary" disableAnimation />

                                            {/* Role Case/Chip */}
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

                {/* Channel Whitelist/Blacklist */}
                <Card className="bg-surface border border-divider w-full">
                    <CardBody className="p-6 space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-secondary/10 rounded-lg text-secondary">
                                    {channelMode === 'whitelist' ? <CheckCircle size={24} /> : <Prohibit size={24} />}
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold">Voice Channels</h3>
                                    <p className="text-default-500 text-sm">
                                        {selectedChannels.size === 0
                                            ? "Function disabled (no channels selected)"
                                            : channelMode === 'whitelist'
                                                ? "Only allow bot in selected channels"
                                                : "Block bot from selected channels"}
                                    </p>
                                </div>
                            </div>

                            <ButtonGroup>
                                <Button
                                    color={channelMode === 'whitelist' ? 'success' : 'default'}
                                    variant={channelMode === 'whitelist' ? 'solid' : 'bordered'}
                                    onPress={() => setChannelMode('whitelist')}
                                >
                                    Whitelist
                                </Button>
                                <Button
                                    color={channelMode === 'blacklist' ? 'danger' : 'default'}
                                    variant={channelMode === 'blacklist' ? 'solid' : 'bordered'}
                                    onPress={() => setChannelMode('blacklist')}
                                >
                                    Blacklist
                                </Button>
                            </ButtonGroup>
                        </div>

                        <Select
                            id="channel-select"
                            items={channels}
                            label="Select Channels"
                            variant="bordered"
                            isMultiline={true}
                            selectionMode="multiple"
                            placeholder="Choose voice channels"
                            selectedKeys={selectedChannels}
                            onSelectionChange={(keys) => setSelectedChannels(keys as Set<string>)}
                            color="secondary"
                            classNames={{
                                trigger: "min-h-unit-12 py-2",
                                value: "text-large",
                            }}
                        >
                            {(channel) => (
                                <SelectItem key={channel.id} textValue={channel.name} className="text-large">
                                    <div className="flex items-center gap-2">
                                        <span className="text-lg">{channel.name}</span>
                                    </div>
                                </SelectItem>
                            )}
                        </Select>
                    </CardBody>
                </Card>

                {/* Default Volume */}
                <Card className="bg-surface border border-divider w-full">
                    <CardBody className="p-6 space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-success/10 rounded-lg text-success"><SpeakerHigh size={24} /></div>
                            <div>
                                <h3 className="text-xl font-bold">Default Volume</h3>
                                <p className="text-default-500 text-sm">Set the initial volume for the bot when joining</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <span className="text-lg font-semibold">{defaultVolume}%</span>
                            </div>
                            <Slider
                                id="volume-slider"
                                size="lg"
                                step={1}
                                maxValue={100}
                                minValue={0}
                                value={defaultVolume}
                                onChange={(value) => setDefaultVolume(value as number)}
                                className="w-full"
                                color="success"
                                showSteps={false}
                            />
                        </div>
                    </CardBody>
                </Card>

                {/* Max Duration */}
                <Card className="bg-surface border border-divider w-full">
                    <CardBody className="p-6 space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-warning/10 rounded-lg text-warning"><Clock size={24} /></div>
                            <div className="flex-1">
                                <h3 className="text-xl font-bold">Max Track Duration</h3>
                                <p className="text-default-500 text-sm">Limit the length of songs that can be queued</p>
                            </div>
                            <Switch
                                id="max-duration-switch"
                                isSelected={maxDurationEnabled}
                                onValueChange={setMaxDurationEnabled}
                                color="warning"
                                size="lg"
                            />
                        </div>

                        {maxDurationEnabled && (
                            <div className="pt-2">
                                <Input
                                    type="number"
                                    label="Max Duration"
                                    placeholder="30"
                                    value={maxDuration.toString()}
                                    onValueChange={(value) => setMaxDuration(parseInt(value) || 0)}
                                    endContent={
                                        <div className="pointer-events-none flex items-center">
                                            <span className="text-default-400 text-small">min</span>
                                        </div>
                                    }
                                    variant="bordered"
                                />
                            </div>
                        )}
                    </CardBody>
                </Card>

                {/* Save Button */}
                <div className="flex gap-3 pt-4">
                    <Button
                        color="primary"
                        size="lg"
                        className="flex-1 font-semibold shadow-lg shadow-primary/20"
                        onPress={handleSave}
                        isLoading={isSaving}
                        isDisabled={!isDirty}
                    >
                        {isSaving ? 'Saving...' : 'Save Changes'}
                    </Button>
                    <Button
                        variant="flat"
                        size="lg"
                        className="font-semibold"
                        onPress={handleReset}
                    >
                        Reset Defaults
                    </Button>
                </div>
            </div>
        </div>
    );
}
