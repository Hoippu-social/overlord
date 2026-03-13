import React from 'react';
import { ConfigState, AutomodRule, CustomRule, SanctionStep } from '@/app/dashboard/[guildId]/moderation/types';
import { AnimatedCard, MultiSelectField, SmoothToggle, InteractiveSelect, TextField, TextAreaField, Badge } from '@/components/moderation/ui';
import { Trash, Gear, MagicWand, Plus, Robot, ShieldCheck, WarningOctagon } from '@phosphor-icons/react';
import { updateAtIndex, removeAtIndex, BUILTIN_RULE_LABELS, BUILTIN_RULE_LABELS_RU, CUSTOM_RULE_TYPES, CUSTOM_RULE_ACTIONS, CUSTOM_RULE_TEMPLATES, SANCTION_ACTIONS } from '@/app/dashboard/[guildId]/moderation/constants';

interface AutoModTabProps {
    config: ConfigState;
    setConfig: React.Dispatch<React.SetStateAction<ConfigState>>;
    locale: 'en' | 'ru';
    tr: (ru: string, en: string) => string;
}

export function AutoModTab({ config, setConfig, locale, tr }: AutoModTabProps) {
    const builtinLabels = locale === 'ru' ? BUILTIN_RULE_LABELS_RU : BUILTIN_RULE_LABELS;

    const [expandedBuiltin, setExpandedBuiltin] = React.useState<string | null>(null);

    // Ensure all 10 built-in rules exist in state, if not, stub them out so UI always shows them
    const builtinRuleKeys = Object.keys(BUILTIN_RULE_LABELS);
    const rulesMap = new Map(config.automodRules.map(r => [r.ruleKey, r]));
    const displayBuiltins: AutomodRule[] = builtinRuleKeys.map(key => 
        rulesMap.get(key) || { ruleKey: key, enabled: false, configText: '' }
    );

    const toggleBuiltin = (ruleKey: string, enabled: boolean) => {
        setConfig(prev => {
            const exists = prev.automodRules.find(r => r.ruleKey === ruleKey);
            if (exists) {
                return {
                    ...prev,
                    automodRules: prev.automodRules.map(r => r.ruleKey === ruleKey ? { ...r, enabled } : r)
                };
            }
            return {
                ...prev,
                automodRules: [...prev.automodRules, { ruleKey, enabled, configText: '' }]
            };
        });
    };

    const updateBuiltinConfig = (ruleKey: string, configText: string) => {
        setConfig(prev => {
            const exists = prev.automodRules.find(r => r.ruleKey === ruleKey);
            if (exists) {
                return {
                    ...prev,
                    automodRules: prev.automodRules.map(r => r.ruleKey === ruleKey ? { ...r, configText } : r)
                };
            }
            return {
                ...prev,
                automodRules: [...prev.automodRules, { ruleKey, enabled: false, configText }]
            };
        });
    };

    // Custom Rules Handlers
    const addCustomRule = () => {
        if (config.customRules.length >= 10) return;
        setConfig(prev => ({
            ...prev,
            customRules: [...prev.customRules, { 
                name: 'New Custom Rule', ruleType: 'regex', pattern: '', enabled: true, action: 'DELETE', strikeWeight: 1, notes: '' 
            }]
        }));
    };

    const applyTemplate = (tpl: CustomRule) => {
        if (config.customRules.length >= 10) return;
        setConfig(prev => ({
            ...prev,
            customRules: [...prev.customRules, { ...tpl }]
        }));
    };

    const updateCustomRule = (index: number, val: Partial<CustomRule>) => {
        setConfig(prev => ({
            ...prev,
            customRules: updateAtIndex(prev.customRules, index, { ...prev.customRules[index], ...val })
        }));
    };

    const removeCustomRule = (index: number) => {
        setConfig(prev => ({
            ...prev,
            customRules: removeAtIndex(prev.customRules, index)
        }));
    };

    // Sanction Steps Handlers
    const addSanctionStep = () => {
        setConfig(prev => ({
            ...prev,
            sanctionSteps: [...prev.sanctionSteps, { triggerStrikeCount: prev.sanctionSteps.length + 1, actionType: 'TIMEOUT', durationMinutes: 60, enabled: true, sortOrder: prev.sanctionSteps.length }]
        }));
    };

    const updateSanctionStep = (index: number, val: Partial<SanctionStep>) => {
        setConfig(prev => ({
            ...prev,
            sanctionSteps: updateAtIndex(prev.sanctionSteps, index, { ...prev.sanctionSteps[index], ...val })
        }));
    };

    const removeSanctionStep = (index: number) => {
        setConfig(prev => ({
            ...prev,
            sanctionSteps: removeAtIndex(prev.sanctionSteps, index)
        }));
    };

    return (
        <div className="space-y-8 animate-fade-in">
            
            {/* Scope */}
            <AnimatedCard title={tr('Область Автомода', 'AutoMod Scope')} subtitle={tr('Каналы, на которые распространяются жесткие правила.', 'Channels where strict enforcement rules apply.')}>
                <div className="grid grid-cols-1 gap-6 p-4 bg-black/20 rounded-[20px] border border-white/5">
                    <MultiSelectField
                        label={tr('Только для команд (Command Only Channels)', 'Command Only Channels')}
                        options={config.channels}
                        selected={config.moderationConfig.commandOnlyChannels}
                        onChange={(keys) => {
                            setConfig(prev => ({
                                ...prev, moderationConfig: { ...prev.moderationConfig, commandOnlyChannels: keys }
                            }));
                        }}
                    />
                </div>
            </AnimatedCard>

            {/* Built-in Filters */}
            <AnimatedCard title={tr('Встроенные фильтры', 'Built-in Filters')} subtitle={tr('Настройка базовых правил модерации', 'Configure basic moderation rules')}>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 auto-rows-max">
                    {displayBuiltins.map(rule => (
                        <div key={rule.ruleKey} className={`relative flex flex-col rounded-2xl transition-all duration-300 overflow-hidden ${rule.enabled ? 'border-2 border-[var(--color-primary-1)]/40 bg-gradient-to-br from-[var(--color-primary-1)]/10 to-transparent shadow-[0_4px_20px_rgba(var(--color-primary-1-rgb),0.1)]' : 'border border-white/10 bg-white/[0.02] hover:bg-white/[0.05]'}`}>
                            <div className="flex items-center justify-between p-5 cursor-pointer select-none" onClick={() => toggleBuiltin(rule.ruleKey, !rule.enabled)}>
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-xl transition-colors ${rule.enabled ? 'bg-[var(--color-primary-1)]/20 text-[var(--color-primary-1)]' : 'bg-white/5 text-white/40'}`}>
                                        <Robot size={24} weight="duotone" />
                                    </div>
                                    <span className={`text-base font-bold tracking-wide transition-colors ${rule.enabled ? 'text-white' : 'text-white/50'}`}>
                                        {builtinLabels[rule.ruleKey] || rule.ruleKey}
                                    </span>
                                </div>
                                <div className="flex items-center gap-4">
                                    <button 
                                        type="button" 
                                        onClick={(e) => { e.stopPropagation(); setExpandedBuiltin(expandedBuiltin === rule.ruleKey ? null : rule.ruleKey); }}
                                        className={`p-2 rounded-xl transition-all ${expandedBuiltin === rule.ruleKey ? 'bg-[var(--color-primary-1)] text-white shadow-lg scale-110' : 'hover:bg-white/10 text-white/40 hover:text-white'}`}
                                    >
                                        <Gear size={20} weight={expandedBuiltin === rule.ruleKey ? 'fill' : 'regular'} />
                                    </button>
                                    <div className="pointer-events-none origin-right scale-90">
                                        <SmoothToggle label="" checked={rule.enabled} onChange={() => {}} />
                                    </div>
                                </div>
                            </div>
                            
                            {/* Expandable JSON Config Area */}
                            <div className={`transition-all duration-500 ease-in-out origin-top ${expandedBuiltin === rule.ruleKey ? 'max-h-64 opacity-100 scale-y-100' : 'max-h-0 opacity-0 scale-y-0'}`}>
                                <div className="border-t border-white/10 bg-black/40 p-5 rounded-b-2xl">
                                    <TextAreaField 
                                        label={tr('JSON Конфигурация (Опционально)', 'JSON Configuration (Optional)')}
                                        value={rule.configText}
                                        onChange={(v) => updateBuiltinConfig(rule.ruleKey, v)}
                                        placeholder='{"maxMentions": 5}'
                                        rows={3}
                                    />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </AnimatedCard>

            {/* Custom Rules */}
            <AnimatedCard title={tr('Пользовательские фильтры', 'Custom Filters')} subtitle={tr('До 10 Regex или Keyword правил для специфичного отлова.', 'Up to 10 custom Regex or Keyword lists.')}>
                {config.customRules.length === 0 ? (
                    <div className="py-12 flex flex-col items-center justify-center text-white/30 border border-white/5 bg-white/[0.02] rounded-3xl mb-6">
                        <MagicWand size={48} weight="duotone" className="mb-4 opacity-50 text-[var(--color-primary-1)]" />
                        <p className="text-lg font-semibold">{tr('Нет кастомных правил', 'No custom rules')}</p>
                        <p className="text-sm mt-1">{tr('Вы можете добавить до 10 своих правил.', 'You can add up to 10 custom rules.')}</p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-6 mb-8">
                        {config.customRules.map((rule, idx) => (
                            <div key={idx} className={`relative flex flex-col gap-5 rounded-3xl border p-6 transition-all duration-500 ${
                                rule.enabled ? 'border-white/10 bg-black/20 backdrop-blur-md shadow-lg shadow-black/20' : 'border-white/5 bg-black/40 opacity-70 grayscale-[50%]'
                            }`}>
                                <div className="absolute top-0 right-0 w-64 h-full bg-gradient-to-l from-[var(--color-primary-1)]/5 to-transparent pointer-events-none rounded-r-3xl" />
                                
                                <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-2 relative z-10">
                                    <input 
                                        type="text" 
                                        value={rule.name} 
                                        onChange={(e) => updateCustomRule(idx, { name: e.target.value })} 
                                        className="bg-transparent text-xl font-black text-white outline-none w-1/2 focus:border-b focus:border-[var(--color-primary-1)] transition-colors placeholder:text-white/20" 
                                        placeholder={tr('Имя правила', 'Rule Name')}
                                    />
                                    <div className="flex items-center gap-5">
                                        <Badge variant={rule.action === 'DELETE' ? 'danger' : 'warning'} className="text-[10px] uppercase px-3 py-1 shadow-md">
                                            {rule.action}
                                        </Badge>
                                        <div className="scale-90">
                                            <SmoothToggle label="" checked={rule.enabled} onChange={(v) => updateCustomRule(idx, { enabled: v })} />
                                        </div>
                                        <button type="button" onClick={() => removeCustomRule(idx)} className="p-2 rounded-xl text-white/40 hover:text-white hover:bg-rose-500 transition-all shadow-md active:scale-95">
                                            <Trash size={20} />
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-4 gap-5 relative z-10">
                                    <InteractiveSelect label={tr('Тип правила', 'Rule Type')} value={rule.ruleType} onChange={(v) => updateCustomRule(idx, { ruleType: v })} options={CUSTOM_RULE_TYPES.map(t => ({ id: t, name: t }))} />
                                    <InteractiveSelect label={tr('Действие', 'Action')} value={rule.action} onChange={(v) => updateCustomRule(idx, { action: v })} options={CUSTOM_RULE_ACTIONS.map(a => ({ id: a, name: a }))} />
                                    <TextField label={tr('Вес (Страйки)', 'Strike Weight')} type="number" value={String(rule.strikeWeight)} onChange={(v) => updateCustomRule(idx, { strikeWeight: parseInt(v) || 0 })} />
                                    <TextField label={tr('Заметки', 'Notes')} value={rule.notes} onChange={(v) => updateCustomRule(idx, { notes: v })} />
                                </div>
                                
                                <div className="relative z-10">
                                    <label className="block space-y-2 group">
                                        <span className="text-sm font-semibold tracking-wide text-white/50">{tr('Паттерн (Pattern)', 'Pattern')}</span>
                                        <div className="relative">
                                            <input
                                                type="text"
                                                value={rule.pattern}
                                                onChange={(e) => updateCustomRule(idx, { pattern: e.target.value })}
                                                className="w-full rounded-2xl border border-[var(--color-primary-1)]/30 bg-black/40 px-5 py-4 text-sm text-[var(--color-primary-1)] font-mono outline-none focus:border-[var(--color-primary-1)] focus:ring-2 focus:ring-[var(--color-primary-1)]/30 transition-all shadow-inner"
                                            />
                                        </div>
                                    </label>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                <div className="flex flex-col sm:flex-row gap-4 mt-6">
                    <button
                        type="button"
                        onClick={addCustomRule}
                        disabled={config.customRules.length >= 10}
                        className="flex-1 flex items-center justify-center gap-3 rounded-[20px] border border-dashed border-[var(--color-primary-1)] bg-[var(--color-primary-1)]/10 py-4 text-sm font-black tracking-wide text-[var(--color-primary-1)] transition-all hover:bg-[var(--color-primary-1)]/20 shadow-[0_0_20px_rgba(var(--color-primary-1-rgb),0.1)] hover:shadow-[0_0_30px_rgba(var(--color-primary-1-rgb),0.2)] disabled:opacity-30 disabled:pointer-events-none"
                    >
                        <Plus size={20} weight="bold" /> {tr('Добавить правило', 'Add Rule')}
                    </button>
                    {/* Template quick injections */}
                    {CUSTOM_RULE_TEMPLATES.map((tpl, i) => (
                        <button
                            key={i}
                            type="button"
                            onClick={() => applyTemplate(tpl)}
                            disabled={config.customRules.length >= 10}
                            className="inline-flex items-center justify-center gap-2 rounded-[20px] border border-white/10 bg-white/5 px-6 py-4 text-sm font-bold text-white/70 transition-all hover:border-white/20 hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:pointer-events-none"
                        >
                            <MagicWand size={18} weight="duotone" className="text-[var(--color-primary-1)]" /> 
                            {tpl.name}
                        </button>
                    ))}
                </div>
            </AnimatedCard>

            {/* Sanction Steps / Strikes */}
            <AnimatedCard title={tr('Матрица Эскалации', 'Escalation Matrix')} subtitle={tr('Настройка ступеней наказаний при наборе пользователем страйков.', 'Configure punishment steps when user accumulates strikes.')}>
                {config.sanctionSteps.length === 0 ? (
                    <div className="py-12 flex flex-col items-center justify-center text-white/30 border border-white/5 bg-white/[0.02] rounded-3xl mb-6">
                        <WarningOctagon size={48} weight="duotone" className="mb-4 opacity-50 text-[var(--color-warning)]" />
                        <p className="text-lg font-semibold">{tr('Эскалация отключена', 'Escalation disabled')}</p>
                        <p className="text-sm mt-1">{tr('Шаги наказаний не настроены.', 'No sanction steps configured.')}</p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-4 mb-8">
                        {config.sanctionSteps.map((step, idx) => (
                            <div key={idx} className="flex flex-wrap md:flex-nowrap items-center gap-4 rounded-[20px] border border-white/10 bg-black/20 p-5 shadow-inner transition-all hover:bg-black/30 group">
                                <div className="flex items-center justify-center bg-white/5 rounded-xl w-12 h-12 flex-shrink-0 border border-white/10 shadow-sm font-black text-xl text-white/50 group-hover:text-white transition-colors">
                                    {idx + 1}
                                </div>
                                <div className="w-full md:w-32">
                                    <TextField label={tr('Условие (страйки)', 'Trigger (Strikes)')} type="number" value={String(step.triggerStrikeCount)} onChange={(v) => updateSanctionStep(idx, { triggerStrikeCount: parseInt(v) || 0 })} />
                                </div>
                                <div className="w-full md:w-1/4">
                                    <InteractiveSelect label={tr('Тип Наказания', 'Action Type')} value={step.actionType} onChange={(v) => updateSanctionStep(idx, { actionType: v })} options={SANCTION_ACTIONS.map(a => ({ id: a, name: a }))} />
                                </div>
                                <div className="w-full md:w-1/4">
                                    <TextField label={tr('Длительность (мин)', 'Duration (min)')} type="number" value={step.durationMinutes ? String(step.durationMinutes) : ''} onChange={(v) => updateSanctionStep(idx, { durationMinutes: v ? parseInt(v) : null })} placeholder={tr('Навсегда', 'Forever')} />
                                </div>
                                <div className="flex-1 flex items-center justify-end gap-5 pt-6 md:pl-4">
                                    <div className="scale-90">
                                        <SmoothToggle label="" checked={step.enabled} onChange={(v) => updateSanctionStep(idx, { enabled: v })} />
                                    </div>
                                    <button type="button" onClick={() => removeSanctionStep(idx)} className="p-3 bg-white/5 text-white/50 hover:bg-rose-500 hover:text-white rounded-xl transition-all active:scale-95 shadow-md">
                                        <Trash size={20} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
                
                <button
                    type="button"
                    onClick={addSanctionStep}
                    className="w-full flex items-center justify-center gap-3 rounded-[20px] border border-white/10 bg-[var(--color-primary-1)]/10 py-5 text-sm font-black tracking-widest uppercase text-[var(--color-primary-1)] transition-all hover:bg-[var(--color-primary-1)]/20 shadow-inner"
                >
                    <Plus size={20} weight="bold" /> {tr('Добавить ступень', 'Add Escalation Step')}
                </button>
            </AnimatedCard>

        </div>
    );
}

