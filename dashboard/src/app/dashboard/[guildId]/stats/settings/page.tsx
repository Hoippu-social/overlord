'use client';

import React, { useState, use } from 'react';
import { Card, CardBody, Switch, Button, Chip, Input } from "@nextui-org/react";
import { Gear, Eye, EyeSlash, Trash, Plus, X } from "@phosphor-icons/react";
import { useGuildLocale } from "@/lib/i18n";

interface SettingsPageProps {
    params: Promise<{
        guildId: string;
    }>;
}

const strings = {
    en: {
        title: 'Statistics Settings',
        subtitle: 'Configure data collection and privacy',
        dataCollection: 'Data Collection',
        enableStats: 'Enable Statistics Tracking',
        enableStatsDesc: 'Collect message, voice, and member data for analytics',
        trackMessages: 'Track Messages',
        trackVoice: 'Track Voice Activity',
        trackMembers: 'Track Member Joins/Leaves',
        privacy: 'Privacy Settings',
        anonymousMode: 'Anonymous Mode',
        anonymousModeDesc: 'Hide user identities in public leaderboards',
        hideFromPublic: 'Hide from Public',
        hideFromPublicDesc: 'Make statistics private (only visible to admins)',
        filters: 'Channel & Role Exclusions',
        ignoredChannels: 'Ignored Channels',
        ignoredChannelsDesc: 'Messages from these channels will not be counted',
        ignoredRoles: 'Ignored Roles',
        ignoredRolesDesc: 'Users with these roles will be excluded from statistics',
        addChannel: 'Add channel...',
        addRole: 'Add role...',
        dataManagement: 'Data Management',
        clearData: 'Clear All Statistics',
        clearDataDesc: 'Permanently delete all collected statistics data. This action cannot be undone.',
        clearButton: 'Clear Data',
        exportData: 'Export Data',
        exportDataDesc: 'Download all statistics data as JSON file',
        exportButton: 'Export',
        saveButton: 'Save Changes',
        noChannels: 'No channels excluded',
        noRoles: 'No roles excluded',
        premium: 'Premium',
    },
    ru: {
        title: 'Настройки статистики',
        subtitle: 'Конфигурация сбора данных и приватности',
        dataCollection: 'Сбор данных',
        enableStats: 'Включить отслеживание статистики',
        enableStatsDesc: 'Собирать данные о сообщениях, голосе и участниках',
        trackMessages: 'Отслеживать сообщения',
        trackVoice: 'Отслеживать голосовую активность',
        trackMembers: 'Отслеживать вступления/выходы',
        privacy: 'Настройки приватности',
        anonymousMode: 'Анонимный режим',
        anonymousModeDesc: 'Скрыть личности пользователей в публичных лидербордах',
        hideFromPublic: 'Скрыть от публики',
        hideFromPublicDesc: 'Сделать статистику приватной (видна только админам)',
        filters: 'Исключения каналов и ролей',
        ignoredChannels: 'Игнорируемые каналы',
        ignoredChannelsDesc: 'Сообщения из этих каналов не будут учитываться',
        ignoredRoles: 'Игнорируемые роли',
        ignoredRolesDesc: 'Пользователи с этими ролями будут исключены из статистики',
        addChannel: 'Добавить канал...',
        addRole: 'Добавить роль...',
        dataManagement: 'Управление данными',
        clearData: 'Очистить всю статистику',
        clearDataDesc: 'Безвозвратно удалить все собранные данные. Это действие необратимо.',
        clearButton: 'Очистить',
        exportData: 'Экспорт данных',
        exportDataDesc: 'Скачать все данные статистики как JSON файл',
        exportButton: 'Экспорт',
        saveButton: 'Сохранить изменения',
        noChannels: 'Нет исключённых каналов',
        noRoles: 'Нет исключённых ролей',
        premium: 'Премиум',
    },
} as const;

export default function SettingsPage({ params }: SettingsPageProps) {
    const { guildId } = use(params);
    const { locale } = useGuildLocale(guildId);
    const text = strings[locale];

    const [statsEnabled, setStatsEnabled] = useState(true);
    const [trackMessages, setTrackMessages] = useState(true);
    const [trackVoice, setTrackVoice] = useState(true);
    const [trackMembers, setTrackMembers] = useState(true);
    const [anonymousMode, setAnonymousMode] = useState(false);
    const [hideFromPublic, setHideFromPublic] = useState(false);

    // Mock excluded channels/roles
    const [excludedChannels, setExcludedChannels] = useState<string[]>(['bot-commands', 'admin-chat']);
    const [excludedRoles, setExcludedRoles] = useState<string[]>(['Bot', 'Muted']);

    const removeChannel = (channel: string) => {
        setExcludedChannels(prev => prev.filter(c => c !== channel));
    };

    const removeRole = (role: string) => {
        setExcludedRoles(prev => prev.filter(r => r !== role));
    };

    return (
        <div className="p-6 space-y-6 max-w-4xl">
            {/* Header */}
            <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-zinc-500/10 flex items-center justify-center">
                    <Gear size={28} weight="fill" className="text-zinc-400" />
                </div>
                <div>
                    <h1 className="text-3xl font-black">{text.title}</h1>
                    <p className="text-default-400 text-sm">{text.subtitle}</p>
                </div>
            </div>

            {/* Data Collection */}
            <Card className="bg-[#181A20] border-white/5 shadow-xl">
                <CardBody className="p-6 space-y-5">
                    <h2 className="text-lg font-bold">{text.dataCollection}</h2>

                    {/* Main toggle */}
                    <div className="flex items-center justify-between p-4 rounded-xl bg-white/5">
                        <div className="flex-1">
                            <h3 className="font-semibold">{text.enableStats}</h3>
                            <p className="text-sm text-default-400">{text.enableStatsDesc}</p>
                        </div>
                        <Switch
                            isSelected={statsEnabled}
                            onValueChange={setStatsEnabled}
                            color="primary"
                            size="lg"
                        />
                    </div>

                    {/* Sub toggles */}
                    <div className={`space-y-3 transition-opacity ${!statsEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
                        <div className="flex items-center justify-between py-2">
                            <span className="text-sm">{text.trackMessages}</span>
                            <Switch isSelected={trackMessages} onValueChange={setTrackMessages} color="primary" />
                        </div>
                        <div className="flex items-center justify-between py-2">
                            <span className="text-sm">{text.trackVoice}</span>
                            <Switch isSelected={trackVoice} onValueChange={setTrackVoice} color="primary" />
                        </div>
                        <div className="flex items-center justify-between py-2">
                            <span className="text-sm">{text.trackMembers}</span>
                            <Switch isSelected={trackMembers} onValueChange={setTrackMembers} color="primary" />
                        </div>
                    </div>
                </CardBody>
            </Card>

            {/* Privacy Settings */}
            <Card className="bg-[#181A20] border-white/5 shadow-xl">
                <CardBody className="p-6 space-y-4">
                    <h2 className="text-lg font-bold">{text.privacy}</h2>

                    <div className="flex items-center justify-between p-4 rounded-xl bg-white/5">
                        <div className="flex-1">
                            <div className="flex items-center gap-2">
                                {anonymousMode ? (
                                    <EyeSlash size={18} weight="fill" className="text-default-400" />
                                ) : (
                                    <Eye size={18} weight="fill" className="text-default-400" />
                                )}
                                <h3 className="font-semibold">{text.anonymousMode}</h3>
                            </div>
                            <p className="text-sm text-default-400 mt-1">{text.anonymousModeDesc}</p>
                        </div>
                        <Switch
                            isSelected={anonymousMode}
                            onValueChange={setAnonymousMode}
                            color="secondary"
                        />
                    </div>

                    <div className="flex items-center justify-between p-4 rounded-xl bg-white/5">
                        <div className="flex-1">
                            <div className="flex items-center gap-2">
                                <h3 className="font-semibold">{text.hideFromPublic}</h3>
                                <Chip size="sm" variant="flat" color="warning">{text.premium}</Chip>
                            </div>
                            <p className="text-sm text-default-400 mt-1">{text.hideFromPublicDesc}</p>
                        </div>
                        <Switch
                            isSelected={hideFromPublic}
                            onValueChange={setHideFromPublic}
                            color="secondary"
                            isDisabled
                        />
                    </div>
                </CardBody>
            </Card>

            {/* Filters & Exclusions */}
            <Card className="bg-[#181A20] border-white/5 shadow-xl">
                <CardBody className="p-6 space-y-5">
                    <h2 className="text-lg font-bold">{text.filters}</h2>

                    {/* Ignored Channels */}
                    <div>
                        <h3 className="font-semibold mb-1">{text.ignoredChannels}</h3>
                        <p className="text-sm text-default-400 mb-3">{text.ignoredChannelsDesc}</p>
                        <div className="flex flex-wrap gap-2 mb-2">
                            {excludedChannels.length === 0 ? (
                                <span className="text-sm text-default-500">{text.noChannels}</span>
                            ) : (
                                excludedChannels.map(channel => (
                                    <Chip
                                        key={channel}
                                        variant="flat"
                                        onClose={() => removeChannel(channel)}
                                        classNames={{
                                            base: "bg-primary/10 text-primary",
                                            closeButton: "text-primary hover:text-primary/80"
                                        }}
                                    >
                                        #{channel}
                                    </Chip>
                                ))
                            )}
                        </div>
                        <Input
                            placeholder={text.addChannel}
                            size="sm"
                            variant="bordered"
                            startContent={<Plus size={16} className="text-default-400" />}
                            classNames={{
                                input: "text-sm",
                                inputWrapper: "bg-white/5"
                            }}
                        />
                    </div>

                    {/* Ignored Roles */}
                    <div>
                        <h3 className="font-semibold mb-1">{text.ignoredRoles}</h3>
                        <p className="text-sm text-default-400 mb-3">{text.ignoredRolesDesc}</p>
                        <div className="flex flex-wrap gap-2 mb-2">
                            {excludedRoles.length === 0 ? (
                                <span className="text-sm text-default-500">{text.noRoles}</span>
                            ) : (
                                excludedRoles.map(role => (
                                    <Chip
                                        key={role}
                                        variant="flat"
                                        onClose={() => removeRole(role)}
                                        classNames={{
                                            base: "bg-emerald-500/10 text-emerald-500",
                                            closeButton: "text-emerald-500 hover:text-emerald-500/80"
                                        }}
                                    >
                                        @{role}
                                    </Chip>
                                ))
                            )}
                        </div>
                        <Input
                            placeholder={text.addRole}
                            size="sm"
                            variant="bordered"
                            startContent={<Plus size={16} className="text-default-400" />}
                            classNames={{
                                input: "text-sm",
                                inputWrapper: "bg-white/5"
                            }}
                        />
                    </div>
                </CardBody>
            </Card>

            {/* Data Management */}
            <Card className="bg-[#181A20] border-red-500/20 shadow-xl">
                <CardBody className="p-6 space-y-4">
                    <h2 className="text-lg font-bold text-red-500">{text.dataManagement}</h2>

                    <div className="flex items-start justify-between gap-4 p-4 rounded-xl bg-red-500/5">
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                                <Trash size={18} weight="fill" className="text-red-500" />
                                <h3 className="font-semibold">{text.clearData}</h3>
                            </div>
                            <p className="text-sm text-default-400">{text.clearDataDesc}</p>
                        </div>
                        <Button
                            color="danger"
                            variant="flat"
                            size="sm"
                        >
                            {text.clearButton}
                        </Button>
                    </div>

                    <div className="flex items-start justify-between gap-4 p-4 rounded-xl bg-white/5">
                        <div className="flex-1">
                            <h3 className="font-semibold mb-1">{text.exportData}</h3>
                            <p className="text-sm text-default-400">{text.exportDataDesc}</p>
                        </div>
                        <Button
                            color="default"
                            variant="bordered"
                            size="sm"
                        >
                            {text.exportButton}
                        </Button>
                    </div>
                </CardBody>
            </Card>

            {/* Save Button */}
            <div className="flex justify-end pt-2">
                <Button
                    color="primary"
                    size="lg"
                    className="px-8 font-semibold"
                >
                    {text.saveButton}
                </Button>
            </div>
        </div>
    );
}
