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

const ChannelItem = ({ item }: { item: ChannelOption }) => (
    <div className="flex items-center gap-2 w-full px-2 py-1.5">
        <span className="text-base truncate">{item.name || item.id}</span>
    </div>
);

export default function TempVoicePage({ params }: { params: Promise<{ guildId: string }> }) {
    const { guildId } = React.use(params);

    const [mode, setMode] = useState<Mode>('create');
    const [channels, setChannels] = useState<{ categories: ChannelOption[]; voice: ChannelOption[]; text: ChannelOption[] }>({
        categories: [],
        voice: [],
        text: [],
    });
    const [form, setForm] = useState({
        categoryName: 'Temporary Voice',
        hubName: 'Join to Create',
        interfaceName: 'temp-voice-control',
        categoryId: '',
        hubChannelId: '',
        interfaceChannelId: '',
        nameTemplate: 'Room {user}',
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
            nameTemplate: cfg.nameTemplate || 'Room {user}',
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
                throw new Error(data.error || 'Не удалось загрузить конфигурацию');
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
        } catch (err: any) {
            setError(err?.message || 'Неизвестная ошибка');
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
            const payload: any = {
                mode,
                nameTemplate: form.nameTemplate.trim() || 'Room {user}',
                userLimit: form.userLimit === '' ? null : Number(form.userLimit),
            };

            if (mode === 'create') {
                payload.categoryName = form.categoryName.trim() || 'Temporary Voice';
                payload.hubName = form.hubName.trim() || 'Join to Create';
                payload.interfaceName = form.interfaceName.trim() || 'temp-voice-control';
            } else {
                if (!form.categoryId || !form.hubChannelId || !form.interfaceChannelId) {
                    throw new Error('Выберите существующие каналы');
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
                throw new Error(data?.error || 'Не удалось сохранить настройки');
            }

            setConfig(data.config || null);
            applyConfigToForm(data.config || null);
            await fetchData();
        } catch (err: any) {
            setError(err?.message || 'Неизвестная ошибка сохранения');
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
                throw new Error('Выберите категорию, хаб и интерфейсный текстовый канал');
            }

            const res = await fetch(`/api/guilds/${guildId}/tempvoice`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    mode: 'existing',
                    categoryId,
                    hubChannelId,
                    interfaceChannelId,
                    nameTemplate: form.nameTemplate.trim() || 'Room {user}',
                    userLimit: form.userLimit === '' ? null : Number(form.userLimit),
                    sendPanel: true,
                }),
            });

            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(data?.error || 'Не удалось отправить панель управления');
            }

            if (data.config) {
                setConfig(data.config);
                applyConfigToForm(data.config);
            }
        } catch (err: any) {
            setError(err?.message || 'Не удалось отправить панель управления');
        } finally {
            setSendingPanel(false);
        }
    };

    const handleDelete = async () => {
        if (!guildId) return;
        if (deleteConfirm.trim().toUpperCase() !== 'DELETE') {
            setError('Введите DELETE для подтверждения удаления');
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
                throw new Error(data?.error || 'Не удалось удалить конфигурацию');
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
        } catch (err: any) {
            setError(err?.message || 'Неизвестная ошибка удаления');
        } finally {
            setDeleting(false);
        }
    };

    const limitLabel = (limit: number) => (limit === 0 ? 'Без лимита' : `${limit}`);

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold">Приватные комнаты</h1>
                    <p className="text-default-500">Настройка хаба, категорий и панелей без команды /setupv</p>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="flat"
                        startContent={<ArrowsClockwise size={18} />}
                        onPress={fetchData}
                        isDisabled={loading}
                    >
                        Обновить
                    </Button>
                    <Button
                        variant="flat"
                        onPress={handleSendPanel}
                        isLoading={sendingPanel}
                        isDisabled={loading || sendingPanel}
                    >
                        Отправить панель
                    </Button>
                    <Chip color={config ? 'success' : 'warning'} variant="flat" startContent={<Sparkle size={16} />}>
                        {config ? 'Настроено' : 'Нет конфигурации'}
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
                                <h3 className="text-xl font-bold">Структура и панели</h3>
                                <p className="text-default-500 text-sm">Создайте новую структуру или привяжите уже существующие каналы</p>
                            </div>
                            <ButtonGroup radius="sm">
                                <Button
                                    color={mode === 'create' ? 'primary' : 'default'}
                                    variant={mode === 'create' ? 'solid' : 'flat'}
                                    onPress={() => setMode('create')}
                                >
                                    Новая структура
                                </Button>
                                <Button
                                    color={mode === 'existing' ? 'primary' : 'default'}
                                    variant={mode === 'existing' ? 'solid' : 'flat'}
                                    onPress={() => setMode('existing')}
                                >
                                    Использовать существующие
                                </Button>
                            </ButtonGroup>
                        </div>

                        <Divider />

                        {mode === 'create' ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Input
                                    label="Категория"
                                    placeholder="Temporary Voice"
                                    value={form.categoryName}
                                    onChange={(e) => setForm({ ...form, categoryName: e.target.value })}
                                    variant="bordered"
                                />
                                <Input
                                    label="Хаб (voice)"
                                    placeholder="Join to Create"
                                    value={form.hubName}
                                    onChange={(e) => setForm({ ...form, hubName: e.target.value })}
                                    variant="bordered"
                                />
                                <Input
                                    label="Интерфейс (text)"
                                    placeholder="temp-voice-control"
                                    value={form.interfaceName}
                                    onChange={(e) => setForm({ ...form, interfaceName: e.target.value })}
                                    variant="bordered"
                                />
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <Select
                                    label="Категория"
                                    variant="bordered"
                                    placeholder="Выберите категорию"
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
                                    label="Хаб (voice)"
                                    variant="bordered"
                                    placeholder="Выберите голосовой канал"
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
                                    label="Интерфейс (text)"
                                    variant="bordered"
                                    placeholder="Выберите текстовый канал"
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
                                    <h3 className="text-xl font-bold">Состояние</h3>
                                    <p className="text-default-500 text-sm">Быстрый статус текущей конфигурации</p>
                                </div>
                            </div>
                            {loading && <Spinner size="sm" color="secondary" />}
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <StatusChip
                                label="Категория"
                                value={resolveChannelName(config?.categoryId) || '—'}
                                hint={config?.categoryId && !resolveChannelName(config?.categoryId) ? `ID: ${config.categoryId}` : undefined}
                            />
                            <StatusChip
                                label="Хаб"
                                value={resolveChannelName(config?.hubChannelId) || '—'}
                                hint={config?.hubChannelId && !resolveChannelName(config?.hubChannelId) ? `ID: ${config.hubChannelId}` : undefined}
                            />
                            <StatusChip
                                label="Интерфейс"
                                value={resolveChannelName(config?.interfaceChannelId) || '—'}
                                hint={config?.interfaceChannelId && !resolveChannelName(config?.interfaceChannelId) ? `ID: ${config.interfaceChannelId}` : undefined}
                            />
                            <StatusChip label="Активных комнат" value={roomsCount.toString()} />
                        </div>

                        <Divider />

                        <div className="space-y-2">
                            <p className="text-sm text-default-500">Шаблон имени</p>
                            <Chip color="secondary" variant="flat">{config?.nameTemplate || 'Room {user}'}</Chip>
                            <p className="text-sm text-default-500">Лимит</p>
                            <Chip color="secondary" variant="flat">{config?.userLimit ?? 'Без лимита'}</Chip>
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
                            <h3 className="text-xl font-bold">Правила комнат</h3>
                            <p className="text-default-500 text-sm">Шаблон имени и лимит пользователей по умолчанию</p>
                        </div>
                    </div>

                    <div className="space-y-5">
                        <div className="space-y-2">
                            <FieldLabel icon={<TextT size={18} />} text="Шаблон имени комнаты" />
                            <Textarea
                                minRows={2}
                                placeholder="Используйте {user} для имени владельца"
                                value={form.nameTemplate}
                                onChange={(e) => setForm({ ...form, nameTemplate: e.target.value })}
                                variant="bordered"
                            />
                        </div>

                        <div className="space-y-3 w-full">
                            <FieldLabel icon={<UsersThree size={18} />} text="Лимит участников" />
                            <Input
                                type="number"
                                placeholder="0 = без лимита"
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
                            <p className="text-xs text-default-500">0 означает отсутствие ограничения</p>
                        </div>
                    </div>

                    <Divider />

                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <Button color="primary" onPress={handleSave} isLoading={saving} isDisabled={loading || saving}>
                            Сохранить
                        </Button>
                        <Tooltip content="Удалит категорию, хаб, панель и активные комнаты">
                            <Button
                                color="danger"
                                variant="flat"
                                onPress={handleDelete}
                                isLoading={deleting}
                                isDisabled={deleting || loading}
                                startContent={<TrashSimple size={18} />}
                            >
                                Удалить всё
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
                            <h3 className="text-xl font-bold text-danger">Удаление конфигурации</h3>
                            <p className="text-default-500 text-sm">Удалит все созданные комнаты и каналы. Подтвердите, введя DELETE.</p>
                        </div>
                    </div>

                    <div className="flex flex-col md:flex-row gap-3 items-end">
                        <Input
                            label="Подтверждение"
                            placeholder="DELETE"
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
                            Подтвердить удаление
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
