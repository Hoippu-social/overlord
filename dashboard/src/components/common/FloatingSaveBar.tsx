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
        <>
            <div aria-hidden className={`transition-[height] duration-300 ${visible ? 'h-24 sm:h-28' : 'h-0'}`} />
            <div className={`fixed bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-1/2 z-50 flex w-full max-w-lg -translate-x-1/2 justify-center px-3 transition-all duration-300 ease-out sm:bottom-8 sm:px-4 ${visible ? 'translate-y-0 scale-100 opacity-100' : 'pointer-events-none translate-y-24 scale-95 opacity-0'}`}>
            <div className="flex w-full gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-card)] p-1.5 shadow-2xl sm:p-2">
                <button
                    className="flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-[var(--color-primary-1)] px-4 text-sm font-bold text-black transition-colors hover:bg-[var(--color-primary-2)] hover:text-white disabled:pointer-events-none disabled:opacity-50 sm:h-12"
                    onClick={onSave}
                    disabled={disableSave || saving}
                >
                    {saving ? savingLabel : saveLabel}
                </button>
                <button
                    className="flex h-11 w-11 min-w-11 items-center justify-center rounded-full bg-[var(--surface-hover)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--border-divider)] hover:text-white disabled:pointer-events-none disabled:opacity-50 sm:h-12 sm:w-12 sm:min-w-12"
                    onClick={onReset}
                    title={resetLabel}
                    aria-label={resetLabel}
                    disabled={disableReset}
                >
                    <ArrowClockwise size={20} weight="bold" />
                </button>
            </div>
            </div>
        </>
    );
}
