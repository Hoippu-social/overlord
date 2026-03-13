import React from 'react';
import { CommandRule, CommandRuleMode, ConfigState, RoleBinding } from '@/app/dashboard/[guildId]/moderation/types';
import { ACCESS_PRESETS, MODERATION_COMMANDS, createDefaultCommandRules, getDefaultCommandRule, removeAtIndex, updateAtIndex } from '@/app/dashboard/[guildId]/moderation/constants';
import { AnimatedCard, Badge, InteractiveSelect, MultiSelectField, SliderField, SmoothToggle, TagsInputField } from '@/components/moderation/ui';
import { CaretDown, CheckCircle, Prohibit, ShieldCheck, ShieldStar, ShieldWarning, Trash, UserCircleGear } from '@phosphor-icons/react';

interface AccessControlTabProps {
    config: ConfigState;
    setConfig: React.Dispatch<React.SetStateAction<ConfigState>>;
    locale: 'en' | 'ru';
    tr: (ru: string, en: string) => string;
}

function ModeSwitch({
    mode,
    onChange,
    tr,
}: {
    mode: CommandRuleMode;
    onChange: (mode: CommandRuleMode) => void;
    tr: (ru: string, en: string) => string;
}) {
    return (
        <div className="inline-flex items-center rounded-2xl border border-white/10 bg-black/30 p-1 shadow-inner">
            <button
                type="button"
                onClick={() => onChange('WHITELIST')}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-colors ${mode === 'WHITELIST' ? 'bg-emerald-500/15 text-emerald-300 shadow-[0_0_0_1px_rgba(52,211,153,0.45)]' : 'text-white/40 hover:text-white/80'}`}
            >
                {tr('Белый список', 'Whitelist')}
            </button>
            <button
                type="button"
                onClick={() => onChange('BLACKLIST')}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-colors ${mode === 'BLACKLIST' ? 'bg-rose-500/15 text-rose-300 shadow-[0_0_0_1px_rgba(251,113,133,0.45)]' : 'text-white/40 hover:text-white/80'}`}
            >
                {tr('Чёрный список', 'Blacklist')}
            </button>
        </div>
    );
}

export function AccessControlTab({ config, setConfig, locale, tr }: AccessControlTabProps) {
    const [expandedCommandKey, setExpandedCommandKey] = React.useState<string | null>(null);
    const [accessLevelRoleSelection, setAccessLevelRoleSelection] = React.useState<Record<string, string>>({});

    const updateModConfig = (key: keyof ConfigState['moderationConfig'], val: string | string[]) => {
        setConfig((prev) => ({
            ...prev,
            moderationConfig: { ...prev.moderationConfig, [key]: val },
        }));
    };

    const addBinding = () => {
        if (config.roleBindings.length >= 15) return;
        setConfig((prev) => ({
            ...prev,
            roleBindings: [...prev.roleBindings, { roleId: '', title: 'Moderator', accessLevel: 50, enabled: true, sortOrder: prev.roleBindings.length }],
        }));
    };

    const updateBinding = (index: number, val: Partial<RoleBinding>) => {
        setConfig((prev) => ({
            ...prev,
            roleBindings: updateAtIndex(prev.roleBindings, index, { ...prev.roleBindings[index], ...val }),
        }));
    };

    const removeBinding = (index: number) => {
        setConfig((prev) => ({
            ...prev,
            roleBindings: removeAtIndex(prev.roleBindings, index),
        }));
    };

    const effectiveCommandRules = React.useMemo(() => {
        const saved = new Map(config.commandRules.map((rule) => [rule.commandKey, rule]));
        return MODERATION_COMMANDS.map((command) => {
            const defaultRule = getDefaultCommandRule(command.key);
            const existing = saved.get(command.key);
            return existing
                ? {
                    ...defaultRule,
                    ...existing,
                    requiredAccessLevel: typeof existing.requiredAccessLevel === 'number' ? existing.requiredAccessLevel : defaultRule.requiredAccessLevel,
                }
                : defaultRule;
        });
    }, [config.commandRules]);

    const commandRuleMap = React.useMemo(() => new Map(effectiveCommandRules.map((rule) => [rule.commandKey, rule])), [effectiveCommandRules]);
    const allCommandsEnabled = effectiveCommandRules.every((rule) => rule.enabled);

    const roleLevelOptions = React.useMemo(
        () => {
            const enabledBindings = config.roleBindings.filter((binding) => binding.enabled && binding.roleId);
            const markerOptions = enabledBindings.map((binding) => {
                const role = config.roles.find((item) => item.id === binding.roleId);
                return {
                    id: `marker:${binding.roleId}`,
                    name: `${binding.title} -> ${role?.name ?? binding.roleId} (${binding.accessLevel})`,
                    color: role?.color,
                };
            });

            const roleOptions = enabledBindings.map((binding) => {
                const role = config.roles.find((item) => item.id === binding.roleId);
                return {
                    id: `role:${binding.roleId}`,
                    name: `${role?.name ?? binding.roleId} (${binding.accessLevel})`,
                    color: role?.color,
                };
            });

            return markerOptions.length
                ? [...markerOptions, { id: '__role-divider__', name: '──── роли сервера ────', disabled: true, isSeparator: true }, ...roleOptions]
                : [];
        },
        [config.roleBindings, config.roles],
    );

    const setCommandRule = (commandKey: string, patch: Partial<CommandRule>) => {
        setConfig((prev) => {
            const index = prev.commandRules.findIndex((rule) => rule.commandKey === commandKey);
            const current = index >= 0 ? prev.commandRules[index] : getDefaultCommandRule(commandKey);
            const next: CommandRule = {
                ...getDefaultCommandRule(commandKey),
                ...current,
                ...patch,
                commandKey,
                roleIds: Array.from(new Set((patch.roleIds ?? current.roleIds).filter(Boolean))),
                channelIds: Array.from(new Set((patch.channelIds ?? current.channelIds).filter(Boolean))),
                requiredAccessLevel:
                    typeof patch.requiredAccessLevel === 'number'
                        ? patch.requiredAccessLevel
                        : typeof current.requiredAccessLevel === 'number'
                            ? current.requiredAccessLevel
                            : getDefaultCommandRule(commandKey).requiredAccessLevel,
            };

            return {
                ...prev,
                commandRules: index >= 0 ? updateAtIndex(prev.commandRules, index, next) : [...prev.commandRules, next],
                commandGrants: prev.commandGrants.filter((grant) => !(grant.scopeType === 'COMMAND' && grant.scopeKey === commandKey)),
            };
        });
    };

    const clearCommandRule = (commandKey: string) => {
        setConfig((prev) => ({
            ...prev,
            commandRules: prev.commandRules.map((rule) => (rule.commandKey === commandKey ? getDefaultCommandRule(commandKey) : rule)),
            commandGrants: prev.commandGrants.filter((grant) => !(grant.scopeType === 'COMMAND' && grant.scopeKey === commandKey)),
        }));
        setAccessLevelRoleSelection((prev) => ({ ...prev, [commandKey]: '' }));
        setExpandedCommandKey((current) => (current === commandKey ? null : current));
    };

    const toggleCommandRule = (commandKey: string) => {
        const current = commandRuleMap.get(commandKey) ?? getDefaultCommandRule(commandKey);
        const nextEnabled = !current.enabled;
        setCommandRule(commandKey, { enabled: nextEnabled });
        setExpandedCommandKey((currentExpanded) => (nextEnabled ? commandKey : currentExpanded === commandKey ? null : currentExpanded));
    };

    const setAllCommandsEnabled = (enabled: boolean) => {
        setConfig((prev) => ({
            ...prev,
            commandRules: createDefaultCommandRules().map((defaultRule) => {
                const existing = prev.commandRules.find((rule) => rule.commandKey === defaultRule.commandKey);
                return {
                    ...defaultRule,
                    ...existing,
                    enabled,
                    requiredAccessLevel: typeof existing?.requiredAccessLevel === 'number' ? existing.requiredAccessLevel : defaultRule.requiredAccessLevel,
                };
            }),
        }));
        if (!enabled) setExpandedCommandKey(null);
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
                title={tr('Связки ролей', 'Role Bindings')}
                subtitle={tr('Уровни доступа для ролей модерации (от 0 до 100). Максимум 15 связок.', 'Access levels for staff roles (0 to 100). Max 15 bindings.')}
            >
                <div className="mb-8 space-y-6">
                    {config.roleBindings.length === 0 ? (
                        <div className="flex flex-col items-center justify-center rounded-3xl border border-white/5 bg-white/[0.02] py-12 text-white/30">
                            <UserCircleGear size={48} weight="duotone" className="mb-4 opacity-50" />
                            <p className="text-lg font-semibold">{tr('Нет связанных ролей', 'No role bindings')}</p>
                            <p className="mt-1 text-sm">{tr('Настройте доступы для модераторов.', 'Configure access levels for your staff.')}</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                            {config.roleBindings.map((binding, idx) => (
                                <div key={idx} className={`relative flex flex-col gap-6 rounded-3xl border p-6 shadow-xl transition-all duration-500 ${binding.enabled ? 'border-white/10 bg-black/20 backdrop-blur-md hover:bg-black/30' : 'border-white/5 bg-black/40 opacity-75 grayscale-[30%]'}`}>
                                    <div className="pointer-events-none absolute right-0 top-0 h-full w-32 rounded-r-3xl bg-gradient-to-l from-white/5 to-transparent" />
                                    <div className="flex items-center gap-5">
                                        <div className={`flex items-center justify-center rounded-2xl border border-white/10 bg-black/40 p-3 shadow-inner ${!binding.enabled ? 'opacity-50' : ''}`}>{getLevelIcon(binding.accessLevel)}</div>
                                        <div className="flex-1">
                                            <InteractiveSelect value={binding.roleId} onChange={(value) => updateBinding(idx, { roleId: value })} options={config.roles} placeholder={tr('Выберите роль...', 'Select role...')} />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                                        <InteractiveSelect label={tr('Пресет (Группа)', 'Preset (Group)')} value={binding.title} onChange={(value) => updateBinding(idx, { title: value })} options={ACCESS_PRESETS.map((preset) => ({ id: preset, name: preset }))} />
                                        <div className="pt-2">
                                            <SliderField label={tr('Уровень', 'Level')} value={binding.accessLevel} onChange={(value) => updateBinding(idx, { accessLevel: value })} />
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between border-t border-white/10 pt-5">
                                        <div className="origin-left scale-90">
                                            <SmoothToggle label={tr('Активно', 'Enabled')} checked={binding.enabled} onChange={(value) => updateBinding(idx, { enabled: value })} />
                                        </div>
                                        <button type="button" onClick={() => removeBinding(idx)} className="rounded-xl bg-white/5 p-3 text-white/50 shadow-md shadow-black/20 transition-all hover:bg-rose-500 hover:text-white active:scale-95">
                                            <Trash size={20} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    <button type="button" onClick={addBinding} disabled={config.roleBindings.length >= 15} className="flex w-full items-center justify-center gap-2 rounded-[24px] border border-dashed border-[var(--color-primary-1)] bg-[var(--color-primary-1)]/5 py-4 text-sm font-black text-[var(--color-primary-1)] transition-all shadow-[0_0_15px_rgba(var(--color-primary-1-rgb),0.05)] hover:bg-[var(--color-primary-1)]/15 disabled:pointer-events-none disabled:opacity-30">
                        + {tr('Добавить связку роли', 'Add Role Binding')}
                    </button>
                </div>
            </AnimatedCard>

            <AnimatedCard
                title={tr('Переопределение команд', 'Command Overrides')}
                subtitle={tr('Все команды активны по умолчанию. Можно массово включать или выключать их и отдельно настраивать роли, каналы и минимальный уровень доступа.', 'All commands are enabled by default. You can toggle them in bulk and fine-tune roles, channels and minimum access level individually.')}
            >
                <div className="space-y-4">
                    <div className="flex flex-wrap gap-3">
                        <button type="button" onClick={() => setAllCommandsEnabled(true)} disabled={allCommandsEnabled} className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-sm font-bold text-emerald-300 transition-colors hover:bg-emerald-500/15 disabled:opacity-50">
                            {tr('Включить всё', 'Enable all')}
                        </button>
                        <button type="button" onClick={() => setAllCommandsEnabled(false)} disabled={!allCommandsEnabled} className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-2 text-sm font-bold text-rose-300 transition-colors hover:bg-rose-500/15 disabled:opacity-50">
                            {tr('Выключить всё', 'Disable all')}
                        </button>
                    </div>

                    {MODERATION_COMMANDS.map((command) => {
                        const rule = commandRuleMap.get(command.key) ?? getDefaultCommandRule(command.key);
                        const isExpanded = expandedCommandKey === command.key;
                        const hasRoleRestriction = rule.roleIds.length > 0;
                        const hasChannelRestriction = rule.channelIds.length > 0;
                        const localizedDescription = locale === 'ru' ? command.description.ru : command.description.en;

                        return (
                            <div key={command.key} className={`rounded-[26px] border bg-[linear-gradient(90deg,rgba(255,255,255,0.02),rgba(255,255,255,0.01))] px-5 py-4 shadow-inner transition-all duration-300 ${isExpanded ? 'border-white/12 bg-black/30' : 'border-white/8 bg-black/18 hover:border-white/12 hover:bg-black/24'}`}>
                                <div className="flex items-center gap-4">
                                    <div className="flex w-[42px] shrink-0 justify-start pl-1">
                                        <button
                                            type="button"
                                            role="switch"
                                            aria-checked={rule.enabled}
                                            aria-label={rule.enabled ? `Disable ${command.key}` : `Enable ${command.key}`}
                                            onClick={() => toggleCommandRule(command.key)}
                                            className={`relative inline-flex h-6 w-10 shrink-0 items-center rounded-full border transition-all duration-300 ${rule.enabled ? 'border-violet-400/70 bg-violet-500/10 shadow-[0_0_20px_rgba(139,92,246,0.18)]' : 'border-white/10 bg-white/[0.04]'}`}
                                        >
                                            <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-md transition-transform duration-300 ${rule.enabled ? 'translate-x-[18px]' : 'translate-x-[3px]'}`} />
                                        </button>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => setExpandedCommandKey((current) => (current === command.key ? null : command.key))}
                                        className="flex min-w-0 flex-1 items-center text-left"
                                    >
                                        <div className="w-[108px] shrink-0">
                                            <span className="inline-flex h-[42px] w-[92px] items-center justify-center rounded-lg border border-white/10 bg-black/35 px-3 py-1.5 text-[15px] font-black lowercase tracking-wide text-white/95 shadow-inner">
                                                {command.key}
                                            </span>
                                        </div>
                                        <div className="min-w-0 flex-1 pl-4 pr-4">
                                            <div className="truncate text-base text-white/72">{localizedDescription}</div>
                                            <div className="mt-1 flex flex-wrap gap-2">
                                                {hasRoleRestriction ? <Badge variant={rule.roleMode === 'WHITELIST' ? 'success' : 'danger'}>{tr('Роли', 'Roles')}: {rule.roleIds.length}</Badge> : null}
                                                {hasChannelRestriction ? <Badge variant={rule.channelMode === 'WHITELIST' ? 'success' : 'danger'}>{tr('Каналы', 'Channels')}: {rule.channelIds.length}</Badge> : null}
                                                <Badge variant="warning">{tr('Уровень', 'Level')}: {rule.requiredAccessLevel}</Badge>
                                                {!hasRoleRestriction && !hasChannelRestriction ? <span className="text-xs font-semibold text-white/35">{tr('Роли и каналы не ограничены', 'Roles and channels are not restricted')}</span> : null}
                                            </div>
                                        </div>
                                        <CaretDown size={20} className={`shrink-0 text-white/45 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                                    </button>
                                </div>

                                {isExpanded ? (
                                    <div className="mt-5 border-t border-white/6 pt-5">
                                        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                                            <div className="rounded-[24px] border border-white/8 bg-black/20 p-5 shadow-inner">
                                                <div className="flex items-start gap-4">
                                                    <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border ${rule.roleMode === 'BLACKLIST' ? 'border-rose-500/20 bg-rose-500/10 text-rose-300' : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'}`}>
                                                        {rule.roleMode === 'BLACKLIST' ? <Prohibit size={20} weight="duotone" /> : <CheckCircle size={20} weight="duotone" />}
                                                    </div>
                                                    <div>
                                                        <h4 className="text-sm font-bold text-white/90">{tr('Роли для команды', 'Roles for command')}</h4>
                                                        <p className="mt-1 text-xs text-white/45">
                                                            {rule.roleIds.length ? (rule.roleMode === 'WHITELIST' ? tr('Команда доступна только выбранным ролям.', 'Only selected roles can use this command.') : tr('Выбранным ролям команда запрещена.', 'Selected roles are blocked from using this command.')) : tr('Ограничений по ролям нет.', 'No role restrictions are active.')}
                                                        </p>
                                                        <div className="mt-3">
                                                            <ModeSwitch mode={rule.roleMode} onChange={(mode) => setCommandRule(command.key, { roleMode: mode })} tr={tr} />
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="mt-5">
                                                    <MultiSelectField label={tr('Выберите роли', 'Choose roles')} options={config.roles} selected={rule.roleIds} onChange={(roleIds) => setCommandRule(command.key, { roleIds })} placeholder={tr('Начните вводить роль...', 'Start typing a role...')} />
                                                </div>
                                            </div>

                                            <div className="rounded-[24px] border border-white/8 bg-black/20 p-5 shadow-inner">
                                                <div className="flex items-start gap-4">
                                                    <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border ${rule.channelMode === 'BLACKLIST' ? 'border-rose-500/20 bg-rose-500/10 text-rose-300' : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'}`}>
                                                        {rule.channelMode === 'BLACKLIST' ? <Prohibit size={20} weight="duotone" /> : <CheckCircle size={20} weight="duotone" />}
                                                    </div>
                                                    <div>
                                                        <h4 className="text-sm font-bold text-white/90">{tr('Каналы для команды', 'Channels for command')}</h4>
                                                        <p className="mt-1 text-xs text-white/45">
                                                            {rule.channelIds.length ? (rule.channelMode === 'WHITELIST' ? tr('Команда доступна только в выбранных каналах и категориях.', 'Only selected channels and categories can use this command.') : tr('В выбранных каналах и категориях команда запрещена.', 'Selected channels and categories are blocked from using this command.')) : tr('Ограничений по каналам нет.', 'No channel restrictions are active.')}
                                                        </p>
                                                        <div className="mt-3">
                                                            <ModeSwitch mode={rule.channelMode} onChange={(mode) => setCommandRule(command.key, { channelMode: mode })} tr={tr} />
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="mt-5">
                                                    <MultiSelectField label={tr('Выберите каналы', 'Choose channels')} options={config.channels} selected={rule.channelIds} onChange={(channelIds) => setCommandRule(command.key, { channelIds })} placeholder={tr('Начните вводить канал...', 'Start typing a channel...')} />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="mt-5 rounded-[24px] border border-white/8 bg-black/20 p-5 shadow-inner">
                                            <div className="flex flex-wrap items-start justify-between gap-4">
                                                <div>
                                                    <h4 className="text-sm font-bold text-white/90">{tr('Уровень доступа', 'Access level')}</h4>
                                                    <p className="mt-1 text-xs text-white/45">{tr('У каждой команды есть базовый минимальный уровень. Можно подставить уровень по роли или точно докрутить ползунком.', 'Each command has a baseline minimum level. You can apply a bound role level automatically or fine-tune it with the slider.')}</p>
                                                </div>
                                            </div>
                                            <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[320px_minmax(0,1fr)] xl:items-end">
                                                <InteractiveSelect
                                                    label={tr('Выставить по роли', 'Set from role')}
                                                    value={accessLevelRoleSelection[command.key] ?? ''}
                                                    onChange={(roleId) => {
                                                        if (roleId === '__role-divider__') {
                                                            return;
                                                        }

                                                        const normalizedRoleId = roleId.startsWith('marker:') ? roleId.slice(7) : roleId.startsWith('role:') ? roleId.slice(5) : roleId;
                                                        setAccessLevelRoleSelection((prev) => ({ ...prev, [command.key]: roleId }));
                                                        const binding = config.roleBindings.find((item) => item.enabled && item.roleId === normalizedRoleId);
                                                        if (binding) {
                                                            setCommandRule(command.key, { requiredAccessLevel: binding.accessLevel });
                                                        }
                                                    }}
                                                    options={roleLevelOptions}
                                                    placeholder={tr('Выберите роль...', 'Choose role...')}
                                                />
                                                <div className="xl:pb-2">
                                                    <SliderField
                                                        label={tr('Минимальный уровень', 'Minimum level')}
                                                        value={Number(rule.requiredAccessLevel ?? getDefaultCommandRule(command.key).requiredAccessLevel ?? 50)}
                                                        onChange={(value) => {
                                                            setAccessLevelRoleSelection((prev) => ({ ...prev, [command.key]: '' }));
                                                            setCommandRule(command.key, { requiredAccessLevel: value });
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        <button type="button" onClick={() => clearCommandRule(command.key)} className="mt-5 w-full rounded-[18px] border border-white/10 bg-white/[0.03] py-3.5 text-sm font-bold text-white/72 transition-colors hover:bg-white/[0.08] hover:text-white">
                                            {tr('Сбросить ограничения', 'Clear restrictions')}
                                        </button>
                                    </div>
                                ) : null}
                            </div>
                        );
                    })}
                </div>
            </AnimatedCard>
        </div>
    );
}
