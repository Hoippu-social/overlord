'use client';

import React from 'react';

type SegmentedTabsProps = {
    active: string;
    onChange: (tab: string) => void;
    labels: Record<string, string>;
    tabs: readonly string[];
    icons?: Record<string, React.ReactNode>;
    className?: string;
};

export function SegmentedTabs({ active, onChange, labels, tabs, icons, className = '' }: SegmentedTabsProps) {
    return (
        <div className={`no-scrollbar flex w-full min-w-0 flex-nowrap items-stretch gap-1 overflow-x-auto rounded-[20px] border border-divider bg-surface p-1.5 shadow-sm shadow-black/20 md:flex-wrap md:overflow-visible ${className}`}>
            {tabs.map((tab) => {
                const isActive = active === tab;

                return (
                    <button
                        key={tab}
                        type="button"
                        title={labels[tab]}
                        aria-pressed={isActive}
                        onClick={() => onChange(tab)}
                        className={`flex h-10 min-h-10 min-w-[7.25rem] flex-none items-center justify-center gap-2 rounded-xl border px-3 text-[13px] font-bold leading-tight transition-all sm:min-w-[8.5rem] sm:px-4 sm:text-sm md:min-w-[7rem] md:flex-1 lg:min-w-0 ${isActive
                            ? 'border-[var(--border-focus)] bg-primary/10 text-white shadow-[0_0_18px_rgba(117,241,106,0.14)]'
                            : 'border-transparent text-white/40 hover:bg-white/[0.04] hover:text-white/80'
                            }`}
                    >
                        {icons?.[tab] ? <span className="hidden shrink-0 sm:inline-flex">{icons[tab]}</span> : null}
                        <span className="text-center leading-tight">{labels[tab]}</span>
                    </button>
                );
            })}
        </div>
    );
}
