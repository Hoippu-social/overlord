'use client';

import React from 'react';
import {
    COMPONENTS_V2_FLAG,
    parseTicketPanelMessageDesign,
    type APIEmbed,
    type TicketButtonStyle,
    type TicketPanelLegacySource,
    type TicketPanelMessageDesign,
    type V2ActionRow,
    type V2Container,
    type V2LinkButton,
    type V2MediaGallery,
    type V2Section,
    type V2Separator,
    type V2TextDisplay,
    type V2TopLevelComponent,
} from '@/lib/tickets/messageDesign';
import DiscordMessagePreview, { DiscordLinkButton, DiscordMarkdown, DiscordMessageFrame } from './DiscordMessagePreview';
import { CaretDown, Question } from '@phosphor-icons/react';
import type { TicketEntryPoint, TicketGhostReply } from '@/lib/tickets/types';

type Props = { designJson?: string | null; legacy: TicketPanelLegacySource; botName?: string; entryPoints?: TicketEntryPoint[]; ghostReplies?: TicketGhostReply[] };

function emojiContent(emoji: V2LinkButton['emoji'] | string | null | undefined) {
    if (!emoji) return undefined;
    if (typeof emoji === 'string') return emoji;
    if (emoji.id) return <img src={`https://cdn.discordapp.com/emojis/${emoji.id}.${emoji.animated ? 'gif' : 'webp'}?size=32&quality=lossless`} alt={emoji.name ? `:${emoji.name}:` : ''} className="h-4 w-4 object-contain" />;
    return emoji.name || undefined;
}

function V2Text({ component }: { component: V2TextDisplay }) {
    return <div className="text-base leading-[1.375rem] text-[#dbdee1]"><DiscordMarkdown content={component.content} /></div>;
}

function V2Button({ component }: { component: V2LinkButton }) {
    return <DiscordLinkButton label={component.label || 'Open link'} emoji={emojiContent(component.emoji)} disabled={component.disabled} />;
}

function V2ActionRowPreview({ component }: { component: V2ActionRow }) {
    return <div className="flex flex-wrap gap-2">{component.components.map((button, index) => <V2Button key={button.id ?? index} component={button} />)}</div>;
}

function V2SeparatorPreview({ component }: { component: V2Separator }) {
    const spacing = component.spacing === 2 ? 'my-3' : 'my-2';
    return component.divider === false ? <div className={component.spacing === 2 ? 'h-3' : 'h-2'} /> : <div className={`${spacing} border-t border-[#3f4147]`} />;
}

function V2MediaGalleryPreview({ component }: { component: V2MediaGallery }) {
    const items = component.items.slice(0, 4);
    return (
        <div className={`grid max-w-[516px] gap-1 overflow-hidden rounded-[4px] ${items.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {items.map((item, index) => {
                const layout = items.length === 1 ? 'aspect-[16/9]' : items.length === 2 ? 'aspect-square' : items.length === 3 && index === 0 ? 'row-span-2 min-h-[244px]' : items.length === 3 ? 'aspect-[4/3] min-h-0' : 'aspect-[4/3]';
                return (
                    <div key={`${item.media.url}-${index}`} className={`relative overflow-hidden bg-[#1e1f22] ${layout}`} title={item.description}>
                        <img src={item.media.url} alt={item.description || ''} className={`h-full w-full object-cover ${item.spoiler ? 'blur-xl' : ''}`} />
                        {item.spoiler && <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded bg-black/70 px-2 py-1 text-xs font-semibold text-white">SPOILER</span>}
                    </div>
                );
            })}
        </div>
    );
}

function V2SectionPreview({ component }: { component: V2Section }) {
    const thumbnail = component.accessory?.type === 11 ? component.accessory : null;
    const button = component.accessory?.type === 2 ? component.accessory : null;
    return (
        <div className={`${button ? 'flex flex-col items-start sm:grid sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center' : 'grid grid-cols-[minmax(0,1fr)_auto] items-center'} min-w-0 gap-3`}>
            <div className="min-w-0 space-y-1">{component.components.map((text, index) => <V2Text key={text.id ?? index} component={text} />)}</div>
            {button && <div className="shrink-0"><V2Button component={button} /></div>}
            {thumbnail && <div className="relative h-[85px] w-[85px] shrink-0 overflow-hidden rounded-[4px] bg-[#1e1f22]" title={thumbnail.description}><img src={thumbnail.media.url} alt={thumbnail.description || ''} className={`h-full w-full object-cover ${thumbnail.spoiler ? 'blur-xl' : ''}`} /></div>}
        </div>
    );
}

function renderV2Component(component: V2TopLevelComponent | V2Container['components'][number], index: number): React.ReactNode {
    if (component.type === 10) return <V2Text key={component.id ?? index} component={component} />;
    if (component.type === 1) return <V2ActionRowPreview key={component.id ?? index} component={component} />;
    if (component.type === 9) return <V2SectionPreview key={component.id ?? index} component={component} />;
    if (component.type === 12) return <V2MediaGalleryPreview key={component.id ?? index} component={component} />;
    if (component.type === 14) return <V2SeparatorPreview key={component.id ?? index} component={component} />;
    if (component.type === 17) {
        const accent = typeof component.accent_color === 'number' ? `#${component.accent_color.toString(16).padStart(6, '0')}` : '#1e1f22';
        return <div key={component.id ?? index} className={`grid max-w-[580px] grid-cols-[4px_minmax(0,1fr)] overflow-hidden rounded-[8px] bg-[#2b2d31] ${component.spoiler ? 'select-none' : ''}`}><div style={{ backgroundColor: accent }} /><div className={`min-w-0 space-y-2 border border-l-0 border-[#3f4147] px-3 py-3 ${component.spoiler ? 'blur-md' : ''}`}>{component.components.map(renderV2Component)}</div></div>;
    }
    return null;
}

function openerTone(style: TicketButtonStyle): 'primary' | 'secondary' | 'success' | 'danger' {
    if (style === 'SECONDARY') return 'secondary';
    if (style === 'SUCCESS') return 'success';
    if (style === 'DANGER') return 'danger';
    return 'primary';
}

function DiscordFlowControls({ entries = [], replies = [] }: { entries?: TicketEntryPoint[]; replies?: TicketGhostReply[] }) {
    const buttons = entries.filter((entry) => entry.presentation === 'button' || entry.presentation === 'both').slice(0, 5);
    const selectEntries = entries.filter((entry) => entry.presentation === 'select' || entry.presentation === 'both').slice(0, 25);
    return (
        <div className="mt-2 max-w-[516px] space-y-2">
            {buttons.length > 0 && <div className="flex flex-wrap gap-2">{buttons.map((entry) => <DiscordLinkButton key={entry.id} label={entry.label} emoji={entry.emoji || undefined} tone={openerTone(entry.style)} external={false} />)}</div>}
            {selectEntries.length > 0 && <div className="flex h-10 items-center rounded-[4px] border border-[#1e1f22] bg-[#2b2d31] px-3 text-sm text-[#b5bac1]"><span className="min-w-0 flex-1 truncate">Select a ticket topic…</span><CaretDown size={16} /></div>}
            {replies.length > 0 && <div className="flex h-10 items-center rounded-[4px] border border-[#1e1f22] bg-[#2b2d31] px-3 text-sm text-[#b5bac1]"><Question size={15} className="mr-2 text-[#c4b5fd]" /><span className="min-w-0 flex-1 truncate">Quick answers · visible only to you</span><CaretDown size={16} /></div>}
        </div>
    );
}

function ClassicPreview({ design, botName, entryPoints, ghostReplies }: { design: Extract<TicketPanelMessageDesign, { mode: 'classic_embed' }>; botName: string; entryPoints?: TicketEntryPoint[]; ghostReplies?: TicketGhostReply[] }) {
    const hasFlow = Boolean(entryPoints?.length || ghostReplies?.length);
    return <DiscordMessagePreview botName={botName} message={{ content: design.content, embeds: design.embeds as APIEmbed[] }} actions={hasFlow ? <DiscordFlowControls entries={entryPoints} replies={ghostReplies} /> : <DiscordLinkButton label={design.opener.label || 'Create Ticket'} emoji={emojiContent(design.opener.emoji)} tone={openerTone(design.opener.style)} external={false} />} />;
}

function ComponentsV2Preview({ design, botName, entryPoints, ghostReplies }: { design: Extract<TicketPanelMessageDesign, { mode: 'components_v2' }>; botName: string; entryPoints?: TicketEntryPoint[]; ghostReplies?: TicketGhostReply[] }) {
    const hasFlow = Boolean(entryPoints?.length || ghostReplies?.length);
    return (
        <DiscordMessageFrame botName={botName}>
            <div className="mt-1 max-w-full space-y-2">
                {design.components.map(renderV2Component)}
                {hasFlow ? <DiscordFlowControls entries={entryPoints} replies={ghostReplies} /> : <div className="flex flex-wrap gap-2 pt-0.5"><DiscordLinkButton label={design.opener.label || 'Create Ticket'} emoji={emojiContent(design.opener.emoji)} tone={openerTone(design.opener.style)} external={false} /></div>}
            </div>
        </DiscordMessageFrame>
    );
}

export function TicketPanelDesignPreview({ designJson, legacy, botName = 'Dispatcher Agent', entryPoints, ghostReplies }: Props) {
    const design = parseTicketPanelMessageDesign(designJson, legacy);
    if (design.mode === 'components_v2' && design.flags === COMPONENTS_V2_FLAG) return <ComponentsV2Preview design={design} botName={botName} entryPoints={entryPoints} ghostReplies={ghostReplies} />;
    return <ClassicPreview design={design as Extract<TicketPanelMessageDesign, { mode: 'classic_embed' }>} botName={botName} entryPoints={entryPoints} ghostReplies={ghostReplies} />;
}
