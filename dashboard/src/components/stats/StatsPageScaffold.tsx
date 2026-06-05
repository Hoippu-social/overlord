'use client';

import React from 'react';

interface StatsPageShellProps {
    children: React.ReactNode;
    className?: string;
}

interface StatsPageHeaderProps {
    title: string;
    subtitle?: string;
    icon: React.ReactNode;
    className?: string;
    iconClassName?: string;
}

interface StatsHeatmapProps {
    days: string[];
    grid: number[][];
    maxValue: number;
    color: string;
    valueLabel: (value: number, day: string, hour: number) => string;
}

export function StatsPageShell({ children, className = '' }: StatsPageShellProps) {
    return (
        <div className={`min-h-screen space-y-4 px-3 pb-8 sm:space-y-6 sm:px-0 ${className}`}>
            {children}
        </div>
    );
}

export function StatsPageHeader({ title, subtitle, icon, className = '', iconClassName = '' }: StatsPageHeaderProps) {
    return (
        <header className={`flex min-w-0 items-center gap-3 sm:gap-4 ${className}`}>
            <div className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[18px] border border-divider bg-surface shadow-sm shadow-black/20 sm:h-14 sm:w-14 sm:rounded-2xl ${iconClassName}`}>
                {icon}
            </div>
            <div className="min-w-0 flex-1">
                <h1 className="dashboard-title-clamp-2 text-2xl font-black leading-tight tracking-normal text-foreground sm:text-3xl">
                    {title}
                </h1>
                {subtitle ? (
                    <p className="mt-1 max-w-3xl text-sm font-medium leading-snug text-[var(--text-secondary)] sm:text-base">
                        {subtitle}
                    </p>
                ) : null}
            </div>
        </header>
    );
}

export function StatsHeatmap({ days, grid, maxValue, color, valueLabel }: StatsHeatmapProps) {
    return (
        <div className="flex h-full min-h-[220px] flex-col justify-center">
            <div
                className="grid items-center gap-x-1 gap-y-1.5"
                style={{ gridTemplateColumns: '1.75rem repeat(24, minmax(0, 1fr))' }}
            >
                <div aria-hidden />
                {Array.from({ length: 24 }).map((_, hour) => (
                    <div key={hour} className="text-center text-[9px] font-semibold leading-none text-[var(--text-muted)] sm:text-[10px]">
                        {hour % 4 === 0 ? hour : ''}
                    </div>
                ))}

                {grid.map((row, dayIndex) => (
                    <React.Fragment key={dayIndex}>
                        <div className="text-[10px] font-bold uppercase leading-none text-[var(--text-secondary)] sm:text-xs">
                            {days[dayIndex].slice(0, 3)}
                        </div>
                        {row.map((value, hour) => {
                            const intensity = value / Math.max(maxValue, 1);
                            const alpha = value > 0 ? 0.16 + intensity * 0.74 : 0.035;

                            return (
                                <div
                                    key={`${dayIndex}-${hour}`}
                                    title={valueLabel(value, days[dayIndex], hour)}
                                    className="h-4 rounded-[5px] border border-white/[0.025] transition-transform hover:scale-125 hover:border-white/20 sm:h-6 sm:rounded-full"
                                    style={{ backgroundColor: `rgba(${color}, ${alpha})` }}
                                />
                            );
                        })}
                    </React.Fragment>
                ))}
            </div>
        </div>
    );
}
