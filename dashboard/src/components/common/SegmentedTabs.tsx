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
        <div className={`flex w-full min-w-0 flex-wrap items-stretch gap-1 rounded-2xl border border-divider bg-surface p-1.5 shadow-sm shadow-black/20 ${className}`}>
            {tabs.map((tab) => {
                const isActive = active === tab;

                return (
                    <button
                        key={tab}
                        type="button"
                        title={labels[tab]}
                        aria-pressed={isActive}
                        onClick={() => onChange(tab)}
                        className={`flex h-10 min-h-10 min-w-[calc(50%-0.125rem)] flex-1 basis-[calc(50%-0.125rem)] items-center justify-center gap-2 rounded-xl border px-3 text-[13px] font-bold leading-tight transition-all sm:min-w-[140px] sm:px-4 sm:text-sm md:min-w-0 md:basis-auto ${isActive
                            ? 'border-[#7AAA7A] bg-[#7AAA7A]/15 text-white shadow-[0_0_18px_rgba(122,170,122,0.16)]'
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
