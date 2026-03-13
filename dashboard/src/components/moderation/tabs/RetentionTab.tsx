import React from 'react';
import { ConfigState, RetentionPolicy } from '@/app/dashboard/[guildId]/moderation/types';
import { SectionCard, SelectField, TextField, ToggleField } from '@/components/moderation/ui';
import { Database, Trash } from '@phosphor-icons/react';
import { updateAtIndex, removeAtIndex, RETENTION_CATEGORIES, RETENTION_STRATEGIES } from '@/app/dashboard/[guildId]/moderation/constants';

interface RetentionTabProps {
    config: ConfigState;
    setConfig: React.Dispatch<React.SetStateAction<ConfigState>>;
    locale: 'en' | 'ru';
    tr: (ru: string, en: string) => string;
}

export function RetentionTab({ config, setConfig, locale, tr }: RetentionTabProps) {

    const addPolicy = () => {
        setConfig(prev => ({
            ...prev,
            retentionPolicies: [...prev.retentionPolicies, { category: 'custom_data', strategy: 'KEEP', ttlDays: null, enabled: true }]
        }));
    };

    const updatePolicy = (index: number, val: Partial<RetentionPolicy>) => {
        setConfig(prev => ({
            ...prev,
            retentionPolicies: updateAtIndex(prev.retentionPolicies, index, { ...prev.retentionPolicies[index], ...val })
        }));
    };

    const removePolicy = (index: number) => {
        setConfig(prev => ({
            ...prev,
            retentionPolicies: removeAtIndex(prev.retentionPolicies, index)
        }));
    };

    // Ensure built-in categories are easily accessible or explicitly shown if empty
    // Let's just render whatever is in the config + add button.
    
    return (
        <div className="space-y-6">
            <SectionCard 
                title={tr('Хранение данных (Retention)', 'Data Retention')} 
                subtitle={tr('Управляйте тем, как долго бот хранит различные типы модератских логов.', 'Manage how long the bot retains different types of moderation logs.')}
            >
                {config.retentionPolicies.length === 0 ? (
                    <div className="py-12 text-center text-[var(--text-muted)] border border-dashed border-[var(--border-subtle)] rounded-2xl mb-4">
                        <Database size={48} className="mx-auto mb-4 opacity-20" />
                        {tr('Нет настроенных политик хранения данных.', 'No data retention policies configured.')}
                    </div>
                ) : (
                    <div className="flex flex-col gap-4 mb-6">
                        {config.retentionPolicies.map((policy, idx) => (
                            <div key={idx} className={`flex flex-wrap md:flex-nowrap items-center gap-4 rounded-2xl border p-5 transition-all ${
                                policy.enabled ? 'border-[var(--border-subtle)] bg-[var(--surface-hover)]' : 'border-[var(--border-subtle)] bg-[var(--surface-card)] opacity-50'
                            }`}>
                                <div className="w-full md:w-1/3">
                                    <SelectField
                                        label={tr('Категория данных', 'Data Category')}
                                        value={policy.category}
                                        onChange={(v) => updatePolicy(idx, { category: v })}
                                        options={RETENTION_CATEGORIES.map(c => ({ id: c, name: c }))}
                                        placeholder={tr('Выберите категорию', 'Select Category')}
                                    />
                                </div>
                                <div className="w-full md:w-1/4">
                                    <SelectField
                                        label={tr('Стратегия', 'Strategy')}
                                        value={policy.strategy}
                                        onChange={(v) => updatePolicy(idx, { strategy: v as 'KEEP' | 'DELETE' | 'TRIM' })}
                                        options={RETENTION_STRATEGIES.map(s => ({ id: s, name: s }))}
                                    />
                                </div>
                                <div className={`w-full md:w-1/4 transition-opacity ${policy.strategy === 'KEEP' ? 'opacity-30 pointer-events-none' : 'opacity-100'}`}>
                                    <TextField
                                        label={tr('Дней (TTL)', 'Days (TTL)')}
                                        type="number"
                                        value={policy.ttlDays ? String(policy.ttlDays) : ''}
                                        onChange={(v) => updatePolicy(idx, { ttlDays: v ? parseInt(v) : null })}
                                        placeholder={policy.strategy === 'KEEP' ? '∞' : tr('Количество дней...', 'Number of days...')}
                                    />
                                </div>
                                <div className="flex-1 flex items-center justify-end gap-3 pt-6 md:pl-2">
                                    <ToggleField label="" checked={policy.enabled} onChange={(v) => updatePolicy(idx, { enabled: v })} />
                                    <button 
                                        type="button" 
                                        onClick={() => removePolicy(idx)} 
                                        className="p-2 text-[var(--text-muted)] hover:text-rose-400 hover:bg-rose-400/10 rounded-xl transition-colors"
                                    >
                                        <Trash size={20} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                <button
                    type="button"
                    onClick={addPolicy}
                    className="w-full rounded-2xl border border-dashed border-[var(--color-primary-1)]/50 bg-[var(--color-primary-1)]/5 py-4 text-sm font-bold text-[var(--color-primary-1)] transition-colors hover:bg-[var(--color-primary-1)]/10"
                >
                    + {tr('Добавить правило хранения', 'Add Retention Rule')}
                </button>
            </SectionCard>
        </div>
    );
}
