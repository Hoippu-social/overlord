'use client';

import React from 'react';

// A Discord-oriented preview panel (embed + action buttons + mentions).
// This is intentionally a lightweight approximation, not a full Discord renderer —
// it exists to explain, in Discord terms, what an operation looks like in-server.

export type PreviewButton = {
    label: string;
    style?: 'primary' | 'secondary' | 'danger' | 'success';
    emoji?: string;
};

const BUTTON_STYLE: Record<NonNullable<PreviewButton['style']>, string> = {
    primary: 'bg-[#5865F2] text-white',
    secondary: 'bg-[#4E5058] text-white',
    danger: 'bg-[#DA373C] text-white',
    success: 'bg-[#248046] text-white',
};

interface DiscordOpsPreviewProps {
    botName?: string;
    channelName?: string | null;
    accent?: string;
    title: string;
    description?: string;
    fields?: Array<{ name: string; value: string }>;
    mentions?: string[];
    buttons?: PreviewButton[];
    footer?: string;
    className?: string;
}

export function DiscordOpsPreview({
    botName = 'Overlord',
    channelName,
    accent = '#75f16a',
    title,
    description,
    fields,
    mentions,
    buttons,
    footer,
    className = '',
}: DiscordOpsPreviewProps) {
    return (
        <div className={`overflow-hidden rounded-2xl border border-[#1f2023] bg-[#313338] font-sans text-white shadow-sm ${className}`}>
            {channelName && (
                <div className="flex items-center gap-1.5 border-b border-black/20 bg-[#2B2D31] px-4 py-2 text-xs font-semibold text-[#949BA4]">
                    <span className="text-[#6d6f78]">#</span>
                    {channelName}
                </div>
            )}
            <div className="flex gap-3 p-4">
                <div className="mt-0.5 flex h-10 w-10 min-w-10 items-center justify-center rounded-full bg-[#5865F2] font-sans text-sm font-semibold text-white">
                    {botName.charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center gap-2">
                        <span className="font-medium text-white">{botName}</span>
                        <span className="flex h-[15px] items-center rounded-[3px] bg-[#5865F2] px-1.5 py-px text-[10px] font-bold uppercase leading-none">BOT</span>
                        <span className="ml-1 text-xs text-[#949BA4]">Today</span>
                    </div>

                    {mentions && mentions.length > 0 && (
                        <div className="mb-2 flex flex-wrap gap-1">
                            {mentions.map((m) => (
                                <span key={m} className="rounded bg-[#3C4270] px-1 py-0.5 text-sm font-medium text-[#C9CDFB]">@{m}</span>
                            ))}
                        </div>
                    )}

                    {/* Embed */}
                    <div className="grid max-w-[440px] rounded-[4px] bg-[#2B2D31]" style={{ borderLeft: `4px solid ${accent}` }}>
                        <div className="flex flex-col gap-2 p-3">
                            <div className="font-semibold text-white">{title}</div>
                            {description && <div className="text-sm leading-[1.3] text-[#DBDEE1]">{description}</div>}
                            {fields && fields.length > 0 && (
                                <div className="mt-1 grid grid-cols-2 gap-2">
                                    {fields.map((f) => (
                                        <div key={f.name} className="min-w-0">
                                            <div className="truncate text-xs font-semibold text-[#B5BAC1]">{f.name}</div>
                                            <div className="truncate text-sm text-[#DBDEE1]">{f.value}</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {footer && <div className="mt-1 text-xs text-[#949BA4]">{footer}</div>}
                        </div>
                    </div>

                    {/* Action buttons */}
                    {buttons && buttons.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                            {buttons.map((btn) => (
                                <span
                                    key={btn.label}
                                    className={`inline-flex items-center gap-1.5 rounded-[3px] px-3.5 py-1.5 text-sm font-medium ${BUTTON_STYLE[btn.style ?? 'secondary']}`}
                                >
                                    {btn.emoji && <span>{btn.emoji}</span>}
                                    {btn.label}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
