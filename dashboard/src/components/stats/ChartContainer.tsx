'use client';

import React from 'react';
import { LoadingSkeleton } from '@/components/common/LoadingSkeleton';

interface ChartContainerProps {
    title: string;
    subtitle?: string;
    children: React.ReactNode;
    loading?: boolean;
    height?: number | string;
    className?: string;
    headerAction?: React.ReactNode;
}

export function ChartContainer({
    title, subtitle, children, loading = false,
    height = 300, className = '', headerAction,
}: ChartContainerProps) {
    const resolvedHeight = typeof height === 'number'
        ? `clamp(260px, 72vw, ${height}px)`
        : height;

    return (
        <div className={`flex flex-col rounded-[22px] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4 shadow-sm shadow-black/20 sm:rounded-[24px] sm:p-6 ${className}`}>
            <div className="mb-4 flex items-start justify-between gap-3 sm:mb-6">
                <div className="min-w-0">
                    <h3 className="dashboard-title-clamp-2 text-sm font-semibold leading-tight tracking-wide text-[var(--text-secondary)]">{title}</h3>
                    {subtitle && <p className="mt-1 text-[10px] font-bold uppercase leading-snug tracking-wider text-[var(--text-muted)]">{subtitle}</p>}
                </div>
                {headerAction}
            </div>

            <div style={{ height: resolvedHeight }} className="relative w-full min-w-0">
                {loading ? (
                    <div className="absolute inset-0">
                        <LoadingSkeleton className="h-full w-full rounded-xl" />
                    </div>
                ) : (
                    children
                )}
            </div>
        </div>
    );
}
