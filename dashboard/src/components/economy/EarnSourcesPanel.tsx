'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { CaretDown } from '@phosphor-icons/react';
import type { LocaleCode } from '@/lib/i18n';
import { EARN_SOURCE_LABELS, getEconomyCopy } from '@/lib/economy/i18n';
import { saveEarnSources } from '@/lib/economy/api';
import {
    EARN_SOURCE_KEYS,
    type EarnSource,
    type EarnSourceKey,
    type EconomyWorkspaceData,
} from '@/lib/economy/types';
import { FloatingSaveBar } from '@/components/common/FloatingSaveBar';
import { Chip, LabeledField, NumberField, Panel, SelectField, TextField, Toggle } from './primitives';

type Props = {
    guildId: string;
    data: EconomyWorkspaceData;
    locale: LocaleCode;
    onSaved: () => void;
};

type Settings = Record<string, unknown>;

function mergeSources(rows: EarnSource[]): EarnSource[] {
    const byKey = new Map(rows.map((row) => [row.source, row]));
    return EARN_SOURCE_KEYS.map(
        (source): EarnSource => byKey.get(source) ?? { source, enabled: false, settings: {} }
    );
}

function num(settings: Settings, key: string, fallback: number): number {
    const raw = settings[key];
    return typeof raw === 'number' ? raw : fallback;
}

function optNum(settings: Settings, key: string): number | null {
    const raw = settings[key];
    return typeof raw === 'number' ? raw : null;
}

function bool(settings: Settings, key: string, fallback: boolean): boolean {
    const raw = settings[key];
    return typeof raw === 'boolean' ? raw : fallback;
}

function str(settings: Settings, key: string, fallback: string): string {
    const raw = settings[key];
    return typeof raw === 'string' ? raw : fallback;
}

export function EarnSourcesPanel({ guildId, data, locale, onSaved }: Props) {
    const t = getEconomyCopy(locale);
    const labels = EARN_SOURCE_LABELS[locale];
    const fields = t.earn.fields;

    const original = useMemo(() => mergeSources(data.earnSources), [data.earnSources]);
    const [sources, setSources] = useState<EarnSource[]>(original);
    const [expanded, setExpanded] = useState<EarnSourceKey | null>(null);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        setSources(original);
    }, [original]);

    const dirty = useMemo(
        () => JSON.stringify(sources) !== JSON.stringify(original),
        [sources, original]
    );

    const setEnabled = (source: EarnSourceKey, enabled: boolean) => {
        setSources((prev) => prev.map((row) => (row.source === source ? { ...row, enabled } : row)));
        markStale();
    };

    const setField = (source: EarnSourceKey, key: string, value: unknown) => {
        setSources((prev) =>
            prev.map((row) =>
                row.source === source ? { ...row, settings: { ...row.settings, [key]: value } } : row
            )
        );
        markStale();
    };

    const markStale = () => {
        setSaved(false);
        setFailed(false);
    };

    const handleSave = async () => {
        setSaving(true);
        setFailed(false);
        try {
            await saveEarnSources(guildId, sources);
            setSaved(true);
            onSaved();
        } catch {
            setFailed(true);
        } finally {
            setSaving(false);
        }
    };

    const handleReset = () => {
        setSources(original);
        setSaved(false);
        setFailed(false);
    };

    const fieldLabel = (key: string) => fields[key] ?? key;

    return (
        <div className="space-y-6">
            <p className="text-sm text-[var(--text-secondary)]">{t.earn.intro}</p>

            <Panel bodyClassName="divide-y divide-[var(--border-divider)]">
                {sources.map((row) => {
                    const isOpen = expanded === row.source;
                    return (
                        <div key={row.source} className="px-5 py-4 transition-colors hover:bg-[var(--surface-hover)]/35">
                            <div className="flex items-center gap-3">
                                <button
                                    type="button"
                                    onClick={() => setExpanded(isOpen ? null : row.source)}
                                    className="flex flex-1 items-center gap-2 text-left"
                                >
                                    <CaretDown
                                        size={16}
                                        weight="bold"
                                        className={`shrink-0 text-[var(--text-secondary)] transition-transform ${isOpen ? 'rotate-0' : '-rotate-90'}`}
                                    />
                                    <span className="text-sm font-bold text-white">{labels[row.source]}</span>
                                    <Chip tone={row.enabled ? 'primary' : 'neutral'} className="scale-90">
                                        {row.enabled ? t.earn.enabled : t.earn.disabled}
                                    </Chip>
                                </button>
                                <Toggle
                                    checked={row.enabled}
                                    onChange={(v) => setEnabled(row.source, v)}
                                    label={labels[row.source]}
                                />
                            </div>

                            {isOpen && (
                                <div className="mt-4 pl-6">
                                    <SourceEditor
                                        source={row.source}
                                        settings={row.settings}
                                        onChange={(key, value) => setField(row.source, key, value)}
                                        fieldLabel={fieldLabel}
                                        categoryLabels={{
                                            messages: labels.MESSAGES,
                                            voice: labels.VOICE,
                                        }}
                                        noSettings={t.earn.noSettings}
                                    />
                                </div>
                            )}
                        </div>
                    );
                })}
            </Panel>

            {(failed || saved) && (
                <p className={`text-xs font-semibold ${failed ? 'text-[var(--color-destructive)]' : 'text-[var(--color-primary-1)]'}`}>
                    {failed ? t.saveFailed : t.saved}
                </p>
            )}

            <FloatingSaveBar
                visible={dirty}
                saving={saving}
                saveLabel={t.save}
                savingLabel={t.saving}
                resetLabel={t.reset}
                onSave={handleSave}
                onReset={handleReset}
            />
        </div>
    );
}

function Grid({ children }: { children: React.ReactNode }) {
    return <div className="grid gap-4 sm:grid-cols-2">{children}</div>;
}

function SourceEditor({
    source,
    settings,
    onChange,
    fieldLabel,
    categoryLabels,
    noSettings,
}: {
    source: EarnSourceKey;
    settings: Settings;
    onChange: (key: string, value: unknown) => void;
    fieldLabel: (key: string) => string;
    categoryLabels: { messages: string; voice: string };
    noSettings: string;
}) {
    const N = (key: string, fallback = 0, extra?: { step?: number; min?: number }) => (
        <LabeledField label={fieldLabel(key)}>
            <NumberField
                value={num(settings, key, fallback)}
                onChange={(v) => onChange(key, v ?? fallback)}
                step={extra?.step}
                min={extra?.min}
            />
        </LabeledField>
    );

    const NOpt = (key: string, extra?: { step?: number; min?: number }) => (
        <LabeledField label={fieldLabel(key)}>
            <NumberField
                value={optNum(settings, key)}
                onChange={(v) => onChange(key, v)}
                step={extra?.step}
                min={extra?.min}
                allowNull
            />
        </LabeledField>
    );

    const B = (key: string, fallback = false) => (
        <LabeledField label={fieldLabel(key)}>
            <Toggle checked={bool(settings, key, fallback)} onChange={(v) => onChange(key, v)} label={fieldLabel(key)} />
        </LabeledField>
    );

    switch (source) {
        case 'MESSAGES':
            return (
                <Grid>
                    {N('minAmount')}
                    {N('maxAmount')}
                    {N('cooldownSeconds', 60)}
                    {N('minMessageLength')}
                    {B('countThreads', true)}
                </Grid>
            );
        case 'VOICE':
            return (
                <Grid>
                    {N('amountPerMinute', 1)}
                    {N('minMembersInChannel', 2)}
                    {B('excludeAfkChannel', true)}
                    {NOpt('dailyCapMinutes')}
                </Grid>
            );
        case 'REACTIONS':
            return (
                <Grid>
                    {N('threshold', 1)}
                    {N('amount')}
                    {NOpt('dailyCapTriggers')}
                </Grid>
            );
        case 'BOOSTER':
            return (
                <Grid>
                    {N('multiplier', 1, { step: 0.05 })}
                    {N('oneTimeBonus')}
                </Grid>
            );
        case 'INVITES':
            return (
                <Grid>
                    {N('amount')}
                    {N('minStayDays')}
                </Grid>
            );
        case 'DAILY':
            return (
                <Grid>
                    {N('baseAmount')}
                    {N('streakBonusPerDay')}
                    {N('streakCap')}
                    {N('graceHours', 24)}
                </Grid>
            );
        case 'WORK':
            return (
                <div className="space-y-4">
                    <Grid>
                        {N('minAmount')}
                        {N('maxAmount')}
                        {N('cooldownHours', 1)}
                    </Grid>
                    <LabeledField label={fieldLabel('flavorTexts')}>
                        <textarea
                            value={(Array.isArray(settings.flavorTexts) ? (settings.flavorTexts as string[]) : []).join('\n')}
                            onChange={(e) =>
                                onChange('flavorTexts', e.target.value.split('\n').map((s) => s.trim()).filter(Boolean))
                            }
                            rows={4}
                            className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-hover)] px-3 py-2 text-sm text-white placeholder:text-[var(--text-secondary)] transition-colors focus:border-[var(--color-primary-1)]/50 focus:outline-none"
                        />
                    </LabeledField>
                </div>
            );
        case 'CRIME':
            return (
                <Grid>
                    {N('minReward')}
                    {N('maxReward')}
                    {N('successPct', 50, { min: 0 })}
                    {N('minFine')}
                    {N('maxFine')}
                    {N('cooldownHours', 1)}
                </Grid>
            );
        case 'ROB':
            return (
                <Grid>
                    {N('successPct', 40, { min: 0 })}
                    {N('stealPctOfWalletMin', 10, { min: 0 })}
                    {N('stealPctOfWalletMax', 30, { min: 0 })}
                    {N('cooldownHours', 4)}
                    {N('minTargetWallet')}
                    {N('minTargetAccountAgeDays')}
                </Grid>
            );
        case 'LOOT_DROP':
            return (
                <Grid>
                    {N('min')}
                    {N('max')}
                    {N('chancePct', 5, { min: 0 })}
                </Grid>
            );
        case 'BIRTHDAY':
            return <Grid>{N('amount')}</Grid>;
        case 'TICKET_BONUS':
            return (
                <Grid>
                    {N('minRating', 5)}
                    {N('amount')}
                </Grid>
            );
        case 'STATS_TOP':
            return (
                <Grid>
                    <LabeledField label={fieldLabel('period')}>
                        <TextField value={str(settings, 'period', '')} onChange={(v) => onChange('period', v)} />
                    </LabeledField>
                    <LabeledField label={fieldLabel('category')}>
                        <SelectField
                            value={str(settings, 'category', 'MESSAGES')}
                            onChange={(v) => onChange('category', v)}
                            options={[
                                { value: 'MESSAGES', label: categoryLabels.messages },
                                { value: 'VOICE', label: categoryLabels.voice },
                            ]}
                        />
                    </LabeledField>
                </Grid>
            );
        case 'CLEAN_RECORD':
            return (
                <Grid>
                    {N('days', 30)}
                    {N('amount')}
                </Grid>
            );
        case 'WORLD_EVENTS':
            return (
                <Grid>
                    {N('chancePerHour', 5, { min: 0 })}
                    {N('durationHours', 1)}
                    {N('multiplier', 1, { step: 0.05 })}
                </Grid>
            );
        default:
            return <p className="text-sm text-[var(--text-secondary)]">{noSettings}</p>;
    }
}
