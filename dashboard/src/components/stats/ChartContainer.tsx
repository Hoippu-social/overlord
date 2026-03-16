'use client';

import React from 'react';

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
    return (
        <div className={`bg-[var(--surface-card)] border border-[var(--border-subtle)] rounded-[24px] p-6 shadow-sm shadow-black/20 flex flex-col ${className}`}>
            <div className="flex items-start justify-between mb-6">
                <div>
                    <h3 className="text-sm font-semibold text-[var(--text-secondary)] tracking-wide">{title}</h3>
                    {subtitle && <p className="text-[10px] uppercase font-bold tracking-wider text-[var(--text-muted)] mt-1">{subtitle}</p>}
                </div>
                {headerAction}
            </div>

            <div style={{ height }} className="w-full relative">
                {loading ? (
                    <div className="absolute inset-0 skeleton rounded-xl" />
                ) : (
                    children
                )}
            </div>
        </div>
    );
}
