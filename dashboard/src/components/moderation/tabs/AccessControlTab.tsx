import React from 'react';
import { ConfigState, RoleBinding } from '@/app/dashboard/[guildId]/moderation/types';
import { removeAtIndex, updateAtIndex } from '@/app/dashboard/[guildId]/moderation/constants';
import {
    buildPresetStorageTitle,
    collectPresetDefinitions,
    normalizeHexColor,
    normalizePresetName,
    parsePresetTitle,
} from '@/app/dashboard/[guildId]/moderation/presets';
import { AnimatedCard, InteractiveSelect, MultiSelectField, SliderField, SmoothToggle, TagsInputField } from '@/components/moderation/ui';
import { CommandOverridesPanel } from '@/components/commands/CommandOverridesPanel';
import { ShieldCheck, ShieldStar, ShieldWarning, Trash, UserCircleGear } from '@phosphor-icons/react';
import { Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from '@nextui-org/react';

interface AccessControlTabProps {
    config: ConfigState;
    setConfig: React.Dispatch<React.SetStateAction<ConfigState>>;
    locale: 'en' | 'ru';
    tr: (ru: string, en: string) => string;
}

export function AccessControlTab({ config, setConfig, locale, tr }: AccessControlTabProps) {
    const NO_PRESET_ID = '__no_preset__';
    const CREATE_PRESET_ID = '__create_preset__';
    const EDIT_PRESET_ID = '__edit_preset__';
    const PRESET_DIVIDER_ID = '__preset_divider__';
    const DEFAULT_CUSTOM_PRESET_LEVEL = 50;
    const DEFAULT_CUSTOM_PRESET_COLOR = '#60A5FA';
    const PRESET_COLOR_SWATCHES = ['#60A5FA', '#FCD34D', '#F59E0B', '#FB7185', '#34D399', '#A78BFA', '#F472B6', '#E5E7EB'];

    const [isPresetModalOpen, setIsPresetModalOpen] = React.useState(false);
    const [presetModalMode, setPresetModalMode] = React.useState<'create' | 'edit'>('create');
    const [presetTargetIndex, setPresetTargetIndex] = React.useState<number | null>(null);
    const [editingPresetId, setEditingPresetId] = React.useState('');
    const [newPresetName, setNewPresetName] = React.useState('');
    const [newPresetLevel, setNewPresetLevel] = React.useState(DEFAULT_CUSTOM_PRESET_LEVEL);
    const [newPresetColor, setNewPresetColor] = React.useState(DEFAULT_CUSTOM_PRESET_COLOR);
    const [presetModalError, setPresetModalError] = React.useState('');

    const presetDefinitions = React.useMemo(
        () => collectPresetDefinitions(config.roleBindings),
        [config.roleBindings],
    );

    const presetById = React.useMemo(
        () => new Map(presetDefinitions.map((preset) => [preset.id, preset])),
        [presetDefinitions],
    );

    const presetByKey = React.useMemo(
        () => new Map(presetDefinitions.map((preset) => [preset.key, preset])),
        [presetDefinitions],
    );

    const customPresetDefinitions = React.useMemo(
        () => presetDefinitions.filter((preset) => !preset.isBuiltin),
        [presetDefinitions],
    );

    const editingPreset = React.useMemo(
        () => customPresetDefinitions.find((preset) => preset.id === editingPresetId) ?? null,
        [customPresetDefinitions, editingPresetId],
    );

    const presetOptions = React.useMemo(
        () => [
            { id: CREATE_PRESET_ID, name: tr('Создать', 'Create'), isAction: true, actionVariant: 'create' as const },
            { id: EDIT_PRESET_ID, name: tr('Редактировать', 'Edit'), isAction: true, actionVariant: 'edit' as const },
            { id: PRESET_DIVIDER_ID, name: tr('──── пресеты ────', '──── presets ────'), disabled: true, isSeparator: true },
            { id: NO_PRESET_ID, name: tr('Без пресета', 'No preset') },
            ...presetDefinitions.map((preset) => ({
                id: preset.id,
                name: `${preset.name} (${preset.accessLevel})`,
                color: preset.color ?? undefined,
            })),
        ],
        [presetDefinitions, tr],
    );

    const customPresetOptions = React.useMemo(
        () => customPresetDefinitions.map((preset) => ({
            id: preset.id,
            name: `${preset.name} (${preset.accessLevel})`,
            color: preset.color ?? undefined,
        })),
        [customPresetDefinitions],
    );

    const updateModConfig = (key: keyof ConfigState['moderationConfig'], value: string | string[]) => {
        setConfig((prev) => ({
            ...prev,
            moderationConfig: { ...prev.moderationConfig, [key]: value },
        }));
    };

    const addBinding = () => {
        if (config.roleBindings.length >= 15) return;
        setConfig((prev) => ({
            ...prev,
            roleBindings: [...prev.roleBindings, { roleId: '', title: '', accessLevel: 50, enabled: true, sortOrder: prev.roleBindings.length }],
        }));
    };

    const updateBinding = (index: number, value: Partial<RoleBinding>) => {
        setConfig((prev) => ({
            ...prev,
            roleBindings: updateAtIndex(prev.roleBindings, index, { ...prev.roleBindings[index], ...value }),
        }));
    };

    const beginCreatePreset = (index: number) => {
        setPresetModalMode('create');
        setPresetTargetIndex(index);
        setEditingPresetId('');
        setNewPresetName('');
        setNewPresetLevel(config.roleBindings[index]?.accessLevel ?? DEFAULT_CUSTOM_PRESET_LEVEL);
        setNewPresetColor(DEFAULT_CUSTOM_PRESET_COLOR);
        setPresetModalError('');
        setIsPresetModalOpen(true);
    };

    const beginEditPreset = () => {
        const firstPreset = customPresetDefinitions[0] ?? null;
        setPresetModalMode('edit');
        setPresetTargetIndex(null);
        setEditingPresetId(firstPreset?.id ?? '');
        setNewPresetName(firstPreset?.name ?? '');
        setNewPresetLevel(firstPreset?.accessLevel ?? DEFAULT_CUSTOM_PRESET_LEVEL);
        setNewPresetColor(firstPreset?.color ?? DEFAULT_CUSTOM_PRESET_COLOR);
        setPresetModalError('');
        setIsPresetModalOpen(true);
    };

    const handleEditPresetSelection = (presetId: string) => {
        setEditingPresetId(presetId);
        const selectedPreset = customPresetDefinitions.find((preset) => preset.id === presetId);
        if (!selectedPreset) {
            setNewPresetName('');
            setNewPresetLevel(DEFAULT_CUSTOM_PRESET_LEVEL);
            setNewPresetColor(DEFAULT_CUSTOM_PRESET_COLOR);
            return;
        }

        setNewPresetName(selectedPreset.name);
        setNewPresetLevel(selectedPreset.accessLevel);
        setNewPresetColor(selectedPreset.color ?? DEFAULT_CUSTOM_PRESET_COLOR);
    };

    const handlePresetSelection = (index: number, selectedId: string) => {
        if (selectedId === PRESET_DIVIDER_ID) {
            return;
        }

        if (selectedId === CREATE_PRESET_ID) {
            beginCreatePreset(index);
            return;
        }

        if (selectedId === EDIT_PRESET_ID) {
            beginEditPreset();
            return;
        }

        if (selectedId === NO_PRESET_ID) {
            updateBinding(index, { title: '' });
            return;
        }

        const selectedPreset = presetById.get(selectedId);
        if (!selectedPreset) {
            return;
        }

        updateBinding(index, { title: selectedPreset.storageTitle, accessLevel: selectedPreset.accessLevel });
    };

    const closePresetModal = () => {
        setIsPresetModalOpen(false);
        setPresetModalMode('create');
        setPresetTargetIndex(null);
        setEditingPresetId('');
        setNewPresetName('');
        setNewPresetLevel(DEFAULT_CUSTOM_PRESET_LEVEL);
        setNewPresetColor(DEFAULT_CUSTOM_PRESET_COLOR);
        setPresetModalError('');
    };

    const validatePresetPayload = () => {
        const customName = normalizePresetName(newPresetName);
        if (!customName) {
            setPresetModalError(tr('Введите название пресета', 'Enter a preset name'));
            return null;
        }

        if (customName === NO_PRESET_ID || customName === CREATE_PRESET_ID || customName === EDIT_PRESET_ID) {
            setPresetModalError(tr('Это служебное имя недоступно', 'This reserved preset name is unavailable'));
            return null;
        }

        const normalizedColor = normalizeHexColor(newPresetColor);
        if (!normalizedColor) {
            setPresetModalError(tr('Введите корректный цвет в формате #RRGGBB', 'Enter a valid color in #RRGGBB format'));
            return null;
        }

        const normalizedLevel = Math.max(0, Math.min(100, Math.round(newPresetLevel)));
        return { customName, normalizedColor, normalizedLevel };
    };

    const submitPresetModal = () => {
        if (presetModalMode === 'create') {
            if (presetTargetIndex === null) return;

            const payload = validatePresetPayload();
            if (!payload) return;

            const presetKey = payload.customName.toLocaleLowerCase();
            if (presetByKey.has(presetKey)) {
                setPresetModalError(tr('Пресет с таким названием уже существует', 'A preset with this name already exists'));
                return;
            }

            const storageTitle = buildPresetStorageTitle({
                name: payload.customName,
                accessLevel: payload.normalizedLevel,
                color: payload.normalizedColor,
            });

            updateBinding(presetTargetIndex, { title: storageTitle, accessLevel: payload.normalizedLevel });
            closePresetModal();
            return;
        }

        if (!editingPreset) {
            setPresetModalError(tr('Выберите пресет для редактирования', 'Select a preset to edit'));
            return;
        }

        const payload = validatePresetPayload();
        if (!payload) return;

        const presetKey = payload.customName.toLocaleLowerCase();
        const presetWithSameKey = presetByKey.get(presetKey);
        if (presetWithSameKey && presetWithSameKey.id !== editingPreset.id) {
            setPresetModalError(tr('Пресет с таким названием уже существует', 'A preset with this name already exists'));
            return;
        }

        const storageTitle = buildPresetStorageTitle({
            name: payload.customName,
            accessLevel: payload.normalizedLevel,
            color: payload.normalizedColor,
        });

        setConfig((prev) => ({
            ...prev,
            roleBindings: prev.roleBindings.map((binding) => {
                const parsed = parsePresetTitle(binding.title);
                if (parsed.isBuiltin || parsed.key !== editingPreset.key) {
                    return binding;
                }

                return {
                    ...binding,
                    title: storageTitle,
                    accessLevel: payload.normalizedLevel,
                };
            }),
        }));

        closePresetModal();
    };

    const deleteEditingPreset = () => {
        if (!editingPreset) {
            setPresetModalError(tr('Выберите пресет для удаления', 'Select a preset to delete'));
            return;
        }

        setConfig((prev) => ({
            ...prev,
            roleBindings: prev.roleBindings.map((binding) => {
                const parsed = parsePresetTitle(binding.title);
                if (parsed.isBuiltin || parsed.key !== editingPreset.key) {
                    return binding;
                }

                return {
                    ...binding,
                    title: '',
                };
            }),
        }));

        closePresetModal();
    };

    const getBindingPresetOptionId = (binding: RoleBinding) => {
        const parsed = parsePresetTitle(binding.title);
        if (!parsed.name) {
            return NO_PRESET_ID;
        }

        const preset = presetByKey.get(parsed.key);
        return preset?.id ?? NO_PRESET_ID;
    };

    const removeBinding = (index: number) => {
        setConfig((prev) => ({
            ...prev,
            roleBindings: removeAtIndex(prev.roleBindings, index),
        }));
    };

    const getLevelIcon = (level: number) => {
        if (level >= 80) return <ShieldStar size={24} weight="duotone" className="text-rose-400" />;
        if (level >= 50) return <ShieldWarning size={24} weight="duotone" className="text-amber-400" />;
        return <ShieldCheck size={24} weight="duotone" className="text-blue-400" />;
    };

    return (
        <div className="space-y-8 animate-fade-in">
            <AnimatedCard
                title={tr('Базовые настройки модерации', 'Base Moderation Scope')}
                subtitle={tr('Глобальные правила игнорирования и роль для мьюта.', 'Global ignore rules and mute role setup.')}
            >
                <div className="grid grid-cols-1 gap-8 p-2 lg:grid-cols-2">
                    <InteractiveSelect
                        label={tr('Роль для мьюта', 'Mute Role')}
                        value={config.moderationConfig.muteRoleId}
                        onChange={(value) => updateModConfig('muteRoleId', value)}
                        options={config.roles}
                        placeholder={tr('Не выбрано', 'Not selected')}
                    />
                    <TagsInputField
                        label={tr('Игнорируемые пользователи (ID)', 'Ignored Users (IDs)')}
                        tags={config.moderationConfig.ignoredUsers}
                        onAdd={(tag) => updateModConfig('ignoredUsers', [...config.moderationConfig.ignoredUsers, tag])}
                        onRemove={(index) => updateModConfig('ignoredUsers', removeAtIndex(config.moderationConfig.ignoredUsers, index))}
                    />
                    <div className="col-span-1 grid grid-cols-1 gap-8 border-t border-white/5 pt-4 md:grid-cols-2 lg:col-span-2">
                        <MultiSelectField label={tr('Игнорируемые каналы', 'Ignored Channels')} options={config.channels} selected={config.moderationConfig.ignoredChannels} onChange={(keys) => updateModConfig('ignoredChannels', keys)} />
                        <MultiSelectField label={tr('Игнорируемые роли', 'Ignored Roles')} options={config.roles} selected={config.moderationConfig.ignoredRoles} onChange={(keys) => updateModConfig('ignoredRoles', keys)} />
                    </div>
                </div>
            </AnimatedCard>

            <AnimatedCard
                title={tr('Уровни доступа ролей', 'Role Access Levels')}
                subtitle={tr('Уровни доступа для ролей модерации (от 0 до 100). Максимум 15 ролей.', 'Access levels for staff roles (0 to 100). Max 15 roles.')}
            >
                <div className="mb-8 space-y-6">
                    {config.roleBindings.length === 0 ? (
                        <div className="flex flex-col items-center justify-center rounded-3xl border border-white/5 bg-white/[0.02] py-12 text-white/30">
                            <UserCircleGear size={48} weight="duotone" className="mb-4 opacity-50" />
                            <p className="text-lg font-semibold">{tr('Нет ролей с уровнем доступа', 'No roles with access levels')}</p>
                            <p className="mt-1 text-sm">{tr('Настройте доступы для модераторов.', 'Configure access levels for your staff.')}</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                            {config.roleBindings.map((binding, index) => (
                                <div key={index} className={`relative flex flex-col gap-6 rounded-3xl border p-6 shadow-xl transition-all duration-500 ${binding.enabled ? 'border-white/10 bg-black/20 backdrop-blur-md hover:bg-black/30' : 'border-white/5 bg-black/40 opacity-75 grayscale-[30%]'}`}>
                                    <div className="pointer-events-none absolute right-0 top-0 h-full w-32 rounded-r-3xl bg-gradient-to-l from-white/5 to-transparent" />
                                    <div className="flex items-center gap-5">
                                        <div className={`flex items-center justify-center rounded-2xl border border-white/10 bg-black/40 p-3 shadow-inner ${!binding.enabled ? 'opacity-50' : ''}`}>{getLevelIcon(binding.accessLevel)}</div>
                                        <div className="flex-1">
                                            <InteractiveSelect value={binding.roleId} onChange={(value) => updateBinding(index, { roleId: value })} options={config.roles} placeholder={tr('Выберите роль...', 'Select role...')} />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                                        <InteractiveSelect
                                            label={tr('Пресет', 'Preset')}
                                            value={getBindingPresetOptionId(binding)}
                                            onChange={(value) => handlePresetSelection(index, value)}
                                            options={presetOptions}
                                        />
                                        <div className="pt-2">
                                            <SliderField label={tr('Уровень', 'Level')} value={binding.accessLevel} onChange={(value) => updateBinding(index, { accessLevel: value })} />
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between border-t border-white/10 pt-5">
                                        <div className="origin-left scale-90">
                                            <SmoothToggle label={tr('Активно', 'Enabled')} checked={binding.enabled} onChange={(value) => updateBinding(index, { enabled: value })} />
                                        </div>
                                        <button type="button" onClick={() => removeBinding(index)} className="rounded-xl bg-white/5 p-3 text-white/50 shadow-md shadow-black/20 transition-all hover:bg-rose-500 hover:text-white active:scale-95">
                                            <Trash size={20} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    <button type="button" onClick={addBinding} disabled={config.roleBindings.length >= 15} className="flex w-full items-center justify-center gap-2 rounded-[24px] border border-dashed border-[var(--color-primary-1)] bg-[var(--color-primary-1)]/5 py-4 text-sm font-black text-[var(--color-primary-1)] transition-all shadow-[0_0_15px_rgba(var(--color-primary-1-rgb),0.05)] hover:bg-[var(--color-primary-1)]/15 disabled:pointer-events-none disabled:opacity-30">
                        + {tr('Добавить роль с уровнем', 'Add Role Access Level')}
                    </button>
                </div>
            </AnimatedCard>

            <CommandOverridesPanel
                config={config}
                setConfig={setConfig}
                locale={locale}
                tr={tr}
                fixedModule="moderation"
            />

            <Modal
                isOpen={isPresetModalOpen}
                onClose={closePresetModal}
                placement="center"
                classNames={{
                    base: "bg-[#111111] border border-[var(--border-subtle)] shadow-2xl rounded-[28px] overflow-hidden m-4",
                    backdrop: "bg-[#000]/60 backdrop-blur-sm",
                    header: "border-b border-[var(--border-divider)]",
                    body: "py-5",
                    footer: "border-t border-[var(--border-divider)]",
                }}
            >
                <ModalContent>
                    <ModalHeader className="text-white/90">
                        {presetModalMode === 'create'
                            ? tr('Создать пресет доступа', 'Create access preset')
                            : tr('Редактировать пресет доступа', 'Edit access preset')}
                    </ModalHeader>
                    <ModalBody>
                        <div className="space-y-3">
                            <p className="text-xs text-white/50">
                                {presetModalMode === 'create'
                                    ? tr('Новый пресет появится в списке пресетов для всех ролей на этой странице.', 'The new preset will appear in the preset list for all roles on this page.')
                                    : tr('Изменения применятся ко всем ролям, которые используют этот кастомный пресет.', 'Changes will apply to all roles using this custom preset.')}
                            </p>
                            {presetModalMode === 'edit' ? (
                                customPresetOptions.length > 0 ? (
                                    <InteractiveSelect
                                        label={tr('Кастомный пресет', 'Custom preset')}
                                        value={editingPresetId}
                                        onChange={handleEditPresetSelection}
                                        options={customPresetOptions}
                                        placeholder={tr('Выберите пресет...', 'Select preset...')}
                                    />
                                ) : (
                                    <div className="rounded-xl border border-white/10 bg-[#181818] px-3 py-2 text-xs text-white/55">
                                        {tr('Нет кастомных пресетов для редактирования.', 'No custom presets available to edit.')}
                                    </div>
                                )
                            ) : null}
                            <div className="space-y-2">
                                <span className="text-xs font-semibold uppercase tracking-wide text-white/60">{tr('Название', 'Name')}</span>
                                <input
                                    type="text"
                                    value={newPresetName}
                                    onChange={(event) => {
                                        setNewPresetName(event.target.value);
                                        if (presetModalError) setPresetModalError('');
                                    }}
                                    onKeyDown={(event) => {
                                        if (event.key === 'Enter') {
                                            event.preventDefault();
                                            submitPresetModal();
                                        }
                                    }}
                                    placeholder={tr('Например: Senior Mod', 'For example: Senior Mod')}
                                    className="w-full rounded-xl border border-white/10 bg-[#181818] px-3 py-2.5 text-sm text-white/90 outline-none transition-all hover:border-white/20 focus:border-[var(--color-primary-1)] focus:ring-2 focus:ring-[var(--color-primary-1)]/20 placeholder:text-white/30"
                                    autoFocus
                                />
                            </div>
                            <div className="space-y-2">
                                <SliderField label={tr('Уровень доступа', 'Access level')} value={newPresetLevel} onChange={setNewPresetLevel} />
                            </div>
                            <div className="space-y-2">
                                <span className="text-xs font-semibold uppercase tracking-wide text-white/60">{tr('Цвет пресета', 'Preset color')}</span>
                                <div className="grid grid-cols-8 gap-2">
                                    {PRESET_COLOR_SWATCHES.map((color) => (
                                        <button
                                            key={color}
                                            type="button"
                                            onClick={() => setNewPresetColor(color)}
                                            className={`h-8 rounded-lg border transition-all ${newPresetColor.toUpperCase() === color.toUpperCase() ? 'border-white shadow-[0_0_0_1px_rgba(255,255,255,0.5)]' : 'border-white/10 hover:border-white/30'}`}
                                            style={{ backgroundColor: color }}
                                            aria-label={`${tr('Выбрать цвет', 'Select color')} ${color}`}
                                        />
                                    ))}
                                </div>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="color"
                                        value={normalizeHexColor(newPresetColor) ?? DEFAULT_CUSTOM_PRESET_COLOR}
                                        onChange={(event) => setNewPresetColor(event.target.value.toUpperCase())}
                                        className="h-10 w-12 rounded-lg border border-white/10 bg-[#181818] p-1"
                                    />
                                    <input
                                        type="text"
                                        value={newPresetColor}
                                        onChange={(event) => setNewPresetColor(event.target.value)}
                                        placeholder="#60A5FA"
                                        className="h-10 flex-1 rounded-xl border border-white/10 bg-[#181818] px-3 text-sm font-mono text-white/90 outline-none transition-all hover:border-white/20 focus:border-[var(--color-primary-1)] focus:ring-2 focus:ring-[var(--color-primary-1)]/20"
                                    />
                                </div>
                            </div>
                            {presetModalError ? <p className="text-xs text-rose-400">{presetModalError}</p> : null}
                        </div>
                    </ModalBody>
                    <ModalFooter>
                        {presetModalMode === 'edit' ? (
                            <button
                                type="button"
                                onClick={deleteEditingPreset}
                                className="h-10 rounded-xl border border-rose-500/35 bg-rose-500/12 px-4 text-sm font-bold text-rose-300 transition-all hover:bg-rose-500/20"
                            >
                                {tr('Удалить пресет', 'Delete preset')}
                            </button>
                        ) : null}
                        <button
                            type="button"
                            onClick={closePresetModal}
                            className="h-10 rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-semibold text-white/70 transition-all hover:bg-white/10 hover:text-white"
                        >
                            {tr('Отмена', 'Cancel')}
                        </button>
                        <button
                            type="button"
                            onClick={submitPresetModal}
                            className="h-10 rounded-xl bg-[var(--color-primary-1)] px-4 text-sm font-bold text-black transition-all hover:bg-[var(--color-primary-2)] disabled:opacity-40 disabled:pointer-events-none"
                            disabled={presetModalMode === 'edit' && customPresetOptions.length === 0}
                        >
                            {presetModalMode === 'create' ? tr('Создать', 'Create') : tr('Сохранить', 'Save')}
                        </button>
                    </ModalFooter>
                </ModalContent>
            </Modal>
        </div>
    );
}
