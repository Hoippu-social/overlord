'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { TrendUp, TrendDown } from '@phosphor-icons/react';

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

        const maxSize = 36;
        const minSize = 20;
        const containerWidth = container.clientWidth;
        if (containerWidth <= 0) return;

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
    }, [value, subValue]);

    useEffect(() => {
        fit();
        const observer = new ResizeObserver(() => requestAnimationFrame(fit));
        if (containerRef.current) observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, [fit]);

    return (
        <div ref={containerRef} className="w-full">
            <span
                ref={textRef}
                className={`font-akony text-[var(--text-primary)] tracking-tight leading-[1.2] inline-block ${
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
    loading = false, description, accentColor = '#75F16A', className = '',
}: StatsCardProps) {
    return (
        <div className={`relative bg-[var(--surface-card)] rounded-[24px] p-5 border border-[var(--border-subtle)] shadow-sm shadow-black/20 overflow-hidden group hover:border-[var(--border-divider)] hover:bg-[var(--surface-hover)] transition-colors duration-300 flex flex-col justify-between min-h-[140px] gap-3 ${className}`}>
            <div className="flex items-start justify-between">
                <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                    <p className="text-xs font-semibold text-[var(--text-secondary)] tracking-wide leading-tight">{title}</p>
                    {description && <p className="text-[10px] uppercase font-bold tracking-wider text-[var(--text-muted)]">{description}</p>}
                </div>
                {icon && (
                    <div
                        className="w-10 h-10 rounded-[12px] flex items-center justify-center flex-shrink-0 ml-2"
                        style={{ backgroundColor: accentColor + '15', color: accentColor }}
                    >
                        {icon}
                    </div>
                )}
            </div>

            <div className="flex items-end justify-between mt-auto gap-2">
                <div className="min-w-0 flex-1">
                    {loading ? (
                        <div className="skeleton h-8 w-24 rounded-lg" />
                    ) : (
                        <AutoFitValue value={value} subValue={subValue} />
                    )}
                </div>

                {trend && (
                    <div className={`flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-full flex-shrink-0 ${trend.isPositive !== false
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : 'bg-rose-500/10 text-rose-400'
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
