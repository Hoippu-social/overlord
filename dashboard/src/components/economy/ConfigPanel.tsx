'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Gear, ChartLineUp, DiceFive } from '@phosphor-icons/react';
import type { LocaleCode } from '@/lib/i18n';
import { getEconomyCopy } from '@/lib/economy/i18n';
import { saveEconomyConfig } from '@/lib/economy/api';
import { formatBps } from '@/lib/economy/format';
import type { EconomyConfig, EconomyWorkspaceData } from '@/lib/economy/types';
import { FloatingSaveBar } from '@/components/common/FloatingSaveBar';
import { EmojiField, LabeledField, MoneyField, NumberField, Panel, TextField, Toggle } from './primitives';

type Props = {
    guildId: string;
    data: EconomyWorkspaceData;
    locale: LocaleCode;
    onSaved: () => void;
};

export function ConfigPanel({ guildId, data, locale, onSaved }: Props) {
    const t = getEconomyCopy(locale);
    const original = data.config;

    const [config, setConfig] = useState<EconomyConfig>(original);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        setConfig(original);
    }, [original]);

    const dirty = useMemo(
        () => JSON.stringify(config) !== JSON.stringify(original),
        [config, original]
    );

    const patch = <K extends keyof EconomyConfig>(key: K, value: EconomyConfig[K]) => {
        setConfig((prev) => ({ ...prev, [key]: value }));
        setSaved(false);
        setFailed(false);
    };

    const handleSave = async () => {
        setSaving(true);
        setFailed(false);
        try {
            await saveEconomyConfig(guildId, config);
            setSaved(true);
            onSaved();
        } catch {
            setFailed(true);
        } finally {
            setSaving(false);
        }
    };

    const handleReset = () => {
        setConfig(original);
        setSaved(false);
        setFailed(false);
    };

    return (
        <div className="space-y-6">
            <Panel title={t.config.general} icon={<Gear weight="duotone" />}>
                <div className="grid gap-4 sm:grid-cols-2">
                    <LabeledField label={t.config.enabled}>
                        <Toggle checked={config.enabled} onChange={(v) => patch('enabled', v)} label={t.config.enabled} />
                    </LabeledField>
                    <div className="hidden sm:block" />
                    <LabeledField label={t.config.currencyName}>
                        <TextField value={config.currencyName} onChange={(v) => patch('currencyName', v)} />
                    </LabeledField>
                    <LabeledField label={t.config.currencyEmoji}>
                        <EmojiField
                            value={config.currencyEmoji}
                            onChange={(v) => patch('currencyEmoji', v)}
                            customLabel={t.shop.emojiCustom}
                            serverLabel={t.shop.emojiServer}
                            serverEmojis={data.emojis}
                        />
                    </LabeledField>
                    <LabeledField label={t.config.startingWallet}>
                        <MoneyField value={config.startingWallet} onChange={(v) => patch('startingWallet', v ?? '0')} />
                    </LabeledField>
                </div>
            </Panel>

            <Panel title={t.config.economics} icon={<ChartLineUp weight="duotone" />}>
                <div className="grid gap-4 sm:grid-cols-2">
                    <LabeledField label={t.config.transferCommission} hint={formatBps(config.transferCommissionBps)}>
                        <NumberField
                            value={config.transferCommissionBps}
                            onChange={(v) => patch('transferCommissionBps', v ?? 0)}
                            min={0}
                        />
                    </LabeledField>
                    <LabeledField label={t.config.marketTax} hint={formatBps(config.marketTaxBps)}>
                        <NumberField
                            value={config.marketTaxBps}
                            onChange={(v) => patch('marketTaxBps', v ?? 0)}
                            min={0}
                        />
                    </LabeledField>
                    <LabeledField
                        label={t.config.bankInterest}
                        hint={config.bankInterestBps != null ? formatBps(config.bankInterestBps) : undefined}
                    >
                        <NumberField
                            value={config.bankInterestBps}
                            onChange={(v) => patch('bankInterestBps', v)}
                            min={0}
                            allowNull
                        />
                    </LabeledField>
                </div>
            </Panel>

            <Panel title={t.config.gambling} icon={<DiceFive weight="duotone" />}>
                <div className="grid gap-4 sm:grid-cols-2">
                    <LabeledField label={t.config.gamblingEnabled}>
                        <Toggle
                            checked={config.gamblingEnabled}
                            onChange={(v) => patch('gamblingEnabled', v)}
                            label={t.config.gamblingEnabled}
                        />
                    </LabeledField>
                    <LabeledField label={t.config.houseEdge} hint={formatBps(config.houseEdgeBps)}>
                        <NumberField value={config.houseEdgeBps} onChange={(v) => patch('houseEdgeBps', v ?? 0)} min={0} />
                    </LabeledField>
                    <LabeledField label={t.config.minBet}>
                        <MoneyField value={config.minBet} onChange={(v) => patch('minBet', v ?? '0')} />
                    </LabeledField>
                    <LabeledField label={t.config.maxBet}>
                        <MoneyField value={config.maxBet} onChange={(v) => patch('maxBet', v)} allowNull />
                    </LabeledField>
                    <LabeledField label={t.config.dailyLossCap}>
                        <MoneyField
                            value={config.gamblingDailyLossCap}
                            onChange={(v) => patch('gamblingDailyLossCap', v)}
                            allowNull
                        />
                    </LabeledField>
                </div>
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
