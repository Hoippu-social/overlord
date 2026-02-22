'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
    Card, CardBody, Button, Spinner, Input, Textarea, Switch, Select, SelectItem,
    Tabs, Tab, Chip, Divider, Accordion, AccordionItem, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, useDisclosure
} from "@nextui-org/react";
import {
    Ticket, FloppyDisk, ArrowLeft, Trash, Plus, ListDashes, ChatText,
    PuzzlePiece, Globe, CaretDown, CaretUp, X, Check, TextT
} from "@phosphor-icons/react";
import { useGuildLocale } from '@/lib/i18n';
import Link from 'next/link';
// import { toast } from 'sonner';

// --- Interfaces ---

interface ChannelOption {
    id: string;
    name: string;
    type: string | number;
    parentId?: string;
}

interface RoleOption {
    id: string;
    name: string;
    color: number;
    position: number;
}

interface TicketFormQuestion {
    id?: number;
    label: string;
    type: 'TEXT' | 'PARAGRAPH' | 'NUMBER' | 'SELECT'; // Simplified for now
    required: boolean;
    placeholder?: string;
    options?: string[]; // JSON string or array? Schema says simplistic types for now
}

interface TicketItem {
    id?: number;
    type: 'QUICK_REPLY' | 'DEPARTMENT'; // Simplify to these for now
    label: string;
    description?: string;
    emoji?: string;
    replyContent?: string; // For quick reply
    agentRoles?: string; // JSON array of role IDs
    requiredRoles?: string; // JSON array
}

interface TicketCategory {
    id: number;
    name: string;
    channelId?: string;
    saveHistory: boolean;
    mentionAgents: boolean;
    allowUserClose: boolean;
    splitLogs: boolean;
    enableRating: boolean;
    agentRoles?: string; // JSON
    messageText?: string;
    messageEmbeds?: string; // JSON
    buttonText?: string;
    buttonEmoji?: string;
    buttonStyle?: string;
    forms: TicketFormQuestion[];
    items: TicketItem[];
}

export default function TicketCategoryPage() {
    const { guildId, categoryId } = useParams<{ guildId: string, categoryId: string }>();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);

    // Data
    const [category, setCategory] = useState<TicketCategory | null>(null);
    const [channels, setChannels] = useState<{ text: ChannelOption[], categories: ChannelOption[] }>({ text: [], categories: [] });
    const [roles, setRoles] = useState<RoleOption[]>([]);

    // Form State (Local)
    const [formData, setFormData] = useState<TicketCategory | null>(null);

    // Modal for deleting
    const deleteModal = useDisclosure();

    useEffect(() => {
        const load = async () => {
            try {
                // Parallel fetch
                const [catRes, textRes, catChanRes, roleRes] = await Promise.all([
                    fetch(`/api/guilds/${guildId}/tickets/${categoryId}`),
                    fetch(`/api/guilds/${guildId}/channels?type=text`),
                    fetch(`/api/guilds/${guildId}/channels?type=category`),
                    fetch(`/api/guilds/${guildId}/roles`)
                ]);

                if (catRes.ok) {
                    const data = await catRes.json();
                    setCategory(data.category);
                    setFormData(data.category);
                } else {
                    // Handle 404
                    router.push(`/dashboard/${guildId}/tickets`);
                    return;
                }

                if (textRes.ok) {
                    const textData = await textRes.json();
                    setChannels(prev => ({ ...prev, text: textData }));
                }
                if (catChanRes.ok) {
                    const catData = await catChanRes.json();
                    setChannels(prev => ({ ...prev, categories: catData }));
                }
                if (roleRes.ok) setRoles(await roleRes.json());

            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [guildId, categoryId]);

    const handleSave = async () => {
        if (!formData) return;
        setSaving(true);
        try {
            const res = await fetch(`/api/guilds/${guildId}/tickets/${categoryId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            if (res.ok) {
                // Show success toast or visual feedback
                alert("Saved successfully");
            }
        } catch (e) {
            console.error(e);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        setDeleting(true);
        try {
            const res = await fetch(`/api/guilds/${guildId}/tickets/${categoryId}`, {
                method: 'DELETE'
            });
            if (res.ok) {
                router.push(`/dashboard/${guildId}/tickets`);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setDeleting(false);
        }
    };

    // Helper to update form data
    const updateField = (field: keyof TicketCategory, value: any) => {
        setFormData(prev => prev ? ({ ...prev, [field]: value }) : null);
    };

    // Helper for Agent Roles (JSON string)
    const selectedAgentRoles = useMemo(() => {
        if (!formData?.agentRoles) return new Set<string>();
        try {
            const parsed = JSON.parse(formData.agentRoles);
            return new Set<string>(Array.isArray(parsed) ? parsed : []);
        } catch { return new Set<string>(); }
    }, [formData?.agentRoles]);

    const handleAgentRolesChange = (keys: any) => {
        const arr = Array.from(keys) as string[];
        updateField('agentRoles', JSON.stringify(arr));
    };

    if (loading || !formData) {
        return <div className="flex justify-center p-10"><Spinner size="lg" color="primary" /></div>;
    }

    return (
        <div className="space-y-6 animate-fade-in p-6 pb-20">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button as={Link} href={`/dashboard/${guildId}/tickets`} isIconOnly variant="light" radius="full">
                        <ArrowLeft size={24} />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                            {formData.name}
                            <Chip size="sm" variant="flat" color="primary">ID: {categoryId}</Chip>
                        </h1>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button
                        color="danger"
                        variant="flat"
                        startContent={<Trash weight="bold" />}
                        onPress={deleteModal.onOpen}
                    >
                        Delete
                    </Button>
                    <Button
                        color="primary"
                        startContent={!saving && <FloppyDisk weight="bold" />}
                        isLoading={saving}
                        onPress={handleSave}
                        className="font-bold shadow-lg shadow-primary/20"
                    >
                        Save Changes
                    </Button>
                </div>
            </div>

            <Tabs
                aria-label="Category Options"
                color="primary"
                variant="underlined"
                classNames={{
                    tabList: "gap-6 w-full relative rounded-none p-0 border-b border-divider",
                    cursor: "w-full bg-primary",
                    tab: "max-w-fit px-0 h-12",
                    tabContent: "group-data-[selected=true]:text-primary font-bold text-lg"
                }}
            >
                <Tab key="general" title={
                    <div className="flex items-center gap-2">
                        <Globe size={20} />
                        <span>General</span>
                    </div>
                }>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                        {/* Basic Settings */}
                        <Card className="bg-[#181A20] border border-white/5 p-4">
                            <CardBody className="space-y-6">
                                <h3 className="text-lg font-bold text-white border-b border-white/5 pb-2">Basic Settings</h3>

                                <Input
                                    label="Category Name"
                                    value={formData.name}
                                    onValueChange={(v) => updateField('name', v)}
                                    variant="bordered"
                                />

                                <Select
                                    label="Ticket Channel Category"
                                    placeholder="Where tickets will be created"
                                    selectedKeys={formData.channelId ? [formData.channelId] : []}
                                    onChange={(e) => updateField('channelId', e.target.value)}
                                    variant="bordered"
                                >
                                    {channels.categories.map(c => (
                                        <SelectItem key={c.id} value={c.id} textValue={c.name}>
                                            {c.name}
                                        </SelectItem>
                                    ))}
                                </Select>

                                <Select
                                    label="Agent Roles"
                                    placeholder="Who can manage tickets"
                                    selectionMode="multiple"
                                    selectedKeys={selectedAgentRoles}
                                    onSelectionChange={handleAgentRolesChange}
                                    variant="bordered"
                                >
                                    {roles.map(r => (
                                        <SelectItem key={r.id} value={r.id} textValue={r.name} startContent={
                                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: `#${r.color.toString(16).padStart(6, '0')}` }} />
                                        }>
                                            {r.name} {r.id === guildId ? '(Everyone)' : ''}
                                        </SelectItem>
                                    ))}
                                </Select>
                            </CardBody>
                        </Card>

                        {/* Toggles */}
                        <Card className="bg-[#181A20] border border-white/5 p-4">
                            <CardBody className="space-y-6">
                                <h3 className="text-lg font-bold text-white border-b border-white/5 pb-2">Behavior & Permissions</h3>

                                <Switch isSelected={formData.mentionAgents} onValueChange={(v) => updateField('mentionAgents', v)}>
                                    Mention Agents on Creation
                                </Switch>
                                <p className="text-tiny text-default-400 -mt-4 pl-14">Ping support roles when a new ticket is opened.</p>

                                <Switch isSelected={formData.saveHistory} onValueChange={(v) => updateField('saveHistory', v)}>
                                    Save Transcripts
                                </Switch>
                                <p className="text-tiny text-default-400 -mt-4 pl-14">Generate and save HTML transcripts after closing.</p>

                                <Switch isSelected={formData.enableRating} onValueChange={(v) => updateField('enableRating', v)}>
                                    Enable Feedback/Rating
                                </Switch>
                                <p className="text-tiny text-default-400 -mt-4 pl-14">Ask users to rate their support experience.</p>

                                <Switch isSelected={formData.allowUserClose} onValueChange={(v) => updateField('allowUserClose', v)}>
                                    Allow Users to Close
                                </Switch>
                                <p className="text-tiny text-default-400 -mt-4 pl-14">Let the ticket creator close their own ticket.</p>
                            </CardBody>
                        </Card>
                    </div>
                </Tab>

                <Tab key="message" title={
                    <div className="flex items-center gap-2">
                        <ChatText size={20} />
                        <span>Message</span>
                    </div>
                }>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                        <Card className="bg-[#181A20] border border-white/5 p-4">
                            <CardBody className="space-y-6">
                                <h3 className="text-lg font-bold text-white border-b border-white/5 pb-2">Panel Message</h3>
                                <Textarea
                                    label="Message Content"
                                    placeholder="Text displayed above the embed..."
                                    value={formData.messageText || ''}
                                    onValueChange={(v) => updateField('messageText', v)}
                                    minRows={3}
                                    variant="bordered"
                                />
                                {/* Simplified Embed Editor - Just JSON for now or simple fields? */}
                                <div className="p-4 rounded-xl bg-default-50 border border-default-100">
                                    <p className="text-sm font-semibold mb-2">Embed Preview</p>
                                    <div className="bg-[#2f3136] p-4 rounded-l border-l-4 border-primary text-white text-sm">
                                        <p className="font-bold">Ticket Support</p>
                                        <p className="mt-1 opacity-90">Click the button below to open a ticket.</p>
                                    </div>
                                    <p className="text-xs text-default-400 mt-2">Embed editing coming soon.</p>
                                </div>
                            </CardBody>
                        </Card>

                        <Card className="bg-[#181A20] border border-white/5 p-4">
                            <CardBody className="space-y-6">
                                <h3 className="text-lg font-bold text-white border-b border-white/5 pb-2">Button Style</h3>
                                <Input
                                    label="Button Label"
                                    value={formData.buttonText || 'Create Ticket'}
                                    onValueChange={(v) => updateField('buttonText', v)}
                                    variant="bordered"
                                />
                                <Input
                                    label="Button Emoji"
                                    value={formData.buttonEmoji || '🎫'}
                                    onValueChange={(v) => updateField('buttonEmoji', v)}
                                    variant="bordered"
                                    placeholder="e.g. 🎫"
                                />
                                <Select
                                    label="Button Color"
                                    selectedKeys={[formData.buttonStyle || 'PRIMARY']}
                                    onChange={(e) => updateField('buttonStyle', e.target.value)}
                                    variant="bordered"
                                >
                                    <SelectItem key="PRIMARY" value="PRIMARY">Blurple (Primary)</SelectItem>
                                    <SelectItem key="SECONDARY" value="SECONDARY">Grey (Secondary)</SelectItem>
                                    <SelectItem key="SUCCESS" value="SUCCESS">Green (Success)</SelectItem>
                                    <SelectItem key="DANGER" value="DANGER">Red (Danger)</SelectItem>
                                </Select>
                            </CardBody>
                        </Card>
                    </div>
                </Tab>

                <Tab key="forms" title={
                    <div className="flex items-center gap-2">
                        <ListDashes size={20} />
                        <span>Form (Modal)</span>
                    </div>
                }>
                    <div className="mt-6">
                        <Card className="bg-[#181A20] border border-white/5 p-4">
                            <CardBody>
                                <div className="flex justify-between items-center mb-6">
                                    <div>
                                        <h3 className="text-lg font-bold text-white">Modal Questions</h3>
                                        <p className="text-default-500 text-sm">Questions user must answer before ticket creation.</p>
                                    </div>
                                    <Button size="sm" color="primary" variant="flat" startContent={<Plus />} onPress={() => {
                                        const newForm = [...(formData.forms || [])];
                                        newForm.push({ label: 'New Question', type: 'TEXT', required: true, placeholder: '' });
                                        updateField('forms', newForm);
                                    }}>Add Question</Button>
                                </div>

                                <div className="space-y-4">
                                    {(formData.forms || []).map((question, idx) => (
                                        <div key={idx} className="bg-default-50 p-4 rounded-xl border border-white/5 flex gap-4 items-start">
                                            <div className="bg-default-200 w-8 h-8 flex items-center justify-center rounded-lg font-bold text-default-500 shrink-0">
                                                {idx + 1}
                                            </div>
                                            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <Input
                                                    label="Question Label"
                                                    value={question.label}
                                                    size="sm" variant="bordered"
                                                    onValueChange={(v) => {
                                                        const newForms = [...formData.forms];
                                                        newForms[idx].label = v;
                                                        updateField('forms', newForms);
                                                    }}
                                                />
                                                <Input
                                                    label="Placeholder"
                                                    value={question.placeholder || ''}
                                                    size="sm" variant="bordered"
                                                    onValueChange={(v) => {
                                                        const newForms = [...formData.forms];
                                                        newForms[idx].placeholder = v;
                                                        updateField('forms', newForms);
                                                    }}
                                                />
                                                <Select
                                                    label="Input Style"
                                                    selectedKeys={[question.type]}
                                                    size="sm" variant="bordered"
                                                    onChange={(e) => {
                                                        const newForms = [...formData.forms];
                                                        newForms[idx].type = e.target.value as any;
                                                        updateField('forms', newForms);
                                                    }}
                                                >
                                                    <SelectItem key="TEXT" value="TEXT">Short Text</SelectItem>
                                                    <SelectItem key="PARAGRAPH" value="PARAGRAPH">Paragraph</SelectItem>
                                                </Select>
                                                <div className="flex items-center">
                                                    <Switch
                                                        size="sm"
                                                        isSelected={question.required}
                                                        onValueChange={(v) => {
                                                            const newForms = [...formData.forms];
                                                            newForms[idx].required = v;
                                                            updateField('forms', newForms);
                                                        }}
                                                    >
                                                        Required
                                                    </Switch>
                                                </div>
                                            </div>
                                            <Button isIconOnly color="danger" variant="light" onPress={() => {
                                                const newForms = formData.forms.filter((_, i) => i !== idx);
                                                updateField('forms', newForms);
                                            }}>
                                                <X size={20} />
                                            </Button>
                                        </div>
                                    ))}
                                    {(!formData.forms || formData.forms.length === 0) && (
                                        <div className="text-center p-8 text-default-400 italic bg-default-50/50 rounded-xl">
                                            No questions configured. The modal will allow users to simply open a ticket.
                                        </div>
                                    )}
                                </div>
                            </CardBody>
                        </Card>
                    </div>
                </Tab>

                <Tab key="items" title={ // Renamed from "Components" to be clearer or stick to "Items"
                    <div className="flex items-center gap-2">
                        <PuzzlePiece size={20} />
                        <span>Items</span>
                    </div>
                }>
                    <div className="mt-6">
                        <div className="p-10 text-center text-default-500 bg-[#181A20] rounded-xl border border-white/5">
                            <PuzzlePiece size={48} className="mx-auto mb-4 opacity-50" />
                            <h3 className="text-xl font-bold text-white mb-2">Advanced Items</h3>
                            <p>Development in progress. This section will allow defining Quick Replies and Support Department routing.</p>
                        </div>
                    </div>
                </Tab>
            </Tabs>

            {/* Delete Confirmation Modal */}
            <Modal isOpen={deleteModal.isOpen} onOpenChange={deleteModal.onOpenChange}>
                <ModalContent className="bg-[#181A20] border border-white/10 text-white">
                    {(onClose) => (
                        <>
                            <ModalHeader>Delete Category?</ModalHeader>
                            <ModalBody>
                                <p>Are you sure you want to delete <strong>{category?.name}</strong>? This action cannot be undone.</p>
                                <p className="text-sm text-default-400">All configurations for this category will be lost. Existing tickets will remain but may lose functionality.</p>
                            </ModalBody>
                            <ModalFooter>
                                <Button variant="light" onPress={onClose}>Cancel</Button>
                                <Button color="danger" onPress={handleDelete} isLoading={deleting}>Delete</Button>
                            </ModalFooter>
                        </>
                    )}
                </ModalContent>
            </Modal>
        </div>
    );
}
