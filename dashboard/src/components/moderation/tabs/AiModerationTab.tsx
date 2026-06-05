import React from 'react';
import { ConfigState, AiIncidentState } from '@/app/dashboard/[guildId]/moderation/types';
import { AnimatedCard, SmoothToggle, SliderField, MultiSelectField, TagsInputField, TextAreaField, Badge } from '@/components/moderation/ui';
import { ShieldCheck, WarningCircle, Brain, Robot, Checks, Cpu, WarningOctagon, Lightning, ShieldWarning, UserCircleGear } from '@phosphor-icons/react';
import { updateAtIndex, removeAtIndex, CATEGORY_LABELS, CATEGORY_LABELS_RU, formatDate, AI_PROVIDER_OPTIONS } from '@/app/dashboard/[guildId]/moderation/constants';

interface AiModerationTabProps {
    config: ConfigState;
    setConfig: React.Dispatch<React.SetStateAction<ConfigState>>;
    incidentState: AiIncidentState;
    locale: 'en' | 'ru';
    tr: (ru: string, en: string) => string;
}

export function AiModerationTab({ config, setConfig, incidentState, locale, tr }: AiModerationTabProps) {
    const categoryLabels = locale === 'ru' ? CATEGORY_LABELS_RU : CATEGORY_LABELS;

    // AI Config Update Handlers
    const updateAiConfig = (key: keyof ConfigState['aiConfig'], val: any) => {
        setConfig(prev => ({
            ...prev,
            aiConfig: { ...prev.aiConfig, [key]: val }
        }));
    };

    // Replace default options just in case to show icons mapping (OpenAI, Gemini, etc.)
    const providerOptions = [
        { id: 'OPENAI', name: 'OpenAI (GPT-4o)', icon: <Brain size={28} weight="duotone" /> },
        { id: 'GEMINI', name: 'Google Gemini', icon: <Robot size={28} weight="duotone" /> },
        { id: 'CLAUDE', name: 'Anthropic Claude', icon: <Cpu size={28} weight="duotone" /> },
        { id: 'LOCAL', name: 'Local / Ollama', icon: <Lightning size={28} weight="duotone" /> }
    ];

    // AI Categories Update Handlers
    const categoryKeys = Object.keys(CATEGORY_LABELS);
    const rulesMap = new Map(config.aiCategories.map(c => [c.category, c]));
    const displayCategories = categoryKeys.map((key, i) => 
        rulesMap.get(key) || { category: key, enabled: false, threshold: config.aiConfig.defaultThreshold, sortOrder: i }
    );

    const handleCategoryChange = (key: string, val: { enabled?: boolean; threshold?: number }) => {
        setConfig(prev => {
            const exists = prev.aiCategories.find(c => c.category === key);
            if (exists) {
                return {
                    ...prev,
                    aiCategories: prev.aiCategories.map(c => c.category === key ? { ...c, ...val } : c)
                };
            }
             return {
                ...prev,
                aiCategories: [...prev.aiCategories, {
                    category: key,
                    enabled: val.enabled ?? false,
                    threshold: val.threshold ?? prev.aiConfig.defaultThreshold,
                    sortOrder: prev.aiCategories.length
                }]
            };
        });
    };

    const activeIncidentCount = incidentState.incidents.filter(i => i.status === 'OPEN').length;

    // Helper for strictness text based on threshold
    const getStrictnessDesc = (val: number) => {
        if (val <= 60) return tr('Параноидальный отлов (Очень высокая строгость)', 'Paranoid detection (Very strict)');
        if (val <= 75) return tr('Сбалансированный режим (Рекомендуется)', 'Balanced mode (Recommended)');
        if (val <= 90) return tr('Мягкий лояльный режим', 'Lenient mode');
        return tr('Срабатывает только на 100% нарушения', 'Triggers only on 100% certainty');
    };

    return (
        <div className="space-y-8 animate-fade-in">
            
            {/* Main Switch & Provider */}
            <AnimatedCard 
                title={tr('Нейросетевая Модерация (AutoMod-V2)', 'AI Moderation (AutoMod-V2)')}
                subtitle={tr('Умный анализ контекста сообщений с использованием передовых языковых моделей.', 'Smart contextual message analysis using state-of-the-art LLMs.')}
            >
                <div className="flex flex-col gap-8 p-2">
                    {/* Main Toggles */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-black/20 p-6 rounded-3xl border border-white/5 shadow-inner">
                        <div className="flex items-center gap-4">
                            <div className={`p-4 rounded-2xl ${config.aiConfig.enabled ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.2)]' : 'bg-white/5 text-white/30 border border-white/5'}`}>
                                <Cpu size={32} weight="duotone" className={config.aiConfig.enabled ? 'animate-pulse' : ''} />
                            </div>
                            <div className="flex-1">
                                <h3 className="font-bold text-lg text-white tracking-wide">{tr('Модуль ИИ', 'AI Engine')}</h3>
                                <p className="text-sm text-white/50">{tr('Анализ текстов', 'Text analysis')}</p>
                            </div>
                            <div className="scale-110">
                                <SmoothToggle label="" checked={config.aiConfig.enabled} onChange={(v) => updateAiConfig('enabled', v)} />
                            </div>
                        </div>

                        <div className={`flex items-center gap-4 transition-all duration-300 ${config.aiConfig.enabled ? 'opacity-100' : 'opacity-40 grayscale blur-[1px]'}`}>
                            <div className={`p-4 rounded-2xl border ${config.aiConfig.scanEdits ? 'bg-[var(--color-primary-1)]/20 text-[var(--color-primary-1)] border-[var(--color-primary-1)]/30' : 'bg-white/5 text-white/30 border-white/5'}`}>
                                <Checks size={32} weight="duotone" />
                            </div>
                            <div className="flex-1">
                                <h3 className="font-bold text-lg text-white">{tr('Проверка изменений', 'Scan Edits')}</h3>
                                <p className="text-sm text-white/50">{tr('Анализировать ред. сообщения', 'Analyze message edits')}</p>
                            </div>
                            <div className="scale-110">
                                <SmoothToggle label="" checked={config.aiConfig.scanEdits} onChange={(v) => updateAiConfig('scanEdits', v)} />
                            </div>
                        </div>
                    </div>

                    {/* Providers (Visual Cards) */}
                    <div className={`space-y-4 transition-all duration-500 ${config.aiConfig.enabled ? 'opacity-100' : 'opacity-30 pointer-events-none'}`}>
                        <h3 className="text-sm font-bold tracking-widest uppercase text-white/40 ml-2">{tr('Выбор Провайдера', 'Select Provider')}</h3>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            {providerOptions.map(p => {
                                const active = config.aiConfig.provider === p.id;
                                return (
                                    <div 
                                        key={p.id}
                                        onClick={() => updateAiConfig('provider', p.id)}
                                        className={`cursor-pointer flex flex-col items-center justify-center p-6 gap-4 rounded-3xl border transition-all duration-300 transform hover:-translate-y-1 ${
                                            active 
                                            ? 'border-[var(--color-primary-1)]/60 bg-[var(--color-primary-1)]/10 shadow-[0_10px_30px_rgba(var(--color-primary-1-rgb),0.15)] text-white' 
                                            : 'border-white/5 bg-black/40 hover:bg-white/5 text-white/50 hover:text-white/90'
                                        }`}
                                    >
                                        <div className={`p-3 rounded-2xl ${active ? 'bg-[var(--color-primary-1)]/20 text-[var(--color-primary-1)]' : 'bg-black/50 text-white/30'}`}>
                                            {p.icon}
                                        </div>
                                        <div className="font-bold text-sm text-center tracking-wide">{p.name}</div>
                                        {active && <div className="absolute top-3 right-3 h-2 w-2 rounded-full bg-[var(--color-primary-1)] animate-ping" />}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Default Strictness Level */}
                    <div className={`bg-black/20 p-6 rounded-3xl border border-white/5 transition-all duration-500 ${config.aiConfig.enabled ? 'opacity-100' : 'opacity-30 pointer-events-none'}`}>
                        <SliderField
                            label={tr('Глобальный порог уверенности (Strictness)', 'Global Confidence Threshold (Strictness)')}
                            value={config.aiConfig.defaultThreshold}
                            min={40} max={100}
                            onChange={(v) => updateAiConfig('defaultThreshold', v)}
                            valueLabel={`${config.aiConfig.defaultThreshold}% - ${getStrictnessDesc(config.aiConfig.defaultThreshold)}`}
                        />
                    </div>

                    {/* Filters & Exemptions */}
                    <div className={`grid grid-cols-1 lg:grid-cols-2 gap-8 pt-6 border-t border-white/10 transition-all duration-500 ${config.aiConfig.enabled ? 'opacity-100' : 'opacity-30 pointer-events-none'}`}>
                        <MultiSelectField
                            label={tr('Включенные каналы (Ограничить ИИ)', 'Included Channels (Restrict AI scope)')}
                            options={config.channels}
                            selected={config.aiConfig.includedChannels}
                            onChange={(keys) => updateAiConfig('includedChannels', keys)}
                        />
                        <MultiSelectField
                            label={tr('Исключенные каналы (Не сканируются)', 'Excluded Channels (Never scanned)')}
                            options={config.channels}
                            selected={config.aiConfig.excludedChannels}
                            onChange={(keys) => updateAiConfig('excludedChannels', keys)}
                        />
                        <MultiSelectField
                            label={tr('Игнорируемые роли', 'Exempt Roles')}
                            options={config.roles}
                            selected={config.aiConfig.exemptRoles}
                            onChange={(keys) => updateAiConfig('exemptRoles', keys)}
                        />
                        <TagsInputField
                            label={tr('Игнорируемые пользователи (ID)', 'Exempt Users (IDs)')}
                            tags={config.aiConfig.exemptUsers}
                            onAdd={(tag) => updateAiConfig('exemptUsers', [...config.aiConfig.exemptUsers, tag])}
                            onRemove={(i) => updateAiConfig('exemptUsers', removeAtIndex(config.aiConfig.exemptUsers, i))}
                        />
                    </div>
                </div>
            </AnimatedCard>

            {/* AI Categories Matrix */}
            <div className={`transition-all duration-700 ease-spring ${config.aiConfig.enabled ? 'opacity-100 translate-y-0' : 'opacity-40 translate-y-8 pointer-events-none'}`}>
                <AnimatedCard title={tr('Матрица категорий', 'Category Matrix')} subtitle={tr('Тонкая настройка чувствительности к разным типам нарушений.', 'Fine-tune sensitivity per violation type.')}>
                    
                    <div className="mb-6 bg-[var(--color-primary-1)]/5 border border-[var(--color-primary-1)]/20 p-1 rounded-3xl overflow-hidden">
                        <TextAreaField
                            label={tr('Пользовательский Prompt (Custom System Prompt)', 'Custom Policy Prompt (System Prompt Injection)')}
                            value={config.aiConfig.customPolicyPrompt}
                            onChange={(v) => updateAiConfig('customPolicyPrompt', v)}
                            placeholder={tr('Ваши инструкции для нейросети (например: "Игнорируй черный юмор в канале mems").', 'Extra instructions for the LLM (e.g. "Ignore dark humor in meme channel").')}
                            rows={2}
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                        {displayCategories.map(cat => {
                            const stateRecord = config.aiCategories.find(c => c.category === cat.category) || cat;
                            return (
                                <div key={cat.category} className={`group flex flex-col gap-5 rounded-[24px] border border-white/10 p-5 transition-all duration-300 ${stateRecord.enabled ? 'bg-black/30 shadow-[0_5px_15px_rgba(14,14,14,0.5)] border-[var(--color-primary-1)]/30' : 'bg-black/10 opacity-60 hover:opacity-100'}`}>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2 rounded-xl border transition-colors ${stateRecord.enabled ? 'bg-[var(--color-primary-1)]/20 text-[var(--color-primary-1)] border-[var(--color-primary-1)]/30' : 'bg-white/5 text-white/30 border-transparent group-hover:bg-white/10 group-hover:text-white/50'}`}>
                                                <ShieldWarning size={20} weight="duotone" />
                                            </div>
                                            <span className="text-sm font-bold tracking-wide text-white/90">
                                                {categoryLabels[cat.category] || cat.category}
                                            </span>
                                        </div>
                                        <div className="scale-90">
                                            <SmoothToggle label="" checked={stateRecord.enabled} onChange={(v) => handleCategoryChange(cat.category, { enabled: v })} />
                                        </div>
                                    </div>
                                    <div className={`transition-all duration-300 ${stateRecord.enabled ? 'opacity-100 h-14' : 'opacity-0 h-0 overflow-hidden'}`}>
                                        <SliderField
                                            label={tr('Индивидуальный порог', 'Individual Threshold')}
                                            value={stateRecord.threshold}
                                            min={40} max={100}
                                            onChange={(v) => handleCategoryChange(cat.category, { threshold: v })}
                                            valueLabel={`${stateRecord.threshold}%`}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </AnimatedCard>
            </div>

            {/* Incident Feed */}
            <AnimatedCard 
                title={tr('Сводка Инцидентов', 'Incident Feed')} 
                subtitle={tr('Недавние срабатывания нейросети.', 'Recent AI detections.')}
            >
                <div className="mb-6 flex items-center justify-between">
                    <div className="text-sm font-bold uppercase tracking-widest text-white/40">
                        {tr('Последние Флаги', 'Latest Flags')}
                    </div>
                    {activeIncidentCount > 0 
                        ? <Badge variant="warning" className="px-3 py-1 shadow-md animate-pulse"><WarningCircle size={16} /> {activeIncidentCount} {tr('открыто', 'open')}</Badge>
                        : <Badge variant="success" className="px-3 py-1 shadow-md"><ShieldCheck size={16} /> {tr('Чисто', 'Clear')}</Badge>
                    }
                </div>

                {incidentState.incidents.length === 0 ? (
                    <div className="py-16 flex flex-col items-center justify-center text-white/20 border border-white/5 bg-black/20 rounded-3xl">
                        <WarningOctagon size={64} weight="duotone" className="mb-4 opacity-50" />
                        <p className="text-xl font-bold">{tr('Инцидентов пока нет', 'No incidents yet')}</p>
                        <p className="text-sm mt-2 max-w-sm text-center opacity-60">{tr('Здесь появятся сомнительные сообщения, которые отметила нейросеть.', 'Suspicious messages flagged by AI will appear here.')}</p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-4 max-h-[600px] overflow-y-auto pr-3 custom-scrollbar">
                        {incidentState.incidents.map(inc => (
                            <div key={inc.id} className="group flex flex-col xl:flex-row xl:items-start justify-between gap-6 rounded-3xl border border-white/10 bg-black/30 p-6 transition-all hover:bg-black/50 hover:border-white/20">
                                
                                <div className="flex-1 space-y-4">
                                    <div className="flex items-center gap-4">
                                        <div className={`p-3 rounded-2xl border shadow-inner ${inc.status === 'OPEN' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : inc.status === 'CONFIRMED' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : 'bg-white/5 text-white/30 border-transparent'}`}>
                                            <Brain size={28} weight={inc.status === 'OPEN' ? 'duotone' : 'regular'} className={inc.status === 'OPEN' ? 'animate-pulse' : ''} />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-3">
                                                <span className={`font-black text-lg ${inc.status === 'OPEN' ? 'text-amber-400' : inc.status === 'CONFIRMED' ? 'text-rose-400' : 'text-emerald-400'}`}>
                                                    {inc.status}
                                                </span>
                                                <Badge variant="default" className="text-[10px] uppercase font-mono bg-black/40">
                                                    {inc.provider} • {inc.model}
                                                </Badge>
                                            </div>
                                            <div className="text-sm font-semibold text-white/40 mt-1">Author ID: <span className="text-white/70">{inc.authorId}</span></div>
                                        </div>
                                    </div>

                                    {inc.excerpt && (
                                        <div className="relative pl-5 py-2">
                                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-amber-500/50 to-amber-500/10 rounded-full" />
                                            <p className="text-sm font-medium italic text-white/90 line-clamp-3 leading-relaxed">&ldquo;{inc.excerpt}&rdquo;</p>
                                        </div>
                                    )}
                                    
                                    {inc.summary && (
                                        <p className="text-sm text-white/50 bg-black/20 p-3 rounded-xl border border-white/5">{inc.summary}</p>
                                    )}

                                    <div className="flex flex-wrap gap-2 pt-2">
                                        {inc.confidence && (
                                            <Badge variant="default" className="bg-white/10 text-white/80 border-white/5 text-xs shadow-sm">
                                                Conf: {Math.round(inc.confidence * 100)}%
                                            </Badge>
                                        )}
                                        {inc.categories.map(cat => (
                                            <Badge key={cat.category} variant="danger" className="text-xs shadow-sm">
                                                {categoryLabels[cat.category] || cat.category} ({Math.round(cat.score * 100)}%)
                                            </Badge>
                                        ))}
                                    </div>
                                </div>

                                <div className="text-left xl:text-right flex flex-row xl:flex-col justify-between items-center xl:items-end w-full xl:w-auto mt-4 xl:mt-0 pt-4 xl:pt-0 border-t border-white/10 xl:border-t-0">
                                    <div className="text-sm font-bold font-mono text-white/40">{formatDate(inc.createdAt)}</div>
                                    {inc.reviewedAt && (
                                        <div className="flex items-center gap-2 text-xs font-semibold text-white/30 mt-2">
                                            <UserCircleGear size={16} /> 
                                            {inc.reviewerId}
                                        </div>
                                    )}
                                </div>
                                
                            </div>
                        ))}
                    </div>
                )}
            </AnimatedCard>
        </div>
    );
}
