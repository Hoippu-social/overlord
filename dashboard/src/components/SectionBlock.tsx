'use client';

import React, { useState } from 'react';
import { CaretDown } from '@phosphor-icons/react';

interface SectionBlockProps {
    title: string;
    description?: string;
    icon?: React.ReactNode;
    action?: React.ReactNode;
    badge?: React.ReactNode;
    collapsible?: boolean;
    defaultOpen?: boolean;
    children: React.ReactNode;
    /** Additional styling for the container */
    className?: string;
    /** Remove inner padding */
    noPadding?: boolean;
}

export const SectionBlock: React.FC<SectionBlockProps> = ({
    title,
    description,
    icon,
    action,
    badge,
    collapsible = false,
    defaultOpen = true,
    children,
    className = '',
    noPadding = false,
}) => {
    const [open, setOpen] = useState(defaultOpen);

    return (
        <div className={`bg-[#111111] border border-white/[0.04] rounded-[32px] overflow-hidden shadow-xl ${className}`}>
            {/* Header row */}
            <div
                className={`flex items-center gap-3 px-6 py-5 ${collapsible ? 'cursor-pointer hover:bg-white/[0.02] transition-colors select-none' : ''}`}
                onClick={collapsible ? () => setOpen(v => !v) : undefined}
            >
                {icon && (
                    <div className="flex-shrink-0 w-12 h-12 rounded-[20px] bg-white/[0.03] flex items-center justify-center text-white/50 border border-white/[0.04]">
                        {icon}
                    </div>
                )}

                <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <h2 className="dashboard-title-clamp-2 text-base font-bold text-[#e5e5e5] leading-tight">{title}</h2>
                        {badge}
                    </div>
                    {description && (
                        <p className="text-sm text-white/30 leading-snug">{description}</p>
                    )}
                </div>

                {action && (
                    <div className="flex-shrink-0" onClick={e => e.stopPropagation()}>
                        {action}
                    </div>
                )}

                {collapsible && (
                    <CaretDown
                        size={14}
                        className={`flex-shrink-0 text-white/30 transition-transform duration-200 ${open ? '' : '-rotate-90'}`}
                    />
                )}
            </div>

            {/* Content */}
            {(!collapsible || open) && (
                <div className={`border-t border-white/[0.04] ${noPadding ? '' : 'p-6 md:p-8'}`}>
                    {children}
                </div>
            )}
        </div>
    );
};
