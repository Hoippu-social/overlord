'use client';

import React, { useMemo, useState } from 'react';
import { Plus, Trash, IdentificationCard, Gavel } from '@phosphor-icons/react';
import type { LocaleCode } from '@/lib/i18n';
import { getEconomyCopy, FINE_ACTION_LABELS } from '@/lib/economy/i18n';
import { formatBps, formatMultiplier } from '@/lib/economy/format';
import { saveRoleRules } from '@/lib/economy/api';
import type { EconomyWorkspaceData, RoleRule, FineRule, FineActionType } from '@/lib/economy/types';
import {
    Panel,
    Chip,
    Toggle,
    LabeledField,
    NumberField,
    MoneyField,
    SelectField,
    RoleSelect,
    ActionButton,
    RolePill,
} from './primitives';
import { FloatingSaveBar } from '@/components/common/FloatingSaveBar';

interface RoleRulesPanelProps {
    guildId: string;
    data: EconomyWorkspaceData;
    locale: LocaleCode;
    onSaved: () => void;
}

const FINE_ACTIONS: FineActionType[] = ['WARN', 'TIMEOUT', 'MUTE', 'KICK', 'BAN', 'TEMPBAN', 'AUTOMOD'];

function blankRoleRule(roleId: string): RoleRule {
    return {
        roleId,
        earnMultiplier: 1,
        salaryAmount: null,
        salaryIntervalHours: null,
        taxAmount: null,
        taxBps: null,
        taxIntervalHours: null,
        shopDiscountBps: 0,
        shopAccessOnly: false,
        robProtectionBps: 0,
    };
}

function seedFineRules(existing: FineRule[]): FineRule[] {
    const byType = new Map(existing.map((f) => [f.actionType, f]));
    return FINE_ACTIONS.map(
        (actionType) => byType.get(actionType) ?? { actionType, amount: null, percentBps: null, enabled: false }
    );
}

export function RoleRulesPanel({ guildId, data, locale, onSaved }: RoleRulesPanelProps) {
    const t = getEconomyCopy(locale);

    const [roleRules, setRoleRules] = useState<RoleRule[]>(() => data.roleRules.map((r) => ({ ...r })));
    const [fineRules, setFineRules] = useState<FineRule[]>(() => seedFineRules(data.fineRules));
    const [confiscateOnBan, setConfiscateOnBan] = useState<boolean>(data.config.confiscateOnBan);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const original = useMemo(
        () => JSON.stringify({
            roleRules: data.roleRules.map((r) => ({ ...r })),
            fineRules: seedFineRules(data.fineRules),
            confiscateOnBan: data.config.confiscateOnBan,
        }),
        [data]
    );
    const current = JSON.stringify({ roleRules, fineRules, confiscateOnBan });
    const dirty = current !== original;

    const roleById = useMemo(() => new Map(data.roles.map((r) => [r.id, r])), [data.roles]);
    const usedRoleIds = new Set(roleRules.map((r) => r.roleId));

    const updateRule = (index: number, patch: Partial<RoleRule>) => {
        setRoleRules((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
    };
    const removeRule = (index: number) => {
        setRoleRules((prev) => prev.filter((_, i) => i !== index));
    };
    const addRule = () => {
        const firstUnused = data.roles.find((r) => !usedRoleIds.has(r.id));
        setRoleRules((prev) => [...prev, blankRoleRule(firstUnused?.id ?? '')]);
    };

    const updateFine = (actionType: FineActionType, patch: Partial<FineRule>) => {
        setFineRules((prev) => prev.map((f) => (f.actionType === actionType ? { ...f, ...patch } : f)));
    };

    const reset = () => {
        setRoleRules(data.roleRules.map((r) => ({ ...r })));
        setFineRules(seedFineRules(data.fineRules));
        setConfiscateOnBan(data.config.confiscateOnBan);
        setError(null);
    };

    const save = async () => {
        setSaving(true);
        setError(null);
        try {
            await saveRoleRules(guildId, { roleRules, fineRules, confiscateOnBan });
            setSaved(true);
            window.setTimeout(() => setSaved(false), 2500);
            onSaved();
        } catch {
            setError(t.saveFailed);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-5 animate-fade-in">
            <Panel
                title={t.roles.roleRules}
                icon={<IdentificationCard weight="duotone" />}
                action={
                    <ActionButton variant="primary" onClick={addRule}>
                        <Plus size={14} weight="bold" /> {t.roles.addRole}
                    </ActionButton>
                }
                bodyClassName="p-4"
            >
                {roleRules.length === 0 ? (
                    <p className="px-1 py-8 text-center text-sm text-[var(--text-secondary)]">{t.roles.noRoleRules}</p>
                ) : (
                    <div className="space-y-3">
                        {roleRules.map((rule, index) => {
                            const role = roleById.get(rule.roleId);
                            return (
                                <div key={index} className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-hover)] p-4">
                                    <div className="mb-3 flex items-center justify-between gap-2">
                                        <div className="min-w-0 flex-1">
                                            {role ? (
                                                <div className="mb-2"><RolePill name={role.name} color={role.color} /></div>
                                            ) : null}
                                            <RoleSelect
                                                value={rule.roleId || null}
                                                onChange={(v) => updateRule(index, { roleId: v ?? '' })}
                                                roles={data.roles}
                                                placeholder={t.roles.role}
                                            />
                                        </div>
                                        <button
                                            onClick={() => removeRule(index)}
                                            className="shrink-0 rounded-lg border border-transparent p-2 text-[var(--text-secondary)] transition-colors hover:border-[var(--color-destructive)]/40 hover:bg-[var(--color-destructive)]/10 hover:text-[var(--color-destructive)]"
                                            aria-label={t.roles.role}
                                        >
                                            <Trash size={16} />
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                        <LabeledField label={t.roles.earnMultiplier} hint={formatMultiplier(rule.earnMultiplier)}>
                                            <NumberField
                                                value={rule.earnMultiplier}
                                                onChange={(v) => updateRule(index, { earnMultiplier: v ?? 1 })}
                                                step={0.05}
                                                min={0}
                                            />
                                        </LabeledField>
                                        <LabeledField label={t.roles.salary}>
                                            <MoneyField value={rule.salaryAmount} onChange={(v) => updateRule(index, { salaryAmount: v })} allowNull placeholder="—" />
                                        </LabeledField>
                                        <LabeledField label={t.roles.salaryInterval}>
                                            <NumberField value={rule.salaryIntervalHours} onChange={(v) => updateRule(index, { salaryIntervalHours: v })} min={1} allowNull />
                                        </LabeledField>
                                        <LabeledField label={t.roles.tax}>
                                            <MoneyField value={rule.taxAmount} onChange={(v) => updateRule(index, { taxAmount: v })} allowNull placeholder="—" />
                                        </LabeledField>
                                        <LabeledField label={`${t.roles.tax} (bps)`} hint={rule.taxBps != null ? formatBps(rule.taxBps) : undefined}>
                                            <NumberField value={rule.taxBps} onChange={(v) => updateRule(index, { taxBps: v })} min={0} allowNull />
                                        </LabeledField>
                                        <LabeledField label={t.roles.taxInterval}>
                                            <NumberField value={rule.taxIntervalHours} onChange={(v) => updateRule(index, { taxIntervalHours: v })} min={1} allowNull />
                                        </LabeledField>
                                        <LabeledField label={t.roles.shopDiscount} hint={formatBps(rule.shopDiscountBps)}>
                                            <NumberField value={rule.shopDiscountBps} onChange={(v) => updateRule(index, { shopDiscountBps: v ?? 0 })} min={0} max={10000} />
                                        </LabeledField>
                                        <LabeledField label={t.roles.robProtection} hint={formatBps(rule.robProtectionBps)}>
                                            <NumberField value={rule.robProtectionBps} onChange={(v) => updateRule(index, { robProtectionBps: v ?? 0 })} min={0} max={10000} />
                                        </LabeledField>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </Panel>

            <Panel title={t.roles.fineRules} icon={<Gavel weight="duotone" />} bodyClassName="p-4">
                <div className="space-y-2.5">
                    {fineRules.map((fine) => {
                        const percentMode = fine.percentBps != null;
                        return (
                            <div
                                key={fine.actionType}
                                className="grid grid-cols-1 items-end gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-hover)] p-4 sm:grid-cols-[1fr_auto_1fr_auto]"
                            >
                                <div className="flex items-center gap-2">
                                    <Chip tone="neutral">{FINE_ACTION_LABELS[locale][fine.actionType]}</Chip>
                                </div>
                                <div className="w-full sm:w-40">
                                    <LabeledField label={t.roles.fineMode}>
                                        <SelectField<'amount' | 'percent'>
                                            value={percentMode ? 'percent' : 'amount'}
                                            onChange={(mode) =>
                                                mode === 'percent'
                                                    ? updateFine(fine.actionType, { amount: null, percentBps: fine.percentBps ?? 0 })
                                                    : updateFine(fine.actionType, { percentBps: null, amount: fine.amount ?? '0' })
                                            }
                                            options={[
                                                { value: 'amount', label: t.roles.fixedAmount },
                                                { value: 'percent', label: t.roles.percentWallet },
                                            ]}
                                        />
                                    </LabeledField>
                                </div>
                                <div>
                                    {percentMode ? (
                                        <LabeledField label={t.roles.percentWallet} hint={formatBps(fine.percentBps ?? 0)}>
                                            <NumberField value={fine.percentBps} onChange={(v) => updateFine(fine.actionType, { percentBps: v ?? 0 })} min={0} max={10000} />
                                        </LabeledField>
                                    ) : (
                                        <LabeledField label={t.roles.fixedAmount}>
                                            <MoneyField value={fine.amount} onChange={(v) => updateFine(fine.actionType, { amount: v ?? '0' })} placeholder="0" />
                                        </LabeledField>
                                    )}
                                </div>
                                <div className="flex items-center justify-between gap-2 sm:justify-end">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] sm:hidden">{t.roles.fineEnabled}</span>
                                    <Toggle checked={fine.enabled} onChange={(v) => updateFine(fine.actionType, { enabled: v })} label={t.roles.fineEnabled} />
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="mt-4 flex items-center justify-between rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-hover)] px-4 py-3">
                    <span className="text-sm font-bold text-[var(--text-primary)]">{t.roles.confiscateOnBan}</span>
                    <Toggle checked={confiscateOnBan} onChange={setConfiscateOnBan} label={t.roles.confiscateOnBan} />
                </div>
            </Panel>

            {error && <p className="text-xs font-semibold text-[var(--color-destructive)]">{error}</p>}
            {saved && !dirty && <p className="text-xs font-semibold text-[var(--color-primary-1)]">{t.saved}</p>}

            <FloatingSaveBar
                visible={dirty}
                saving={saving}
                saveLabel={t.save}
                savingLabel={t.saving}
                resetLabel={t.reset}
                onSave={() => void save()}
                onReset={reset}
            />
        </div>
    );
}
