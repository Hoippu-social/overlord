import React from 'react';
import { ConfigState, RoleBinding } from '@/app/dashboard/[guildId]/moderation/types';
import { ACCESS_PRESETS, removeAtIndex, updateAtIndex } from '@/app/dashboard/[guildId]/moderation/constants';
import { AnimatedCard, InteractiveSelect, MultiSelectField, SliderField, SmoothToggle, TagsInputField } from '@/components/moderation/ui';
import { CommandOverridesPanel } from '@/components/commands/CommandOverridesPanel';
import { ShieldCheck, ShieldStar, ShieldWarning, Trash, UserCircleGear } from '@phosphor-icons/react';

interface AccessControlTabProps {
    config: ConfigState;
    setConfig: React.Dispatch<React.SetStateAction<ConfigState>>;
    locale: 'en' | 'ru';
    tr: (ru: string, en: string) => string;
}

export function AccessControlTab({ config, setConfig, locale, tr }: AccessControlTabProps) {
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
            roleBindings: [...prev.roleBindings, { roleId: '', title: 'Moderator', accessLevel: 50, enabled: true, sortOrder: prev.roleBindings.length }],
        }));
    };

    const updateBinding = (index: number, value: Partial<RoleBinding>) => {
        setConfig((prev) => ({
            ...prev,
            roleBindings: updateAtIndex(prev.roleBindings, index, { ...prev.roleBindings[index], ...value }),
        }));
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
                                        <InteractiveSelect label={tr('Пресет (Группа)', 'Preset (Group)')} value={binding.title} onChange={(value) => updateBinding(index, { title: value })} options={ACCESS_PRESETS.map((preset) => ({ id: preset, name: preset }))} />
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
                        + {tr('Добавить связку роли', 'Add Role Binding')}
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
        </div>
    );
}
