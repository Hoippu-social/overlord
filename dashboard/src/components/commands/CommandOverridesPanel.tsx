'use client';

import React from 'react';
import { CommandRule, CommandRuleMode, ConfigState } from '@/app/dashboard/[guildId]/moderation/types';
import { updateAtIndex } from '@/app/dashboard/[guildId]/moderation/constants';
import { AnimatedCard, Badge, InteractiveSelect, MultiSelectField, SliderField } from '@/components/moderation/ui';
import {
    COMMAND_CATALOG,
    COMMAND_MODULES,
    CommandModuleKey,
    createDefaultCommandRules,
    getDefaultCommandRule,
} from '@/lib/commandCatalog';
import { CaretDown, CheckCircle, Prohibit } from '@phosphor-icons/react';

type CommandOverridesPanelProps = {
    config: ConfigState;
    setConfig: React.Dispatch<React.SetStateAction<ConfigState>>;
    locale: 'en' | 'ru';
    tr: (ru: string, en: string) => string;
    fixedModule?: CommandModuleKey;
    showModuleFilter?: boolean;
    title?: string;
    subtitle?: string;
};

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

export function CommandOverridesPanel({
    config,
    setConfig,
    locale,
    tr,
    fixedModule,
    showModuleFilter = false,
    title,
    subtitle,
}: CommandOverridesPanelProps) {
    const [expandedCommandKey, setExpandedCommandKey] = React.useState<string | null>(null);
    const [accessLevelRoleSelection, setAccessLevelRoleSelection] = React.useState<Record<string, string>>({});
    const [activeModule, setActiveModule] = React.useState<'all' | CommandModuleKey>(fixedModule ?? 'all');

    React.useEffect(() => {
        if (fixedModule) {
            setActiveModule(fixedModule);
        }
    }, [fixedModule]);

    const effectiveCommandRules = React.useMemo(() => {
        const saved = new Map(config.commandRules.map((rule) => [rule.commandKey, rule]));
        return COMMAND_CATALOG.map((command) => {
            const defaultRule = getDefaultCommandRule(command.commandKey);
            const existing = saved.get(command.commandKey);
            return existing
                ? {
                    ...defaultRule,
                    ...existing,
                    requiredAccessLevel:
                        typeof existing.requiredAccessLevel === 'number'
                            ? existing.requiredAccessLevel
                            : defaultRule.requiredAccessLevel,
                }
                : defaultRule;
        });
    }, [config.commandRules]);

    const commandRuleMap = React.useMemo(
        () => new Map(effectiveCommandRules.map((rule) => [rule.commandKey, rule])),
        [effectiveCommandRules],
    );

    const visibleCommands = React.useMemo(
        () => COMMAND_CATALOG.filter((command) => (fixedModule ? command.moduleKey === fixedModule : activeModule === 'all' ? true : command.moduleKey === activeModule)),
        [activeModule, fixedModule],
    );

    const allVisibleCommandsEnabled = React.useMemo(
        () => visibleCommands.every((command) => (commandRuleMap.get(command.commandKey) ?? getDefaultCommandRule(command.commandKey)).enabled),
        [commandRuleMap, visibleCommands],
    );

    const roleLevelOptions = React.useMemo(() => {
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
    }, [config.roleBindings, config.roles]);

    const setCommandRule = (commandKey: string, patch: Partial<CommandRule>) => {
        setConfig((prev) => {
            const index = prev.commandRules.findIndex((rule) => rule.commandKey === commandKey);
            const current = index >= 0 ? prev.commandRules[index] : getDefaultCommandRule(commandKey);
            const nextRequiredAccessLevel =
                Object.prototype.hasOwnProperty.call(patch, 'requiredAccessLevel')
                    ? patch.requiredAccessLevel ?? null
                    : typeof current.requiredAccessLevel === 'number'
                        ? current.requiredAccessLevel
                        : getDefaultCommandRule(commandKey).requiredAccessLevel;
            const next: CommandRule = {
                ...getDefaultCommandRule(commandKey),
                ...current,
                ...patch,
                commandKey,
                roleIds: Array.from(new Set((patch.roleIds ?? current.roleIds).filter(Boolean))),
                channelIds: Array.from(new Set((patch.channelIds ?? current.channelIds).filter(Boolean))),
                requiredAccessLevel: nextRequiredAccessLevel,
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

    const setAllVisibleCommandsEnabled = (enabled: boolean) => {
        setConfig((prev) => {
            const defaultMap = new Map(createDefaultCommandRules().map((rule) => [rule.commandKey, rule]));
            const nextRules = prev.commandRules.map((rule) => ({ ...rule }));

            for (const command of visibleCommands) {
                const index = nextRules.findIndex((rule) => rule.commandKey === command.commandKey);
                const defaultRule = defaultMap.get(command.commandKey) ?? getDefaultCommandRule(command.commandKey);
                const existing = index >= 0 ? nextRules[index] : null;
                const merged = {
                    ...defaultRule,
                    ...existing,
                    enabled,
                    requiredAccessLevel:
                        typeof existing?.requiredAccessLevel === 'number'
                            ? existing.requiredAccessLevel
                            : defaultRule.requiredAccessLevel,
                };

                if (index >= 0) {
                    nextRules[index] = merged;
                } else {
                    nextRules.push(merged);
                }
            }

            return {
                ...prev,
                commandRules: nextRules,
            };
        });

        if (!enabled) {
            setExpandedCommandKey(null);
        }
    };

    const moduleLabel = (moduleKey: CommandModuleKey) => {
        const module = COMMAND_MODULES.find((item) => item.key === moduleKey);
        return locale === 'ru' ? module?.label.ru ?? moduleKey : module?.label.en ?? moduleKey;
    };

    return (
        <AnimatedCard
            title={title ?? tr('Переопределение команд', 'Command Overrides')}
            subtitle={subtitle ?? tr('Все команды активны по умолчанию. Можно массово включать или выключать их и отдельно настраивать роли, каналы и минимальный уровень доступа.', 'All commands are enabled by default. You can toggle them in bulk and fine-tune roles, channels and minimum access level individually.')}
        >
            <div className="space-y-4">
                {showModuleFilter && !fixedModule ? (
                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={() => setActiveModule('all')}
                            className={`rounded-2xl border px-4 py-2 text-sm font-bold transition-colors ${activeModule === 'all' ? 'border-[var(--color-primary-1)] bg-[var(--color-primary-1)]/15 text-[var(--color-primary-1)]' : 'border-white/10 bg-white/[0.03] text-white/60 hover:text-white/90'}`}
                        >
                            {tr('Все', 'All')}
                        </button>
                        {COMMAND_MODULES.map((module) => (
                            <button
                                key={module.key}
                                type="button"
                                onClick={() => setActiveModule(module.key)}
                                className={`rounded-2xl border px-4 py-2 text-sm font-bold transition-colors ${activeModule === module.key ? 'border-[var(--color-primary-1)] bg-[var(--color-primary-1)]/15 text-[var(--color-primary-1)]' : 'border-white/10 bg-white/[0.03] text-white/60 hover:text-white/90'}`}
                            >
                                {locale === 'ru' ? module.label.ru : module.label.en}
                            </button>
                        ))}
                    </div>
                ) : null}

                <div className="flex flex-wrap gap-3">
                    <button type="button" onClick={() => setAllVisibleCommandsEnabled(true)} disabled={allVisibleCommandsEnabled} className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-sm font-bold text-emerald-300 transition-colors hover:bg-emerald-500/15 disabled:opacity-50">
                        {tr('Включить всё', 'Enable all')}
                    </button>
                    <button type="button" onClick={() => setAllVisibleCommandsEnabled(false)} disabled={!allVisibleCommandsEnabled} className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-2 text-sm font-bold text-rose-300 transition-colors hover:bg-rose-500/15 disabled:opacity-50">
                        {tr('Выключить всё', 'Disable all')}
                    </button>
                </div>

                {visibleCommands.map((command) => {
                    const rule = commandRuleMap.get(command.commandKey) ?? getDefaultCommandRule(command.commandKey);
                    const isExpanded = expandedCommandKey === command.commandKey;
                    const localizedLabel = locale === 'ru' ? command.label.ru : command.label.en;
                    const localizedDescription = locale === 'ru' ? command.description.ru : command.description.en;
                    const sliderValue = typeof rule.requiredAccessLevel === 'number' ? rule.requiredAccessLevel : 0;

                    return (
                        <div key={command.commandKey} className={`rounded-[26px] border bg-[linear-gradient(90deg,rgba(255,255,255,0.02),rgba(255,255,255,0.01))] px-5 py-4 shadow-inner transition-all duration-300 ${isExpanded ? 'border-white/12 bg-black/30' : 'border-white/8 bg-black/18 hover:border-white/12 hover:bg-black/24'}`}>
                            <div className="flex items-center gap-4">
                                <div className="flex w-[42px] shrink-0 justify-start pl-1">
                                    <button
                                        type="button"
                                        role="switch"
                                        aria-checked={rule.enabled}
                                        aria-label={rule.enabled ? `Disable ${command.commandKey}` : `Enable ${command.commandKey}`}
                                        onClick={() => toggleCommandRule(command.commandKey)}
                                        className={`relative inline-flex h-6 w-10 shrink-0 items-center rounded-full border transition-all duration-300 ${rule.enabled ? 'border-violet-400/70 bg-violet-500/10 shadow-[0_0_20px_rgba(139,92,246,0.18)]' : 'border-white/10 bg-white/[0.04]'}`}
                                    >
                                        <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-md transition-transform duration-300 ${rule.enabled ? 'translate-x-[18px]' : 'translate-x-[3px]'}`} />
                                    </button>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => setExpandedCommandKey((current) => (current === command.commandKey ? null : command.commandKey))}
                                    className="flex min-w-0 flex-1 items-center text-left"
                                >
                                    <div className="w-[128px] shrink-0">
                                        <span className="inline-flex h-[42px] min-w-[92px] items-center justify-center rounded-lg border border-white/10 bg-black/35 px-3 py-1.5 text-[15px] font-black tracking-wide text-white/95 shadow-inner">
                                            {command.commandKey}
                                        </span>
                                    </div>
                                    <div className="min-w-0 flex-1 pl-4 pr-4">
                                        <div className="truncate text-base font-semibold text-white/88">{localizedLabel}</div>
                                        <div className="truncate text-sm text-white/55">{localizedDescription}</div>
                                        <div className="mt-1 flex flex-wrap gap-2">
                                            {showModuleFilter ? <Badge>{moduleLabel(command.moduleKey)}</Badge> : null}
                                            {command.hidden ? <Badge variant="warning">{tr('Скрытая', 'Hidden')}</Badge> : null}
                                            {command.kind === 'context' ? <Badge>{tr('Контекст', 'Context')}</Badge> : null}
                                            {rule.roleIds.length > 0 ? <Badge variant={rule.roleMode === 'WHITELIST' ? 'success' : 'danger'}>{tr('Роли', 'Roles')}: {rule.roleIds.length}</Badge> : null}
                                            {rule.channelIds.length > 0 ? <Badge variant={rule.channelMode === 'WHITELIST' ? 'success' : 'danger'}>{tr('Каналы', 'Channels')}: {rule.channelIds.length}</Badge> : null}
                                            <Badge variant="warning">{tr('Уровень', 'Level')}: {sliderValue}</Badge>
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
                                                    <p className="mt-1 text-xs text-white/45">{rule.roleIds.length ? (rule.roleMode === 'WHITELIST' ? tr('Команда доступна только выбранным ролям.', 'Only selected roles can use this command.') : tr('Выбранным ролям команда запрещена.', 'Selected roles are blocked from using this command.')) : tr('Ограничений по ролям нет.', 'No role restrictions are active.')}</p>
                                                    <div className="mt-3">
                                                        <ModeSwitch mode={rule.roleMode} onChange={(mode) => setCommandRule(command.commandKey, { roleMode: mode })} tr={tr} />
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="mt-5">
                                                <MultiSelectField label={tr('Выберите роли', 'Choose roles')} options={config.roles} selected={rule.roleIds} onChange={(roleIds) => setCommandRule(command.commandKey, { roleIds })} placeholder={tr('Начните вводить роль...', 'Start typing a role...')} />
                                            </div>
                                        </div>

                                        <div className="rounded-[24px] border border-white/8 bg-black/20 p-5 shadow-inner">
                                            <div className="flex items-start gap-4">
                                                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border ${rule.channelMode === 'BLACKLIST' ? 'border-rose-500/20 bg-rose-500/10 text-rose-300' : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'}`}>
                                                    {rule.channelMode === 'BLACKLIST' ? <Prohibit size={20} weight="duotone" /> : <CheckCircle size={20} weight="duotone" />}
                                                </div>
                                                <div>
                                                    <h4 className="text-sm font-bold text-white/90">{tr('Каналы для команды', 'Channels for command')}</h4>
                                                    <p className="mt-1 text-xs text-white/45">{rule.channelIds.length ? (rule.channelMode === 'WHITELIST' ? tr('Команда доступна только в выбранных каналах и категориях.', 'Only selected channels and categories can use this command.') : tr('В выбранных каналах и категориях команда запрещена.', 'Selected channels and categories are blocked from using this command.')) : tr('Ограничений по каналам нет.', 'No channel restrictions are active.')}</p>
                                                    <div className="mt-3">
                                                        <ModeSwitch mode={rule.channelMode} onChange={(mode) => setCommandRule(command.commandKey, { channelMode: mode })} tr={tr} />
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="mt-5">
                                                <MultiSelectField label={tr('Выберите каналы', 'Choose channels')} options={config.channels} selected={rule.channelIds} onChange={(channelIds) => setCommandRule(command.commandKey, { channelIds })} placeholder={tr('Начните вводить канал...', 'Start typing a channel...')} />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-5 rounded-[24px] border border-white/8 bg-black/20 p-5 shadow-inner">
                                        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[320px_minmax(0,1fr)] xl:items-end">
                                            <InteractiveSelect
                                                label={tr('Выставить по роли', 'Set from role')}
                                                value={accessLevelRoleSelection[command.commandKey] ?? ''}
                                                onChange={(roleId) => {
                                                    if (roleId === '__role-divider__') {
                                                        return;
                                                    }

                                                    const normalizedRoleId = roleId.startsWith('marker:') ? roleId.slice(7) : roleId.startsWith('role:') ? roleId.slice(5) : roleId;
                                                    setAccessLevelRoleSelection((prev) => ({ ...prev, [command.commandKey]: roleId }));
                                                    const binding = config.roleBindings.find((item) => item.enabled && item.roleId === normalizedRoleId);
                                                    if (binding) {
                                                        setCommandRule(command.commandKey, { requiredAccessLevel: binding.accessLevel });
                                                    }
                                                }}
                                                options={roleLevelOptions}
                                                placeholder={tr('Выберите роль...', 'Choose role...')}
                                            />
                                            <div className="xl:pb-2">
                                                <SliderField
                                                    label={tr('Минимальный уровень', 'Minimum level')}
                                                    value={sliderValue}
                                                    onChange={(value) => {
                                                        setAccessLevelRoleSelection((prev) => ({ ...prev, [command.commandKey]: '' }));
                                                        setCommandRule(command.commandKey, { requiredAccessLevel: value });
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <button type="button" onClick={() => clearCommandRule(command.commandKey)} className="mt-5 w-full rounded-[18px] border border-white/10 bg-white/[0.03] py-3.5 text-sm font-bold text-white/72 transition-colors hover:bg-white/[0.08] hover:text-white">
                                        {tr('Сбросить ограничения', 'Clear restrictions')}
                                    </button>
                                </div>
                            ) : null}
                        </div>
                    );
                })}
            </div>
        </AnimatedCard>
    );
}
