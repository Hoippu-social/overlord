'use client';

import React from 'react';
import { ArrowClockwise } from '@phosphor-icons/react';

type FloatingSaveBarProps = {
    visible: boolean;
    saving?: boolean;
    saveLabel: string;
    savingLabel: string;
    resetLabel: string;
    onSave: () => void;
    onReset: () => void;
    disableSave?: boolean;
    disableReset?: boolean;
};

export function FloatingSaveBar({
    visible,
    saving = false,
    saveLabel,
    savingLabel,
    resetLabel,
    onSave,
    onReset,
    disableSave = false,
    disableReset = false,
}: FloatingSaveBarProps) {
    return (
        <div className={`fixed bottom-8 left-1/2 z-50 flex w-full max-w-lg -translate-x-1/2 justify-center px-4 transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${visible ? 'translate-y-0 scale-100 opacity-100' : 'pointer-events-none translate-y-24 scale-95 opacity-0'}`}>
            <div className="flex w-full gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-card)] p-2 shadow-2xl">
                <button
                    className="flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-[var(--color-primary-1)] text-sm font-bold text-black transition-colors hover:bg-[var(--color-primary-2)] disabled:pointer-events-none disabled:opacity-50"
                    onClick={onSave}
                    disabled={disableSave || saving}
                >
                    {saving ? savingLabel : saveLabel}
                </button>
                <button
                    className="flex h-12 w-12 min-w-12 items-center justify-center rounded-full bg-[var(--surface-hover)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--border-divider)] hover:text-white disabled:pointer-events-none disabled:opacity-50"
                    onClick={onReset}
                    title={resetLabel}
                    aria-label={resetLabel}
                    disabled={disableReset}
                >
                    <ArrowClockwise size={20} weight="bold" />
                </button>
            </div>
        </div>
    );
}
