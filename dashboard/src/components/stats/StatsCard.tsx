'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { TrendUp, TrendDown } from '@phosphor-icons/react';
import { LoadingSkeleton } from '@/components/common/LoadingSkeleton';

interface StatsCardProps {
    title: string;
    value: string | number;
    subValue?: string;
    icon?: React.ReactNode;
    trend?: { value: number; label?: string; isPositive?: boolean; };
    loading?: boolean;
    description?: string;
    accentColor?: string;
    className?: string;
}

/**
 * AutoFitValue — auto-sizes font to always fit the container width.
 * Starts at maxFontSize and shrinks until text fits (minFontSize floor).
 * Text is always fully visible, never truncated or clipped.
 */
function AutoFitValue({ value, subValue }: { value: string | number; subValue?: string }) {
    const containerRef = useRef<HTMLDivElement>(null);
    const textRef = useRef<HTMLSpanElement>(null);
    const [fontSize, setFontSize] = useState(36);
    const [shouldWrap, setShouldWrap] = useState(false);

    const fit = useCallback(() => {
        const container = containerRef.current;
        const text = textRef.current;
        if (!container || !text) return;

        const containerWidth = container.clientWidth;
        if (containerWidth <= 0) return;
        const maxSize = containerWidth < 180 ? 30 : 36;
        const minSize = containerWidth < 180 ? 18 : 20;

        // First try single-line, shrinking font
        text.style.whiteSpace = 'nowrap';
        let size = maxSize;
        text.style.fontSize = `${size}px`;

        while (text.scrollWidth > containerWidth && size > minSize) {
            size -= 1;
            text.style.fontSize = `${size}px`;
        }

        // If still doesn't fit at min size — allow word wrap at regular spaces
        // Non-breaking spaces (\u00A0) inside pairs will prevent bad breaks
        const needsWrap = text.scrollWidth > containerWidth;
        if (needsWrap) text.style.whiteSpace = 'normal';

        setShouldWrap(needsWrap);
        setFontSize(size);
    }, []);

    useEffect(() => {
        fit();
        const observer = new ResizeObserver(() => requestAnimationFrame(fit));
        if (containerRef.current) observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, [fit, value, subValue]);

    return (
        <div ref={containerRef} className="w-full">
            <span
                ref={textRef}
                className={`inline-block font-akony leading-[1.2] tracking-normal text-[var(--text-primary)] ${
                    shouldWrap ? 'break-words whitespace-normal' : 'whitespace-nowrap'
                }`}
                style={{ fontSize: `${fontSize}px` }}
            >
                {value}
            </span>
            {subValue && (
                <span
                    className="font-akony text-[var(--text-secondary)] whitespace-nowrap ml-1"
                    style={{ fontSize: `${Math.max(fontSize * 0.45, 11)}px` }}
                >
                    {subValue}
                </span>
            )}
        </div>
    );
}

export function StatsCard({
    title, value, subValue, icon, trend,
    loading = false, description, accentColor = 'var(--color-primary-1)', className = '',
}: StatsCardProps) {
    return (
        <div className={`group relative flex min-h-[124px] flex-col justify-between gap-3 overflow-hidden rounded-[22px] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4 shadow-sm shadow-black/20 transition-colors duration-300 hover:border-[var(--border-divider)] hover:bg-[var(--surface-hover)] sm:min-h-[140px] sm:rounded-[24px] sm:p-5 ${className}`}>
            <div className="flex items-start justify-between">
                <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                    <p className="text-xs font-semibold text-[var(--text-secondary)] tracking-wide leading-tight">{title}</p>
                    {description && <p className="text-[10px] uppercase font-bold tracking-wider text-[var(--text-muted)]">{description}</p>}
                </div>
                {icon && (
                    <div
                        className="ml-2 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[12px] sm:h-10 sm:w-10"
                        style={{
                            backgroundColor: `color-mix(in srgb, ${accentColor} 14%, transparent)`,
                            color: accentColor,
                        }}
                    >
                        {icon}
                    </div>
                )}
            </div>

            <div className="flex items-end justify-between mt-auto gap-2">
                <div className="min-w-0 flex-1">
                    {loading ? (
                        <LoadingSkeleton className="h-8 w-24 rounded-lg" />
                    ) : (
                        <AutoFitValue value={value} subValue={subValue} />
                    )}
                </div>

                {trend && (
                    <div className={`flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-full flex-shrink-0 ${trend.isPositive !== false
                        ? 'bg-success/10 text-success'
                        : 'bg-danger/10 text-danger'
                        }`}>
                        {trend.isPositive !== false
                            ? <TrendUp size={12} weight="bold" />
                            : <TrendDown size={12} weight="bold" />}
                        <span>{trend.value}%</span>
                    </div>
                )}
            </div>
        </div>
    );
}
