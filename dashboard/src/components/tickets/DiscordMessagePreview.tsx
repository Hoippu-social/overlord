'use client';

import React from 'react';
import { ArrowSquareOut } from '@phosphor-icons/react';

export type APIEmbed = {
    title?: string;
    description?: string;
    url?: string;
    color?: number;
    timestamp?: string;
    footer?: { text: string; icon_url?: string };
    image?: { url: string };
    thumbnail?: { url: string };
    video?: { url: string };
    provider?: { name?: string; url?: string };
    author?: { name: string; url?: string; icon_url?: string };
    fields?: Array<{ name: string; value: string; inline?: boolean }>;
};

export type MessagePayload = {
    content: string;
    embeds?: APIEmbed[];
};

type DiscordMessageFrameProps = {
    botName?: string;
    botAvatar?: string;
    children: React.ReactNode;
};

interface DiscordMessagePreviewProps {
    message: MessagePayload;
    botName?: string;
    botAvatar?: string;
    actions?: React.ReactNode;
}

const DISCORD_FONT = '"gg sans", "Noto Sans", "Helvetica Neue", Helvetica, Arial, sans-serif';

function colorIntToHex(color?: number) {
    if (typeof color !== 'number') return '#1f2225';
    return `#${color.toString(16).padStart(6, '0')}`;
}

function safeHref(value?: string) {
    if (!value) return undefined;
    try {
        const url = new URL(value);
        return url.protocol === 'http:' || url.protocol === 'https:' ? value : undefined;
    } catch {
        return undefined;
    }
}

function formatDiscordTimestamp(timestamp?: string) {
    if (!timestamp) return null;
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return null;
    return new Intl.DateTimeFormat('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    }).format(date);
}

function renderInline(source: string, keyPrefix: string): React.ReactNode[] {
    const token = /(https?:\/\/[^\s<]+)|\[([^\]]+)]\((https?:\/\/[^\s)]+)\)|<(a?):([\w~]+):(\d+)>|(<@!?\d+>|<@&\d+>|<#\d+>)|\*\*([^*]+)\*\*|__([^_]+)__|~~([^~]+)~~|`([^`]+)`|\*([^*\n]+)\*/g;
    const output: React.ReactNode[] = [];
    let cursor = 0;
    let match: RegExpExecArray | null;
    let index = 0;

    while ((match = token.exec(source)) !== null) {
        if (match.index > cursor) output.push(source.slice(cursor, match.index));
        const key = `${keyPrefix}-${index++}`;
        if (match[1]) {
            output.push(<a key={key} href={match[1]} target="_blank" rel="noreferrer" className="text-[#00a8fc] hover:underline">{match[1]}</a>);
        } else if (match[2] && match[3]) {
            output.push(<a key={key} href={match[3]} target="_blank" rel="noreferrer" className="text-[#00a8fc] hover:underline">{match[2]}</a>);
        } else if (match[5] && match[6]) {
            output.push(
                <img
                    key={key}
                    src={`https://cdn.discordapp.com/emojis/${match[6]}.${match[4] ? 'gif' : 'webp'}?size=48&quality=lossless`}
                    alt={`:${match[5]}:`}
                    title={`:${match[5]}:`}
                    className="mx-0.5 inline-block h-[1.375em] w-[1.375em] align-[-0.3em] object-contain"
                />,
            );
        } else if (match[7]) {
            const isChannel = match[7].startsWith('<#');
            const isRole = match[7].startsWith('<@&');
            output.push(<span key={key} className="rounded-[3px] bg-[#5865f24d] px-0.5 font-medium text-[#c9cdfb]">{isChannel ? '#channel' : isRole ? '@role' : '@user'}</span>);
        } else if (match[8]) {
            output.push(<strong key={key} className="font-bold text-[#f2f3f5]">{renderInline(match[8], `${key}-strong`)}</strong>);
        } else if (match[9]) {
            output.push(<span key={key} className="underline decoration-1 underline-offset-2">{renderInline(match[9], `${key}-underline`)}</span>);
        } else if (match[10]) {
            output.push(<s key={key}>{renderInline(match[10], `${key}-strike`)}</s>);
        } else if (match[11]) {
            output.push(<code key={key} className="rounded-[3px] bg-[#1e1f22] px-1 py-0.5 font-mono text-[0.875em] text-[#dbdee1]">{match[11]}</code>);
        } else if (match[12]) {
            output.push(<em key={key}>{renderInline(match[12], `${key}-em`)}</em>);
        }
        cursor = token.lastIndex;
    }
    if (cursor < source.length) output.push(source.slice(cursor));
    return output;
}

export function DiscordMarkdown({ content, compact = false }: { content: string; compact?: boolean }) {
    const lines = content.replace(/\r\n/g, '\n').split('\n');
    const blocks: React.ReactNode[] = [];
    let codeFence: { language: string; lines: string[] } | null = null;
    let index = 0;

    for (const line of lines) {
        if (line.startsWith('```')) {
            if (codeFence) {
                blocks.push(
                    <pre key={`code-${index++}`} className="my-1 max-w-full overflow-x-auto rounded-[4px] border border-[#111214] bg-[#1e1f22] p-2 font-mono text-xs leading-[1.125rem] text-[#b5bac1]">
                        <code>{codeFence.lines.join('\n')}</code>
                    </pre>,
                );
                codeFence = null;
            } else {
                codeFence = { language: line.slice(3).trim(), lines: [] };
            }
            continue;
        }
        if (codeFence) {
            codeFence.lines.push(line);
            continue;
        }
        if (!line) {
            blocks.push(<div key={`space-${index++}`} className={compact ? 'h-1' : 'h-[0.375rem]'} />);
            continue;
        }
        const heading = /^(#{1,3})\s+(.+)$/.exec(line);
        if (heading) {
            const level = heading[1].length;
            blocks.push(
                <div key={`heading-${index++}`} className={level === 1 ? 'text-2xl font-bold leading-7 text-[#f2f3f5]' : level === 2 ? 'text-xl font-bold leading-6 text-[#f2f3f5]' : 'text-base font-bold leading-[1.375rem] text-[#f2f3f5]'}>
                    {renderInline(heading[2], `heading-${index}`)}
                </div>,
            );
            continue;
        }
        if (line.startsWith('> ')) {
            blocks.push(<div key={`quote-${index++}`} className="my-0.5 flex"><span className="mr-3 w-1 shrink-0 rounded-full bg-[#4e5058]" /><div className="min-w-0">{renderInline(line.slice(2), `quote-${index}`)}</div></div>);
            continue;
        }
        const list = /^(\s*)([-*]|\d+\.)\s+(.+)$/.exec(line);
        if (list) {
            blocks.push(<div key={`list-${index++}`} className="flex pl-3"><span className="mr-2 w-4 shrink-0 text-right">{list[2] === '-' || list[2] === '*' ? '•' : list[2]}</span><span className="min-w-0">{renderInline(list[3], `list-${index}`)}</span></div>);
            continue;
        }
        blocks.push(<div key={`line-${index++}`} className="min-w-0 break-words">{renderInline(line, `line-${index}`)}</div>);
    }

    if (codeFence) {
        blocks.push(<pre key="code-unclosed" className="my-1 max-w-full overflow-x-auto rounded-[4px] border border-[#111214] bg-[#1e1f22] p-2 font-mono text-xs leading-[1.125rem] text-[#b5bac1]"><code>{codeFence.lines.join('\n')}</code></pre>);
    }

    return <div className="min-w-0 whitespace-normal break-words">{blocks}</div>;
}

export function DiscordMessageFrame({ botName = 'Overlord', botAvatar, children }: DiscordMessageFrameProps) {
    return (
        <div className="w-full overflow-hidden rounded-[10px] border border-[#1e1f22] bg-[#313338] text-[#dbdee1]" style={{ fontFamily: DISCORD_FONT }}>
            <div className="group relative flex gap-4 px-4 py-4 transition-colors hover:bg-[#2e3035]">
                <div className="flex h-10 w-10 shrink-0 select-none items-center justify-center overflow-hidden rounded-full bg-[#111214]">
                    <img src={botAvatar || '/logos/logo-white.svg'} alt="" className="h-7 w-7 object-contain" />
                </div>
                <div className="min-w-0 flex-1 pt-px">
                    <div className="flex min-h-[1.375rem] flex-wrap items-baseline gap-x-1.5">
                        <span className="cursor-pointer text-base font-medium leading-[1.375rem] text-[#f2f3f5] hover:underline">{botName}</span>
                        <span className="inline-flex h-[0.9375rem] translate-y-[-1px] items-center rounded-[3px] bg-[#5865f2] px-[0.275rem] text-[0.625rem] font-medium uppercase leading-none text-white">APP</span>
                        <span className="text-xs font-normal leading-[1.375rem] text-[#949ba4]">Today at 12:00 PM</span>
                    </div>
                    {children}
                </div>
            </div>
        </div>
    );
}

export function DiscordLinkButton({ label, emoji, disabled = false, tone = 'secondary', external = true }: { label: string; emoji?: React.ReactNode; disabled?: boolean; tone?: 'primary' | 'secondary' | 'success' | 'danger'; external?: boolean }) {
    const tones = {
        primary: 'bg-[#5865f2] hover:bg-[#4752c4]',
        secondary: 'bg-[#4e5058] hover:bg-[#5d5f66]',
        success: 'bg-[#248046] hover:bg-[#1a6334]',
        danger: 'bg-[#da373c] hover:bg-[#a1282c]',
    };
    return (
        <button type="button" disabled={disabled} className={`inline-flex h-8 max-w-full items-center justify-center gap-2 rounded-[3px] px-4 text-sm font-medium leading-4 text-white transition-colors ${tones[tone]} disabled:cursor-not-allowed disabled:opacity-50`}>
            {emoji}
            <span className="truncate">{label}</span>
            {external && <ArrowSquareOut size={16} weight="bold" className="shrink-0" />}
        </button>
    );
}

function EmbedPreview({ embed, index }: { embed: APIEmbed; index: number }) {
    const timestamp = formatDiscordTimestamp(embed.timestamp);
    const providerHref = safeHref(embed.provider?.url);
    const authorHref = safeHref(embed.author?.url);
    const titleHref = safeHref(embed.url);
    return (
        <div className="mt-1 grid w-fit max-w-full grid-cols-[auto_minmax(0,1fr)] overflow-hidden rounded-[4px] bg-[#2b2d31]" aria-label={`Embed ${index + 1}`}>
            <div className="w-1" style={{ backgroundColor: colorIntToHex(embed.color) }} />
            <div className="grid min-w-0 max-w-[516px] grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-2 px-3 py-3">
                <div className="col-start-1 min-w-0 space-y-2">
                    {embed.provider?.name && <div className="text-xs leading-4 text-[#dbdee1]">{providerHref ? <a href={providerHref} target="_blank" rel="noreferrer" className="hover:underline">{embed.provider.name}</a> : embed.provider.name}</div>}
                    {embed.author?.name && (
                        <div className="flex min-w-0 items-center gap-2 text-sm font-semibold leading-[1.125rem] text-[#f2f3f5]">
                            {embed.author.icon_url && <img src={embed.author.icon_url} alt="" className="h-6 w-6 shrink-0 rounded-full object-cover" />}
                            {authorHref ? <a href={authorHref} target="_blank" rel="noreferrer" className="min-w-0 break-words hover:underline">{embed.author.name}</a> : <span className="min-w-0 break-words">{embed.author.name}</span>}
                        </div>
                    )}
                    {embed.title && (
                        <div className="text-base font-semibold leading-5 text-[#f2f3f5]">
                            {titleHref ? <a href={titleHref} target="_blank" rel="noreferrer" className="text-[#00a8fc] hover:underline"><DiscordMarkdown content={embed.title} compact /></a> : <DiscordMarkdown content={embed.title} compact />}
                        </div>
                    )}
                    {embed.description && <div className="text-sm leading-[1.125rem] text-[#dbdee1]"><DiscordMarkdown content={embed.description} compact /></div>}
                </div>

                {embed.thumbnail?.url && <img src={embed.thumbnail.url} alt="" className="col-start-2 row-start-1 row-end-3 h-20 w-20 shrink-0 rounded-[4px] object-cover" />}

                {embed.fields && embed.fields.length > 0 && (
                    <div className="col-span-2 flex min-w-0 flex-wrap gap-x-2 gap-y-2 pt-0.5">
                        {embed.fields.map((field, fieldIndex) => (
                            <div key={`${field.name}-${fieldIndex}`} className={`${field.inline ? 'min-w-[105px] flex-[1_1_calc(33.333%-0.5rem)]' : 'w-full flex-[1_0_100%]'} min-w-0 text-sm leading-[1.125rem]`}>
                                <div className="mb-0.5 font-semibold text-[#f2f3f5]"><DiscordMarkdown content={field.name} compact /></div>
                                <div className="text-[#dbdee1]"><DiscordMarkdown content={field.value} compact /></div>
                            </div>
                        ))}
                    </div>
                )}

                {embed.image?.url && <img src={embed.image.url} alt="" className="col-span-2 mt-1 max-h-[300px] max-w-full rounded-[4px] object-contain object-left" />}

                {(embed.footer?.text || timestamp) && (
                    <div className="col-span-2 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 pt-0.5 text-xs leading-4 text-[#b5bac1]">
                        {embed.footer?.icon_url && <img src={embed.footer.icon_url} alt="" className="h-5 w-5 shrink-0 rounded-full object-cover" />}
                        <span className="min-w-0 break-words">{embed.footer?.text}</span>
                        {embed.footer?.text && timestamp && <span className="shrink-0">•</span>}
                        {timestamp && <span className="shrink-0">{timestamp}</span>}
                    </div>
                )}
            </div>
        </div>
    );
}

export default function DiscordMessagePreview({ message, botName = 'Overlord', botAvatar, actions }: DiscordMessagePreviewProps) {
    return (
        <DiscordMessageFrame botName={botName} botAvatar={botAvatar}>
            {message.content && <div className="mt-0.5 text-base leading-[1.375rem] text-[#dbdee1]"><DiscordMarkdown content={message.content} /></div>}
            {message.embeds && message.embeds.length > 0 && <div className="mt-1 space-y-1">{message.embeds.map((embed, index) => <EmbedPreview key={index} embed={embed} index={index} />)}</div>}
            {actions && <div className="mt-2 flex flex-wrap gap-2">{actions}</div>}
        </DiscordMessageFrame>
    );
}
