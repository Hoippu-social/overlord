'use client';

import React from 'react';

type SegmentedTabsProps = {
    active: string;
    onChange: (tab: string) => void;
    labels: Record<string, string>;
    tabs: readonly string[];
    icons?: Record<string, React.ReactNode>;
    className?: string;
    density?: 'default' | 'compact';
    dataTour?: string;
};

export function SegmentedTabs({ active, onChange, labels, tabs, icons, className = '', density = 'default', dataTour }: SegmentedTabsProps) {
    const activeButtonRef = React.useRef<HTMLButtonElement | null>(null);
    const buttonSizing = density === 'compact'
        ? 'min-w-[4.75rem] px-2 text-[12px] sm:min-w-[7rem] sm:px-3 sm:text-[13px] md:min-w-[7rem] md:flex-1 lg:min-w-0'
        : 'min-w-[7.25rem] px-3 text-[13px] sm:min-w-[8.5rem] sm:px-4 sm:text-sm md:min-w-[7rem] md:flex-1 lg:min-w-0';

    React.useEffect(() => {
        activeButtonRef.current?.scrollIntoView({
            block: 'nearest',
            inline: 'nearest',
        });
    }, [active]);

    return (
        <div className="relative min-w-0">
        <div
            data-tour={dataTour}
            role="tablist"
            aria-label="Sections"
            className={`no-scrollbar flex w-full min-w-0 snap-x snap-mandatory flex-nowrap items-stretch gap-1 overflow-x-auto rounded-[20px] border border-divider bg-surface p-1.5 pr-8 shadow-sm shadow-black/20 md:flex-wrap md:overflow-visible md:pr-1.5 ${className}`}
        >
            {tabs.map((tab) => {
                const isActive = active === tab;

                return (
                    <button
                        key={tab}
                        ref={isActive ? activeButtonRef : null}
                        type="button"
                        title={labels[tab]}
                        role="tab"
                        aria-selected={isActive}
                        onClick={() => onChange(tab)}
                        className={`flex h-10 min-h-10 flex-none snap-start items-center justify-center gap-2 rounded-xl border font-bold leading-tight transition-all ${buttonSizing} ${isActive
                            ? 'border-[var(--border-focus)] bg-primary/10 text-white shadow-[0_0_18px_rgba(117,241,106,0.14)]'
                            : 'border-transparent text-[var(--text-secondary)] hover:bg-surface-hover hover:text-[var(--text-primary)]'
                            }`}
                    >
                        {icons?.[tab] ? <span className="hidden shrink-0 sm:inline-flex">{icons[tab]}</span> : null}
                        <span className="text-center leading-tight">{labels[tab]}</span>
                    </button>
                );
            })}
        </div>
        <span aria-hidden className="pointer-events-none absolute inset-y-px right-px w-9 rounded-r-[20px] bg-gradient-to-l from-[var(--surface-card)] to-transparent md:hidden" />
        </div>
    );
}
