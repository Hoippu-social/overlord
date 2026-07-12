'use client';

import React, { useMemo, useState } from 'react';
import { Plus, Trash, Scroll, Medal } from '@phosphor-icons/react';
import type { LocaleCode } from '@/lib/i18n';
import type {
    Achievement,
    AchievementMetric,
    EconomyWorkspaceData,
    QuestKind,
    QuestMetric,
    QuestTemplate,
} from '@/lib/economy/types';
import {
    getEconomyCopy,
    QUEST_METRIC_LABELS,
    ACHIEVEMENT_METRIC_LABELS,
} from '@/lib/economy/i18n';
import { saveQuests, saveAchievements } from '@/lib/economy/api';
import {
    Panel,
    EmptyState,
    Toggle,
    LabeledField,
    TextField,
    NumberField,
    MoneyField,
    SelectField,
    ActionButton,
    EmojiField,
} from '@/components/economy/primitives';
import { FloatingSaveBar } from '@/components/common/FloatingSaveBar';

interface QuestsPanelProps {
    guildId: string;
    data: EconomyWorkspaceData;
    locale: LocaleCode;
    onSaved: () => void;
}

const QUEST_METRICS: QuestMetric[] = ['MESSAGES', 'VOICE_MINUTES', 'REACTIONS', 'GAMES_PLAYED', 'ITEMS_BOUGHT'];
const ACHIEVEMENT_METRICS: AchievementMetric[] = ['TOTAL_EARNED', 'DAILY_STREAK', 'GAMES_WON', 'LOTTERY_WIN', 'VOICE_MINUTES', 'MESSAGES'];

export function QuestsPanel({ guildId, data, locale, onSaved }: QuestsPanelProps) {
    const t = getEconomyCopy(locale);

    const [quests, setQuests] = useState<QuestTemplate[]>(data.quests);
    const [achievements, setAchievements] = useState<Achievement[]>(data.achievements);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const questsDirty = useMemo(
        () => JSON.stringify(quests) !== JSON.stringify(data.quests),
        [quests, data.quests]
    );
    const achievementsDirty = useMemo(
        () => JSON.stringify(achievements) !== JSON.stringify(data.achievements),
        [achievements, data.achievements]
    );
    const dirty = questsDirty || achievementsDirty;

    const questMetricOptions = QUEST_METRICS.map((m) => ({ value: m, label: QUEST_METRIC_LABELS[locale][m] }));
    const achievementMetricOptions = ACHIEVEMENT_METRICS.map((m) => ({ value: m, label: ACHIEVEMENT_METRIC_LABELS[locale][m] }));
    const kindOptions: { value: QuestKind; label: string }[] = [
        { value: 'DAILY', label: t.quests.daily },
        { value: 'WEEKLY', label: t.quests.weekly },
    ];

    //  Quest mutators 
    const updateQuest = (id: number, patch: Partial<QuestTemplate>) => {
        setQuests((prev) => prev.map((q) => (q.id === id ? { ...q, ...patch } : q)));
    };
    const removeQuest = (id: number) => setQuests((prev) => prev.filter((q) => q.id !== id));
    const addQuest = () => {
        setQuests((prev) => [
            ...prev,
            {
                id: -Date.now(),
                kind: 'DAILY',
                metric: 'MESSAGES',
                target: 10,
                reward: '100',
                name: '',
                description: '',
                enabled: true,
                sortOrder: prev.length,
            },
        ]);
    };

    //  Achievement mutators 
    const updateAchievement = (id: number, patch: Partial<Achievement>) => {
        setAchievements((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
    };
    const removeAchievement = (id: number) => setAchievements((prev) => prev.filter((a) => a.id !== id));
    const addAchievement = () => {
        setAchievements((prev) => [
            ...prev,
            {
                id: -Date.now(),
                key: '',
                name: '',
                description: '',
                metric: 'TOTAL_EARNED',
                threshold: 1000,
                reward: '500',
                badgeEmoji: '',
                enabled: true,
            },
        ]);
    };

    const flashSaved = () => {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    const save = async () => {
        setSaving(true);
        setError(null);
        try {
            if (questsDirty) await saveQuests(guildId, quests);
            if (achievementsDirty) await saveAchievements(guildId, achievements);
            flashSaved();
            onSaved();
        } catch (e) {
            setError(e instanceof Error ? e.message : t.saveFailed);
        } finally {
            setSaving(false);
        }
    };

    const reset = () => {
        setQuests(data.quests);
        setAchievements(data.achievements);
        setError(null);
    };

    return (
        <div className="space-y-5 animate-fade-in">
            {(error || saved) && (
                <div
                    className={`rounded-2xl border px-4 py-3 text-xs font-bold ${
                        error
                            ? 'border-[var(--color-destructive)]/30 bg-[var(--color-destructive)]/10 text-[var(--color-destructive)]'
                            : 'border-[var(--color-primary-1)]/30 bg-[var(--color-primary-1)]/10 text-[var(--color-primary-1)]'
                    }`}
                >
                    {error ?? t.saved}
                </div>
            )}

            {/*  Quest templates  */}
            <Panel
                title={t.quests.questTemplates}
                icon={<Scroll weight="duotone" />}
                action={
                    <ActionButton variant="primary" onClick={addQuest}>
                        <Plus size={14} weight="bold" /> {t.quests.add}
                    </ActionButton>
                }
            >
                {quests.length === 0 ? (
                    <EmptyState title={t.quests.empty} icon={<Scroll size={40} weight="duotone" />} />
                ) : (
                    <div className="space-y-3">
                        {quests.map((quest) => (
                            <div
                                key={quest.id}
                                className="rounded-[18px] border border-[var(--border-subtle)] bg-[var(--surface-hover)]/40 p-4"
                            >
                                <div className="grid gap-3 sm:grid-cols-2">
                                    <LabeledField label={t.quests.name}>
                                        <TextField value={quest.name} onChange={(v) => updateQuest(quest.id, { name: v })} />
                                    </LabeledField>
                                    <LabeledField label={t.shop?.description ?? ''}>
                                        <TextField
                                            value={quest.description ?? ''}
                                            onChange={(v) => updateQuest(quest.id, { description: v })}
                                        />
                                    </LabeledField>
                                    <LabeledField label={t.quests.kind}>
                                        <SelectField<QuestKind>
                                            value={quest.kind}
                                            onChange={(v) => updateQuest(quest.id, { kind: v })}
                                            options={kindOptions}
                                        />
                                    </LabeledField>
                                    <LabeledField label={t.quests.metric}>
                                        <SelectField<QuestMetric>
                                            value={quest.metric}
                                            onChange={(v) => updateQuest(quest.id, { metric: v })}
                                            options={questMetricOptions}
                                        />
                                    </LabeledField>
                                    <LabeledField label={t.quests.target}>
                                        <NumberField
                                            value={quest.target}
                                            min={0}
                                            onChange={(v) => updateQuest(quest.id, { target: v ?? 0 })}
                                            className="text-right tabular-nums"
                                        />
                                    </LabeledField>
                                    <LabeledField label={t.quests.reward}>
                                        <MoneyField
                                            value={quest.reward}
                                            onChange={(v) => updateQuest(quest.id, { reward: v ?? '0' })}
                                            className="text-right tabular-nums"
                                        />
                                    </LabeledField>
                                </div>
                                <div className="mt-3 flex items-center justify-between border-t border-[var(--border-divider)] pt-3">
                                    <label className="flex items-center gap-2 text-xs font-bold text-[var(--text-secondary)]">
                                        <Toggle
                                            checked={quest.enabled}
                                            onChange={(v) => updateQuest(quest.id, { enabled: v })}
                                            label={t.quests.enabled}
                                        />
                                        {t.quests.enabled}
                                    </label>
                                    <button
                                        onClick={() => removeQuest(quest.id)}
                                        className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-hover)] px-2.5 py-1 text-xs font-bold text-[var(--text-secondary)] transition-colors hover:border-[var(--color-destructive)]/40 hover:text-[var(--color-destructive)]"
                                        aria-label="delete"
                                    >
                                        <Trash size={14} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </Panel>

            {/*  Achievements  */}
            <Panel
                title={t.quests.achievements}
                icon={<Medal weight="duotone" />}
                action={
                    <ActionButton variant="primary" onClick={addAchievement}>
                        <Plus size={14} weight="bold" /> {t.quests.add}
                    </ActionButton>
                }
            >
                {achievements.length === 0 ? (
                    <EmptyState title={t.quests.empty} icon={<Medal size={40} weight="duotone" />} />
                ) : (
                    <div className="space-y-3">
                        {achievements.map((ach) => (
                            <div
                                key={ach.id}
                                className="rounded-[18px] border border-[var(--border-subtle)] bg-[var(--surface-hover)]/40 p-4"
                            >
                                <div className="grid gap-3 sm:grid-cols-2">
                                    <LabeledField label="key">
                                        <TextField value={ach.key} onChange={(v) => updateAchievement(ach.id, { key: v })} />
                                    </LabeledField>
                                    <LabeledField label={t.quests.name}>
                                        <TextField value={ach.name} onChange={(v) => updateAchievement(ach.id, { name: v })} />
                                    </LabeledField>
                                    <LabeledField label={t.shop?.description ?? ''}>
                                        <TextField
                                            value={ach.description ?? ''}
                                            onChange={(v) => updateAchievement(ach.id, { description: v })}
                                        />
                                    </LabeledField>
                                    <LabeledField label={t.quests.metric}>
                                        <SelectField<AchievementMetric>
                                            value={ach.metric}
                                            onChange={(v) => updateAchievement(ach.id, { metric: v })}
                                            options={achievementMetricOptions}
                                        />
                                    </LabeledField>
                                    <LabeledField label={t.quests.threshold}>
                                        <NumberField
                                            value={ach.threshold}
                                            min={0}
                                            onChange={(v) => updateAchievement(ach.id, { threshold: v ?? 0 })}
                                            className="text-right tabular-nums"
                                        />
                                    </LabeledField>
                                    <LabeledField label={t.quests.reward}>
                                        <MoneyField
                                            value={ach.reward}
                                            onChange={(v) => updateAchievement(ach.id, { reward: v ?? '0' })}
                                            className="text-right tabular-nums"
                                        />
                                    </LabeledField>
                                    <LabeledField label={t.quests.badge}>
                                        <EmojiField
                                            value={ach.badgeEmoji ?? null}
                                            onChange={(v) => updateAchievement(ach.id, { badgeEmoji: v ?? '' })}
                                            customLabel={t.shop.emojiCustom}
                                            serverLabel={t.shop.emojiServer}
                                            serverEmojis={data.emojis}
                                        />
                                    </LabeledField>
                                </div>
                                <div className="mt-3 flex items-center justify-between border-t border-[var(--border-divider)] pt-3">
                                    <label className="flex items-center gap-2 text-xs font-bold text-[var(--text-secondary)]">
                                        <Toggle
                                            checked={ach.enabled}
                                            onChange={(v) => updateAchievement(ach.id, { enabled: v })}
                                            label={t.quests.enabled}
                                        />
                                        {t.quests.enabled}
                                    </label>
                                    <button
                                        onClick={() => removeAchievement(ach.id)}
                                        className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-hover)] px-2.5 py-1 text-xs font-bold text-[var(--text-secondary)] transition-colors hover:border-[var(--color-destructive)]/40 hover:text-[var(--color-destructive)]"
                                        aria-label="delete"
                                    >
                                        <Trash size={14} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </Panel>

            <FloatingSaveBar
                visible={dirty}
                saving={saving}
                saveLabel={t.save}
                savingLabel={t.saving}
                resetLabel={t.reset}
                onSave={save}
                onReset={reset}
            />
        </div>
    );
}
