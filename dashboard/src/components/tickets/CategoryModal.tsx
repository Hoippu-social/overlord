'use client';

import React, { useState, useEffect } from 'react';
import {
    Modal,
    ModalContent,
    Switch,
    Tabs,
    Tab,
} from '@nextui-org/react';
import {
    FloppyDisk,
    TextT,
    MapTrifold,
    ChatCircle,
    Gear,
    Users,
    XCircle,
    Archive,
    X,
    Plus,
    Trash,
    Palette,
    Article
} from '@phosphor-icons/react';
import DiscordMessagePreview, { MessagePayload } from './DiscordMessagePreview';
import { Popover, PopoverTrigger, PopoverContent } from '@nextui-org/react';

// Color picker helper
const PRESET_COLORS = [
    5793266, // Blurple
    15548997, // Red
    5763719, // Green
    16776960, // Yellow
    15105570, // Orange
    3447003, // Blue
    10181046, // Purple
    16777215, // White
    9807270, // Gray
];

function ColorPicker({ color, onChange }: { color: number, onChange: (c: number) => void }) {
    const hexColor = '#' + color.toString(16).padStart(6, '0');
    return (
        <Popover placement="bottom-start">
            <PopoverTrigger>
                <div
                    className="w-full h-10 rounded-xl cursor-copy border border-[var(--border-subtle)] flex items-center justify-between px-3 hover:border-white/20 transition-all active:scale-95"
                    style={{ backgroundColor: hexColor }}
                    role="button"
                >
                    <span className="font-mono text-[10px] font-bold mix-blend-difference text-white opacity-90">{hexColor.toUpperCase()}</span>
                    <Palette size={14} className="mix-blend-difference text-white opacity-80" />
                </div>
            </PopoverTrigger>
            <PopoverContent className="bg-[var(--surface-modal)] border border-[var(--border-subtle)] p-4 w-72 shadow-2xl rounded-[24px]">
                <div className="space-y-4">
                    <div className="space-y-2">
                        <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Presets</span>
                        <div className="grid grid-cols-5 gap-2">
                            {PRESET_COLORS.map((c) => (
                                <button
                                    key={c}
                                    className="w-10 h-10 rounded-full border border-white/5 hover:border-white/40 hover:scale-110 transition-all shadow-md"
                                    style={{ backgroundColor: '#' + c.toString(16).padStart(6, '0') }}
                                    onClick={() => onChange(c)}
                                />
                            ))}
                        </div>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
}

type ChannelOption = {
    id: string;
    name?: string;
    type?: number | string;
};

export type CategoryData = {
    id?: number;
    name: string;
    channelId: string | null;

    // Settings
    saveHistory: boolean;
    mentionAgents: boolean;
    allowUserClose: boolean;
    enableRating: boolean;

    // Message
    messagePayload: string | MessagePayload; // JSON or Object

    // Components
    buttonText: string;
    buttonEmoji?: string | null;
    buttonStyle: string;
};

interface CategoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    category?: CategoryData | null;
    onSave: (data: Partial<CategoryData>) => Promise<void>;
    channels: ChannelOption[];
    saving: boolean;
}

const defaultPayload: MessagePayload = {
    content: "",
    embeds: [{
        title: "Create Ticket",
        description: "Click the button below to create a ticket.",
        color: 5793266
    }]
};

export default function CategoryModal({ isOpen, onClose, category, onSave, channels, saving }: CategoryModalProps) {
    const [formData, setFormData] = useState<Partial<CategoryData>>({
        name: '',
        channelId: '',
        saveHistory: true,
        mentionAgents: true,
        allowUserClose: true,
        enableRating: true,
        messagePayload: defaultPayload
    });

    useEffect(() => {
        if (isOpen) {
            if (category) {
                // Parse payload if string
                let parsedPayload = defaultPayload;
                try {
                    if (typeof category.messagePayload === 'string') {
                        parsedPayload = JSON.parse(category.messagePayload);
                    } else if (category.messagePayload) {
                        parsedPayload = category.messagePayload as MessagePayload;
                    }
                } catch (e) {
                    console.error("Failed to parse message payload", e);
                }

                setFormData({
                    ...category,
                    messagePayload: parsedPayload
                });
            } else {
                // Reset for new creation
                setFormData({
                    name: '',
                    channelId: '',
                    saveHistory: true,
                    mentionAgents: true,
                    allowUserClose: true,
                    enableRating: true,
                    messagePayload: defaultPayload
                });
            }
        }
    }, [isOpen, category]);

    const handleSave = () => {
        const payloadToSave = {
            ...formData,
            messagePayload: JSON.stringify(formData.messagePayload)
        };
        onSave(payloadToSave);
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            size="4xl"
            scrollBehavior="inside"
            hideCloseButton
            classNames={{
                base: "bg-[var(--surface-modal)] border border-[var(--border-subtle)] shadow-2xl rounded-[32px] overflow-hidden m-4",
                backdrop: "bg-[#000]/60 backdrop-blur-sm"
            }}
        >
            <ModalContent>
                <div className="flex flex-col h-full max-h-[85vh]">
                    {/* Header */}
                    <div className="flex items-center justify-between p-6 border-b border-[var(--border-divider)] shrink-0 bg-[var(--surface-hover)]">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-[#3b82f6]/10 text-[#3b82f6] flex items-center justify-center border border-[#3b82f6]/20">
                                <Article size={20} weight="duotone" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-white leading-tight">
                                    {category ? `Edit Category: ${category.name}` : "Create New Category"}
                                </h2>
                                <p className="text-[11px] font-medium text-[var(--text-muted)] mt-0.5">Configure ticket routing and visual appearance.</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="w-8 h-8 rounded-full bg-[var(--surface-card)] hover:bg-[var(--border-divider)] text-[var(--text-muted)] flex items-center justify-center transition-colors border border-[var(--border-subtle)]"
                        >
                            <X size={14} weight="bold" />
                        </button>
                    </div>

                    {/* Body */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-[var(--surface-modal)]">
                        <Tabs
                            aria-label="Category Options"
                            color="primary"
                            variant="light"
                            classNames={{
                                tabList: "gap-6 w-full relative rounded-none p-0 border-b border-[var(--border-divider)] mb-8",
                                cursor: "w-full bg-transparent border-b-2 border-[#3b82f6] rounded-none",
                                tab: "max-w-fit px-2 h-10",
                                tabContent: "text-sm font-bold text-[var(--text-muted)] group-data-[selected=true]:text-[#3b82f6] transition-colors"
                            }}
                        >
                            {/* GENERAL SETTINGS */}
                            <Tab
                                key="general"
                                title={
                                    <div className="flex items-center gap-2">
                                        <Gear size={16} weight="duotone" />
                                        <span>General & Routing</span>
                                    </div>
                                }
                            >
                                <div className="space-y-8 animate-fade-in max-w-3xl">
                                    <div className="space-y-4">
                                        <h3 className="text-xs font-bold text-white/50 uppercase tracking-widest flex items-center gap-2">
                                            <TextT size={14} /> Basic Details
                                        </h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="space-y-2">
                                                <label className="text-xs font-bold text-[var(--text-secondary)] pl-1">Category Name</label>
                                                <input
                                                    type="text"
                                                    placeholder="e.g. Technical Support"
                                                    value={formData.name || ''}
                                                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                                    className="w-full bg-[var(--surface-card)] border border-[var(--border-subtle)] focus:border-[#3b82f6] rounded-xl h-11 px-4 text-sm text-white placeholder-[var(--text-muted)] outline-none transition-colors"
                                                    autoFocus
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-xs font-bold text-[var(--text-secondary)] pl-1">Discord Channel / Category ID</label>
                                                <div className="relative">
                                                    <MapTrifold className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={16} />
                                                    <select
                                                        value={formData.channelId || ''}
                                                        onChange={(e) => setFormData(prev => ({ ...prev, channelId: e.target.value }))}
                                                        className="w-full bg-[var(--surface-card)] border border-[var(--border-subtle)] focus:border-[#3b82f6] rounded-xl h-11 pl-10 pr-4 text-sm text-white outline-none transition-colors appearance-none cursor-pointer"
                                                    >
                                                        <option value="" disabled className="bg-[#111]">Select routing destination...</option>
                                                        {channels.map(c => <option key={c.id} value={c.id} className="bg-[#111]">#{c.name || c.id}</option>)}
                                                    </select>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="w-full h-px bg-[var(--border-divider)]" />

                                    <div className="space-y-4">
                                        <h3 className="text-xs font-bold text-white/50 uppercase tracking-widest flex items-center gap-2">
                                            <Gear size={14} /> Automation & Behavior
                                        </h3>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="flex justify-between items-center bg-[var(--surface-card)] border border-[var(--border-subtle)] p-4 rounded-2xl group hover:border-[#3b82f6]/30 transition-colors">
                                                <div className="flex gap-4 items-center pl-1">
                                                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-500 border border-blue-500/20 flex items-center justify-center shrink-0">
                                                        <Archive size={20} weight="duotone" />
                                                    </div>
                                                    <div>
                                                        <div className="text-sm font-bold text-white mb-0.5">Save Transcripts</div>
                                                        <div className="text-[10px] font-medium text-[var(--text-muted)]">Store chat history on close.</div>
                                                    </div>
                                                </div>
                                                <Switch
                                                    isSelected={formData.saveHistory}
                                                    onValueChange={(v) => setFormData(prev => ({ ...prev, saveHistory: v }))}
                                                    size="sm"
                                                    classNames={{ wrapper: "bg-[var(--surface-hover)] group-hover:bg-[#3b82f6]/20" }}
                                                />
                                            </div>

                                            <div className="flex justify-between items-center bg-[var(--surface-card)] border border-[var(--border-subtle)] p-4 rounded-2xl group hover:border-[#3b82f6]/30 transition-colors">
                                                <div className="flex gap-4 items-center pl-1">
                                                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center justify-center shrink-0">
                                                        <Users size={20} weight="duotone" />
                                                    </div>
                                                    <div>
                                                        <div className="text-sm font-bold text-white mb-0.5">Mention Agents</div>
                                                        <div className="text-[10px] font-medium text-[var(--text-muted)]">Ping support team on creation.</div>
                                                    </div>
                                                </div>
                                                <Switch
                                                    isSelected={formData.mentionAgents}
                                                    onValueChange={(v) => setFormData(prev => ({ ...prev, mentionAgents: v }))}
                                                    color="warning"
                                                    size="sm"
                                                    classNames={{ wrapper: "bg-[var(--surface-hover)] group-hover:bg-amber-500/20" }}
                                                />
                                            </div>

                                            <div className="flex justify-between items-center bg-[var(--surface-card)] border border-[var(--border-subtle)] p-4 rounded-2xl group hover:border-[#3b82f6]/30 transition-colors">
                                                <div className="flex gap-4 items-center pl-1">
                                                    <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-500 border border-rose-500/20 flex items-center justify-center shrink-0">
                                                        <XCircle size={20} weight="duotone" />
                                                    </div>
                                                    <div>
                                                        <div className="text-sm font-bold text-white mb-0.5">Allow User Close</div>
                                                        <div className="text-[10px] font-medium text-[var(--text-muted)]">Creator can close their ticket.</div>
                                                    </div>
                                                </div>
                                                <Switch
                                                    isSelected={formData.allowUserClose}
                                                    onValueChange={(v) => setFormData(prev => ({ ...prev, allowUserClose: v }))}
                                                    color="danger"
                                                    size="sm"
                                                    classNames={{ wrapper: "bg-[var(--surface-hover)] group-hover:bg-rose-500/20" }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </Tab>

                            {/* MESSAGE SETTINGS */}
                            <Tab
                                key="message"
                                title={
                                    <div className="flex items-center gap-2">
                                        <ChatCircle size={16} weight="duotone" />
                                        <span>Dispatcher Content</span>
                                    </div>
                                }
                            >
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-full animate-fade-in relative items-start">
                                    <div className="space-y-6 lg:max-h-[500px] lg:overflow-y-auto pr-2 custom-scrollbar">
                                        {/* Message Content */}
                                        <div className="bg-[var(--surface-card)] rounded-[24px] border border-[var(--border-subtle)] p-5 space-y-4 shadow-sm">
                                            <h3 className="text-white font-bold text-[10px] uppercase tracking-widest text-[var(--text-muted)] flex items-center gap-2">
                                                <TextT size={14} /> Normal Message Content
                                            </h3>
                                            <textarea
                                                placeholder="Standard message text (above the embed)..."
                                                value={(formData.messagePayload as MessagePayload)?.content || ''}
                                                onChange={(e) => {
                                                    setFormData(prev => ({
                                                        ...prev,
                                                        messagePayload: {
                                                            ...(prev.messagePayload as MessagePayload),
                                                            content: e.target.value
                                                        }
                                                    }));
                                                }}
                                                rows={2}
                                                className="w-full bg-[var(--surface-hover)] border border-[var(--border-divider)] focus:border-[#3b82f6] rounded-xl p-3 text-sm text-white placeholder-[var(--text-muted)] outline-none transition-colors resize-y min-h-[80px]"
                                            />
                                        </div>

                                        {/* Embeds */}
                                        {((formData.messagePayload as MessagePayload)?.embeds || []).map((embed, index) => (
                                            <div key={index} className="bg-[var(--surface-card)] rounded-[24px] border border-[var(--border-subtle)] p-5 space-y-5 shadow-sm relative group">
                                                <div className="flex justify-between items-center mb-2">
                                                    <h3 className="text-white font-bold text-[10px] uppercase tracking-widest text-[var(--text-muted)]">Embed Block {index + 1}</h3>
                                                    <button
                                                        onClick={() => {
                                                            const newEmbeds = [...((formData.messagePayload as MessagePayload)?.embeds || [])];
                                                            newEmbeds.splice(index, 1);
                                                            setFormData(prev => ({
                                                                ...prev,
                                                                messagePayload: {
                                                                    ...(prev.messagePayload as MessagePayload),
                                                                    embeds: newEmbeds
                                                                }
                                                            }));
                                                        }}
                                                        className="w-7 h-7 rounded-full text-[var(--text-muted)] hover:bg-rose-500/10 hover:text-rose-500 flex items-center justify-center transition-colors border border-transparent hover:border-rose-500/20"
                                                    >
                                                        <Trash size={14} weight="bold" />
                                                    </button>
                                                </div>

                                                <div className="flex flex-col sm:flex-row gap-5">
                                                    <div className="w-full sm:w-16 shrink-0 space-y-1.5 border-b sm:border-b-0 sm:border-r border-[var(--border-divider)] pb-4 sm:pb-0 sm:pr-4">
                                                        <label className="text-[10px] font-bold text-[var(--text-secondary)]">Accent</label>
                                                        <ColorPicker
                                                            color={embed.color || 0}
                                                            onChange={(c) => {
                                                                const newEmbeds = [...((formData.messagePayload as MessagePayload)?.embeds || [])];
                                                                newEmbeds[index].color = c;
                                                                setFormData(prev => ({
                                                                    ...prev,
                                                                    messagePayload: {
                                                                        ...(prev.messagePayload as MessagePayload),
                                                                        embeds: newEmbeds
                                                                    }
                                                                }));
                                                            }}
                                                        />
                                                    </div>
                                                    <div className="flex-1 space-y-4">
                                                        <div className="space-y-1.5">
                                                            <label className="text-xs font-bold text-[var(--text-secondary)] pl-1">Title</label>
                                                            <input
                                                                type="text"
                                                                placeholder="Embed Title"
                                                                value={embed.title || ''}
                                                                onChange={(e) => {
                                                                    const newEmbeds = [...((formData.messagePayload as MessagePayload)?.embeds || [])];
                                                                    newEmbeds[index].title = e.target.value;
                                                                    setFormData(prev => ({
                                                                        ...prev,
                                                                        messagePayload: {
                                                                            ...(prev.messagePayload as MessagePayload),
                                                                            embeds: newEmbeds
                                                                        }
                                                                    }));
                                                                }}
                                                                className="w-full bg-[var(--surface-hover)] border border-[var(--border-divider)] focus:border-[#3b82f6] rounded-xl h-10 px-3 text-sm text-white placeholder-[var(--text-muted)] outline-none transition-colors font-bold"
                                                            />
                                                        </div>
                                                        <div className="space-y-1.5">
                                                            <label className="text-xs font-bold text-[var(--text-secondary)] pl-1">Description</label>
                                                            <textarea
                                                                placeholder="Embed Description"
                                                                value={embed.description || ''}
                                                                onChange={(e) => {
                                                                    const newEmbeds = [...((formData.messagePayload as MessagePayload)?.embeds || [])];
                                                                    newEmbeds[index].description = e.target.value;
                                                                    setFormData(prev => ({
                                                                        ...prev,
                                                                        messagePayload: {
                                                                            ...(prev.messagePayload as MessagePayload),
                                                                            embeds: newEmbeds
                                                                        }
                                                                    }));
                                                                }}
                                                                rows={3}
                                                                className="w-full bg-[var(--surface-hover)] border border-[var(--border-divider)] focus:border-[#3b82f6] rounded-xl p-3 text-sm text-white placeholder-[var(--text-muted)] outline-none transition-colors resize-y min-h-[80px]"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Advanced Expandable Section placeholder (could be added later for authors/images/footers) */}
                                                <div className="space-y-3 pt-3 border-t border-[var(--border-divider)]">
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div className="space-y-1.5">
                                                            <label className="text-[10px] font-bold text-[var(--text-secondary)] pl-1 uppercase tracking-wider">Image URL</label>
                                                            <input
                                                                type="text"
                                                                placeholder="https://..."
                                                                value={embed.image?.url || ''}
                                                                onChange={(e) => {
                                                                    const newEmbeds = [...((formData.messagePayload as MessagePayload)?.embeds || [])];
                                                                    newEmbeds[index].image = e.target.value ? { url: e.target.value } : undefined;
                                                                    setFormData(prev => ({
                                                                        ...prev,
                                                                        messagePayload: {
                                                                            ...(prev.messagePayload as MessagePayload),
                                                                            embeds: newEmbeds
                                                                        }
                                                                    }));
                                                                }}
                                                                className="w-full bg-[var(--surface-hover)] border border-[var(--border-divider)] focus:border-[#3b82f6] rounded-xl h-9 px-3 text-xs text-white placeholder-[var(--text-muted)] outline-none transition-colors"
                                                            />
                                                        </div>
                                                        <div className="space-y-1.5">
                                                            <label className="text-[10px] font-bold text-[var(--text-secondary)] pl-1 uppercase tracking-wider">Thumbnail URL</label>
                                                            <input
                                                                type="text"
                                                                placeholder="https://..."
                                                                value={embed.thumbnail?.url || ''}
                                                                onChange={(e) => {
                                                                    const newEmbeds = [...((formData.messagePayload as MessagePayload)?.embeds || [])];
                                                                    newEmbeds[index].thumbnail = e.target.value ? { url: e.target.value } : undefined;
                                                                    setFormData(prev => ({
                                                                        ...prev,
                                                                        messagePayload: {
                                                                            ...(prev.messagePayload as MessagePayload),
                                                                            embeds: newEmbeds
                                                                        }
                                                                    }));
                                                                }}
                                                                className="w-full bg-[var(--surface-hover)] border border-[var(--border-divider)] focus:border-[#3b82f6] rounded-xl h-9 px-3 text-xs text-white placeholder-[var(--text-muted)] outline-none transition-colors"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}

                                        <button
                                            onClick={() => {
                                                const newEmbeds = [...((formData.messagePayload as MessagePayload)?.embeds || [])];
                                                newEmbeds.push({
                                                    title: "New Embed Block",
                                                    description: "Describe the routing logic here.",
                                                    color: 5793266
                                                });
                                                setFormData(prev => ({
                                                    ...prev,
                                                    messagePayload: {
                                                        ...(prev.messagePayload as MessagePayload),
                                                        embeds: newEmbeds
                                                    }
                                                }));
                                            }}
                                            className="w-full h-12 rounded-[16px] border border-dashed border-[#3b82f6]/30 bg-[#3b82f6]/5 hover:bg-[#3b82f6]/10 text-[#3b82f6] font-bold flex items-center justify-center gap-2 transition-colors text-sm"
                                        >
                                            <Plus weight="bold" /> Append Embed
                                        </button>
                                    </div>

                                    <div className="space-y-4 lg:sticky lg:top-0">
                                        <h3 className="text-white font-bold text-[10px] uppercase tracking-widest text-[var(--text-muted)] flex items-center gap-2">
                                            <Palette size={14} /> Desktop Preview
                                        </h3>
                                        <div className="border border-[var(--border-subtle)] rounded-[24px] overflow-hidden bg-[#313338] shadow-lg">
                                            <DiscordMessagePreview
                                                message={formData.messagePayload as MessagePayload}
                                                botName="Dispatcher Agent"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </Tab>
                        </Tabs>
                    </div>

                    {/* Footer */}
                    <div className="p-6 border-t border-[var(--border-divider)] shrink-0 flex items-center justify-end gap-3 bg-[var(--surface-modal)] relative z-10">
                        <button
                            onClick={onClose}
                            className="h-11 px-6 rounded-xl font-bold text-sm text-[var(--text-secondary)] hover:text-white bg-transparent hover:bg-[var(--surface-hover)] transition-colors border border-transparent"
                            disabled={saving}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="h-11 px-6 rounded-xl font-bold text-sm text-white bg-[#3b82f6] hover:bg-[#2563eb] transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {saving ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <FloppyDisk size={18} weight="bold" />
                            )}
                            Save Configuration
                        </button>
                    </div>
                </div>
            </ModalContent>
        </Modal>
    );
}
