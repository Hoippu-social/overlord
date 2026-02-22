'use client';

import React, { useState, useEffect } from 'react';
import {
    Modal,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalFooter,
    Button,
    Input,
    Select,
    SelectItem,
    Switch,
    Tabs,
    Tab,
    Divider,
    Textarea
} from '@nextui-org/react';
import {
    FloppyDisk,
    TextT,
    MapTrifold,
    ChatCircle,
    Gear,
    Users,
    XCircle,
    Archive
} from '@phosphor-icons/react';
import DiscordMessagePreview, { MessagePayload } from './DiscordMessagePreview';
import {
    Plus,
    Trash,
    Palette
} from '@phosphor-icons/react';
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
                    className="w-full h-12 rounded-xl cursor-copy border-2 border-white/5 flex items-center justify-between px-3 hover:border-white/20 transition-all active:scale-95"
                    style={{ backgroundColor: hexColor }}
                    role="button"
                >
                    <span className="font-mono text-xs font-bold mix-blend-difference text-white opacity-90">{hexColor.toUpperCase()}</span>
                    <Palette size={18} className="mix-blend-difference text-white opacity-80" />
                </div>
            </PopoverTrigger>
            <PopoverContent className="bg-[#1e2028] border border-white/10 p-4 w-72 shadow-2xl rounded-2xl">
                <div className="space-y-4">
                    <div className="space-y-2">
                        <span className="text-tiny font-bold text-default-500 uppercase tracking-wider">Presets</span>
                        <div className="grid grid-cols-5 gap-2">
                            {PRESET_COLORS.map((c) => (
                                <button
                                    key={c}
                                    className="w-10 h-10 rounded-full border-2 border-white/5 hover:border-white/40 hover:scale-110 transition-all shadow-lg"
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
        // Stringify payload before saving if API expects string
        // But our local types might differ from API. Let's assume onSave handles it or we pass object.
        // Actually the API route expects JSON body, so passing object is fine, JSON.stringify happens in fetch.
        // But we need to make sure messagePayload is sent as STRING if the Prisma schema expects string?
        // No, Prisma expects string, so we should stringify it here or in parent.
        // Let's pass the object and let the parent handle serialization if needed, or serialize here.
        // Creating category with string payload:
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
            classNames={{
                base: "bg-[#181A20] border border-white/5",
                header: "border-b border-white/5",
                footer: "border-t border-white/5"
            }}
        >
            <ModalContent>
                <ModalHeader className="flex flex-col gap-1">
                    <h2 className="text-xl font-bold text-white">
                        {category ? `Edit Category: ${category.name}` : "Create New Category"}
                    </h2>
                    <p className="text-sm text-default-500">Configure ticket settings and appearance.</p>
                </ModalHeader>
                <ModalBody className="p-6">
                    <Tabs
                        aria-label="Category Options"
                        color="primary"
                        variant="underlined"
                        classNames={{
                            tabList: "gap-6 w-full relative rounded-none p-0 border-b border-white/5",
                            cursor: "w-full bg-primary",
                            tab: "max-w-fit px-0 h-12",
                            tabContent: "group-data-[selected=true]:text-primary"
                        }}
                    >
                        {/* GENERAL SETTINGS */}
                        <Tab
                            key="general"
                            title={
                                <div className="flex items-center space-x-2">
                                    <Gear />
                                    <span>General</span>
                                </div>
                            }
                        >
                            <div className="space-y-6 pt-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <Input
                                        autoFocus
                                        label="Category Name"
                                        placeholder="e.g. Technical Support"
                                        variant="bordered"
                                        value={formData.name}
                                        onValueChange={(v) => setFormData(prev => ({ ...prev, name: v }))}
                                        startContent={<TextT className="text-default-400" />}
                                    />
                                    <Select
                                        label="Discord Channel"
                                        placeholder="Select a category/channel"
                                        variant="bordered"
                                        selectedKeys={formData.channelId ? [formData.channelId] : []}
                                        onSelectionChange={(keys) => setFormData(prev => ({ ...prev, channelId: Array.from(keys)[0] as string }))}
                                        startContent={<MapTrifold className="text-default-400" />}
                                        items={channels}
                                    >
                                        {(item) => <SelectItem key={item.id} textValue={item.name}>{item.name}</SelectItem>}
                                    </Select>
                                </div>

                                <Divider className="my-4 bg-white/5" />

                                <div className="space-y-4">
                                    <h3 className="text-lg font-semibold text-white">Automation & Behavior</h3>

                                    <div className="flex justify-between items-center bg-white/5 p-4 rounded-xl">
                                        <div className="flex gap-3 items-center">
                                            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500"><Archive size={20} /></div>
                                            <div>
                                                <div className="text-white font-medium">Save Transcripts</div>
                                                <div className="text-tiny text-default-500">Automatically save conversation history upon closure.</div>
                                            </div>
                                        </div>
                                        <Switch
                                            isSelected={formData.saveHistory}
                                            onValueChange={(v) => setFormData(prev => ({ ...prev, saveHistory: v }))}
                                        />
                                    </div>

                                    <div className="flex justify-between items-center bg-white/5 p-4 rounded-xl">
                                        <div className="flex gap-3 items-center">
                                            <div className="p-2 rounded-lg bg-green-500/10 text-green-500"><Users size={20} /></div>
                                            <div>
                                                <div className="text-white font-medium">Mention Agents</div>
                                                <div className="text-tiny text-default-500">Ping support staff when ticket is opened.</div>
                                            </div>
                                        </div>
                                        <Switch
                                            isSelected={formData.mentionAgents}
                                            onValueChange={(v) => setFormData(prev => ({ ...prev, mentionAgents: v }))}
                                        />
                                    </div>

                                    <div className="flex justify-between items-center bg-white/5 p-4 rounded-xl">
                                        <div className="flex gap-3 items-center">
                                            <div className="p-2 rounded-lg bg-red-500/10 text-red-500"><XCircle size={20} /></div>
                                            <div>
                                                <div className="text-white font-medium">User Can Close</div>
                                                <div className="text-tiny text-default-500">Allow users to close their own tickets.</div>
                                            </div>
                                        </div>
                                        <Switch
                                            isSelected={formData.allowUserClose}
                                            onValueChange={(v) => setFormData(prev => ({ ...prev, allowUserClose: v }))}
                                        />
                                    </div>
                                </div>
                            </div>
                        </Tab>

                        {/* MESSAGE SETTINGS */}
                        <Tab
                            key="message"
                            title={
                                <div className="flex items-center space-x-2">
                                    <ChatCircle />
                                    <span>Message</span>
                                </div>
                            }
                        >
                            <div className="pt-4 grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
                                <div className="space-y-6 overflow-y-auto max-h-[600px] pr-2 custom-scrollbar">
                                    {/* Message Content */}
                                    <div className="bg-[#181A20] rounded-xl border border-white/5 p-4 space-y-3">
                                        <h3 className="text-white font-bold text-sm uppercase tracking-wider text-default-500">Message Content</h3>
                                        <Textarea
                                            placeholder="Standard message text (above the embed)..."
                                            value={(formData.messagePayload as MessagePayload)?.content || ''}
                                            onValueChange={(v) => {
                                                setFormData(prev => ({
                                                    ...prev,
                                                    messagePayload: {
                                                        ...(prev.messagePayload as MessagePayload),
                                                        content: v
                                                    }
                                                }));
                                            }}
                                            minRows={2}
                                            variant="bordered"
                                            classNames={{ input: "text-white" }}
                                        />
                                    </div>

                                    {/* Embeds */}
                                    {((formData.messagePayload as MessagePayload)?.embeds || []).map((embed, index) => (
                                        <div key={index} className="bg-[#181A20] rounded-xl border border-white/5 p-4 space-y-4 relative group">
                                            <div className="flex justify-between items-center">
                                                <h3 className="text-white font-bold text-sm uppercase tracking-wider text-default-500">Embed #{index + 1}</h3>
                                                <Button
                                                    isIconOnly size="sm" color="danger" variant="light"
                                                    onPress={() => {
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
                                                >
                                                    <Trash size={18} />
                                                </Button>
                                            </div>

                                            <div className="grid grid-cols-1 gap-4">
                                                <div className="flex gap-4">
                                                    <div className="w-12 flex flex-col gap-2">
                                                        <span className="text-tiny text-default-500">Color</span>
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
                                                        <Input
                                                            label="Title"
                                                            placeholder="Embed Title"
                                                            variant="bordered"
                                                            size="sm"
                                                            value={embed.title || ''}
                                                            onValueChange={(v) => {
                                                                const newEmbeds = [...((formData.messagePayload as MessagePayload)?.embeds || [])];
                                                                newEmbeds[index].title = v;
                                                                setFormData(prev => ({
                                                                    ...prev,
                                                                    messagePayload: {
                                                                        ...(prev.messagePayload as MessagePayload),
                                                                        embeds: newEmbeds
                                                                    }
                                                                }));
                                                            }}
                                                        />
                                                        <Textarea
                                                            label="Description"
                                                            placeholder="Embed Description"
                                                            variant="bordered"
                                                            minRows={2}
                                                            value={embed.description || ''}
                                                            onValueChange={(v) => {
                                                                const newEmbeds = [...((formData.messagePayload as MessagePayload)?.embeds || [])];
                                                                newEmbeds[index].description = v;
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
                                                </div>

                                                <div className="grid grid-cols-2 gap-4">
                                                    <Input
                                                        label="Image URL"
                                                        placeholder="https://..."
                                                        variant="bordered"
                                                        size="sm"
                                                        value={embed.image?.url || ''}
                                                        onValueChange={(v) => {
                                                            const newEmbeds = [...((formData.messagePayload as MessagePayload)?.embeds || [])];
                                                            newEmbeds[index].image = v ? { url: v } : undefined;
                                                            setFormData(prev => ({
                                                                ...prev,
                                                                messagePayload: {
                                                                    ...(prev.messagePayload as MessagePayload),
                                                                    embeds: newEmbeds
                                                                }
                                                            }));
                                                        }}
                                                    />
                                                    <Input
                                                        label="Thumbnail URL"
                                                        placeholder="https://..."
                                                        variant="bordered"
                                                        size="sm"
                                                        value={embed.thumbnail?.url || ''}
                                                        onValueChange={(v) => {
                                                            const newEmbeds = [...((formData.messagePayload as MessagePayload)?.embeds || [])];
                                                            newEmbeds[index].thumbnail = v ? { url: v } : undefined;
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

                                                <div className="space-y-2">
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-tiny text-default-500 uppercase font-bold">Footer</span>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <Input
                                                            placeholder="Footer Text"
                                                            variant="bordered"
                                                            size="sm"
                                                            className="flex-1"
                                                            value={embed.footer?.text || ''}
                                                            onValueChange={(v) => {
                                                                const newEmbeds = [...((formData.messagePayload as MessagePayload)?.embeds || [])];
                                                                newEmbeds[index].footer = { ...newEmbeds[index].footer, text: v };
                                                                setFormData(prev => ({
                                                                    ...prev,
                                                                    messagePayload: {
                                                                        ...(prev.messagePayload as MessagePayload),
                                                                        embeds: newEmbeds
                                                                    }
                                                                }));
                                                            }}
                                                        />
                                                        <Input
                                                            placeholder="Icon URL"
                                                            variant="bordered"
                                                            size="sm"
                                                            className="w-1/3"
                                                            value={embed.footer?.icon_url || ''}
                                                            onValueChange={(v) => {
                                                                const newEmbeds = [...((formData.messagePayload as MessagePayload)?.embeds || [])];
                                                                newEmbeds[index].footer = { ...newEmbeds[index].footer, text: newEmbeds[index].footer?.text || '', icon_url: v };
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
                                                </div>
                                            </div>
                                        </div>
                                    ))}

                                    <Button
                                        color="primary"
                                        variant="flat"
                                        startContent={<Plus weight="bold" />}
                                        className="w-full dashed border-2 border-primary/20 bg-primary/5"
                                        onPress={() => {
                                            const newEmbeds = [...((formData.messagePayload as MessagePayload)?.embeds || [])];
                                            newEmbeds.push({
                                                title: "New Embed",
                                                description: "Description here...",
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
                                    >
                                        Add Another Embed
                                    </Button>
                                </div>

                                <div className="space-y-4 h-fit sticky top-0">
                                    <h3 className="text-white font-bold text-sm uppercase tracking-wider text-default-500">Live Preview</h3>
                                    <div className="border border-white/10 rounded-xl overflow-hidden bg-[#313338] shadow-2xl">
                                        <DiscordMessagePreview
                                            message={formData.messagePayload as MessagePayload}
                                            botName="Ticket Bot"
                                        />
                                    </div>
                                    <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs">
                                        <p className="font-bold mb-1">💡 Tip</p>
                                        <p>You can use standard Markdown in descriptions (e.g., **bold**, *italic*, [links](url)).</p>
                                    </div>
                                </div>
                            </div>
                        </Tab>
                    </Tabs>
                </ModalBody>
                <ModalFooter>
                    <Button variant="light" onPress={onClose}>
                        Cancel
                    </Button>
                    <Button color="primary" onPress={handleSave} isLoading={saving} startContent={<FloppyDisk weight="bold" />}>
                        Save Category
                    </Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
}
