import React, { useMemo, useState } from 'react';
import { Autocomplete, AutocompleteItem } from "@nextui-org/react";
import { Check, FolderSimple, Hash, Tag, X } from "@phosphor-icons/react";

type SelectOption = {
    id: string;
    name: string;
    color?: string | number;
    type?: number | string;
    position?: number;
    parentId?: string | null;
    isCategory?: boolean;
    categoryName?: string | null;
    disabled?: boolean;
    isSeparator?: boolean;
};

// --- Layout & Containers ---

export function AnimatedCard({ title, subtitle, children, className = '' }: { title?: string; subtitle?: string; children: React.ReactNode; className?: string }) {
    return (
        <section className={`group relative overflow-hidden rounded-[24px] border border-white/5 bg-white/[0.02] backdrop-blur-xl p-6 shadow-2xl transition-all duration-500 hover:bg-white/[0.04] hover:border-white/10 hover:-translate-y-1 ${className}`}>
            {/* Subtle glow effect on hover */}
            <div className="absolute -inset-px bg-gradient-to-r from-[var(--color-primary-1)] to-[#a855f7] opacity-0 blur-lg transition duration-500 group-hover:opacity-10 pointer-events-none" />

            {(title || subtitle) && (
                <div className="relative mb-6">
                    {title && <h2 className="text-xl font-bold tracking-tight text-white/90 drop-shadow-sm">{title}</h2>}
                    {subtitle && <p className="mt-1.5 text-sm text-white/50 xl:w-3/4">{subtitle}</p>}
                </div>
            )}
            <div className="relative z-10">{children}</div>
        </section>
    );
}

// --- Status & Indicators ---

export function Badge({ children, variant = 'default', className = '' }: { children: React.ReactNode; variant?: 'default' | 'success' | 'danger' | 'warning'; className?: string }) {
    const variants = {
        default: 'bg-white/10 text-white/80 border-white/10',
        success: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.2)]',
        danger: 'bg-rose-500/10 text-rose-400 border-rose-500/20 shadow-[0_0_10px_rgba(244,63,94,0.2)]',
        warning: 'bg-amber-500/10 text-amber-400 border-amber-500/20 shadow-[0_0_10px_rgba(245,158,11,0.2)]',
    };
    return (
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold backdrop-blur-sm transition-all ${variants[variant]} ${className}`}>
            {children}
        </span>
    );
}

// --- Inputs & Controls ---

const parseColor = (col?: string | number) => {
    if (col === undefined || col === null) return null;
    if (typeof col === 'number') {
        if (col === 0) return null;
        return '#' + col.toString(16).padStart(6, '0');
    }
    if (typeof col === 'string') {
        if (col === '#000000' || col === '0') return null;
        if (!col.startsWith('#') && !col.startsWith('rgb')) return `#${col}`;
        return col;
    }
    return null;
};

const isChannelOption = (option: SelectOption) =>
    option.isCategory !== undefined || option.categoryName !== undefined || option.parentId !== undefined;

const matchesQuery = (option: SelectOption, query: string) => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    if (!normalizedQuery) return true;

    return [option.name, option.categoryName]
        .filter(Boolean)
        .some((value) => value!.toLocaleLowerCase().includes(normalizedQuery));
};

function SelectionMarker({ isSelected = false }: { isSelected?: boolean }) {
    return (
        <div className="flex items-center justify-center shrink-0 w-6 h-6">
            <div
                className={`flex items-center justify-center w-5 h-5 rounded-md border transition-all duration-200 ${
                    isSelected
                        ? 'border-[var(--color-primary-1)] bg-[var(--color-primary-1)] text-black shadow-[0_0_10px_rgba(var(--color-primary-1-rgb),0.35)]'
                        : 'border-white/10 bg-white/[0.03] text-transparent'
                }`}
            >
                <Check size={12} weight="bold" />
            </div>
        </div>
    );
}

function OptionIcon({ option }: { option: SelectOption }) {
    if (option.isSeparator) {
        return null;
    }

    const color = parseColor(option.color);

    if (isChannelOption(option)) {
        if (option.isCategory) {
            return <FolderSimple size={16} weight="fill" className="text-amber-300" />;
        }
        return <Hash size={16} weight="bold" className="text-sky-300" />;
    }

    return (
        <Tag
            size={16}
            weight="fill"
            style={color ? { color } : undefined}
            className={!color ? 'text-white/50' : undefined}
        />
    );
}

function CategoryBadge() {
    return (
        <span className="inline-flex items-center rounded-md border border-amber-300/20 bg-amber-300/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-200">
            Category
        </span>
    );
}

function CategoryHint({ name }: { name: string }) {
    return (
        <span className="inline-flex max-w-[180px] items-center truncate rounded-md border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/45">
            {name}
        </span>
    );
}

function SelectedChip({ option, onRemove }: { option: SelectOption; onRemove: () => void }) {
    const color = parseColor(option.color);
    const isCategory = Boolean(option.isCategory);

    return (
        <span
            className={`inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-semibold shadow-sm backdrop-blur-md ${
                isCategory ? 'border-amber-300/25 bg-amber-300/10 text-amber-100' : 'border-white/20 bg-white/10 text-white/90'
            }`}
            style={!isCategory && color ? { borderColor: `${color}55`, color, backgroundColor: `${color}18` } : undefined}
        >
            <OptionIcon option={option} />
            <span className="max-w-[220px] truncate">{option.name}</span>
            {option.categoryName && !isCategory ? <span className="text-white/35">({option.categoryName})</span> : null}
            <button
                type="button"
                onClick={onRemove}
                className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-black/20 text-white/60 hover:bg-rose-500 hover:text-white transition-colors"
                aria-label={`Remove ${option.name}`}
            >
                <X size={10} weight="bold" />
            </button>
        </span>
    );
}

export function InteractiveSelect({ label, value, options, placeholder, onChange }: { label?: string; value: string; options: SelectOption[]; placeholder?: string; onChange: (v: string) => void }) {
    return (
        <div className="space-y-2 group relative">
            {label && <span className="text-sm font-semibold tracking-wide text-white/50 transition-colors group-hover:text-white/80">{label}</span>}
            <div className="w-full rounded-2xl border border-white/10 bg-black/20 backdrop-blur-md shadow-inner transition-all duration-300 hover:bg-black/40 hover:border-white/20 focus-within:border-[var(--color-primary-1)] focus-within:ring-2 focus-within:ring-[var(--color-primary-1)]/20">
                <Autocomplete
                    aria-label={label || placeholder || 'Select option'}
                    defaultItems={options}
                    selectedKey={value || null}
                    onSelectionChange={(key) => onChange(key ? String(key) : '')}
                    isClearable={Boolean(placeholder)}
                    isVirtualized={false}
                    allowsCustomValue={false}
                    placeholder={placeholder || 'Type to search...'}
                    classNames={{
                        base: "w-full",
                        listboxWrapper: "bg-[#111111]",
                        popoverContent: "bg-[#111111] border border-white/10 rounded-2xl shadow-2xl p-2"
                    }}
                    inputProps={{
                        classNames: {
                            inputWrapper: "min-h-[52px] rounded-2xl border-0 bg-transparent shadow-none px-4 data-[hover=true]:bg-transparent",
                            input: "text-sm font-medium text-white/90 placeholder:text-white/30",
                            clearButton: "text-white/50 hover:text-white"
                        }
                    }}
                    listboxProps={{
                        classNames: {
                            base: "p-1",
                            list: "flex flex-col gap-2"
                        },
                        itemClasses: {
                            base: "rounded-xl p-2 data-[hover=true]:bg-white/[0.04]"
                        }
                    }}
                >
                    {(option) => (
                        <AutocompleteItem
                            key={option.id}
                            isDisabled={option.disabled || option.isSeparator}
                            textValue={`${option.name} ${option.categoryName || ''}`}
                            startContent={option.isSeparator ? null : <OptionIcon option={option} />}
                            endContent={
                                option.isSeparator
                                    ? undefined
                                    : option.isCategory
                                    ? <CategoryBadge />
                                    : option.categoryName
                                        ? <CategoryHint name={option.categoryName} />
                                        : undefined
                            }
                            selectedIcon={option.isSeparator ? undefined : ({ isSelected }) => <SelectionMarker isSelected={Boolean(isSelected)} />}
                            classNames={{
                                base: option.isSeparator
                                    ? 'min-h-[30px] cursor-default rounded-none border-0 bg-transparent px-2 py-1 opacity-80'
                                    : `min-h-[46px] items-center rounded-xl border px-3 py-2 data-[hover=true]:bg-white/[0.04] ${option.isCategory ? 'border-amber-300/20 bg-amber-300/[0.06]' : 'border-white/10 bg-white/[0.01]'} data-[selected=true]:border-[var(--color-primary-1)] data-[selected=true]:bg-[var(--color-primary-1)]/[0.08]`,
                                wrapper: option.isSeparator ? 'min-w-0 flex flex-1 items-center justify-center overflow-hidden' : 'min-w-0 flex flex-1 items-center justify-start overflow-hidden',
                                title: option.isSeparator ? 'truncate text-[10px] font-bold uppercase tracking-[0.2em] text-white/25' : option.isCategory ? 'truncate text-sm font-bold tracking-wide text-amber-100' : 'truncate text-sm font-medium text-white/90',
                                selectedIcon: option.isSeparator ? 'hidden' : 'order-[-1] mr-2 ml-0 flex h-6 w-6 shrink-0 items-center justify-center self-center'
                            }}
                        >
                            {option.name}
                        </AutocompleteItem>
                    )}
                </Autocomplete>
            </div>
        </div>
    );
}

export function TextField({ label, value, type = 'text', placeholder, onChange, icon }: { label?: string; value: string; type?: 'text' | 'number' | 'password'; placeholder?: string; onChange: (v: string) => void; icon?: React.ReactNode }) {
    return (
        <label className="block space-y-2 group">
            {label && <span className="text-sm font-semibold tracking-wide text-white/50 transition-colors group-hover:text-white/80">{label}</span>}
            <div className="relative">
                {icon && <div className="absolute inset-y-0 left-0 flex items-center pl-4 text-white/40">{icon}</div>}
                <input
                    type={type}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    aria-label={label || placeholder || 'Input field'}
                    className={`w-full rounded-2xl border border-white/10 bg-black/20 backdrop-blur-md ${icon ? 'pl-11' : 'px-4'} py-3.5 text-sm text-white/90 outline-none transition-all duration-300 hover:bg-black/40 hover:border-white/20 focus:border-[var(--color-primary-1)] focus:ring-2 focus:ring-[var(--color-primary-1)]/20 shadow-inner placeholder:text-white/30`}
                />
            </div>
        </label>
    );
}

export function SmoothToggle({ label, checked, onChange, description }: { label: string; checked: boolean; onChange: (v: boolean) => void; description?: string }) {
    return (
        <div
            onClick={() => onChange(!checked)}
            className={`group relative flex items-center justify-between gap-4 rounded-2xl border p-4 cursor-pointer transition-all duration-500 overflow-hidden ${checked ? 'border-[var(--color-primary-1)]/30 bg-[var(--color-primary-1)]/5 shadow-[0_4px_20px_rgba(var(--color-primary-1-rgb),0.05)]' : 'border-white/5 bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/10'}`}
        >
            {checked && <div className="absolute inset-0 bg-gradient-to-r from-[var(--color-primary-1)]/10 to-transparent opacity-50 pointer-events-none" />}

            <div className="relative flex flex-col">
                <span className={`text-sm font-bold tracking-wide transition-colors duration-300 ${checked ? 'text-white/90' : 'text-white/60 group-hover:text-white/80'}`}>{label}</span>
                {description && <span className="text-xs text-white/40 mt-0.5">{description}</span>}
            </div>

            <button
                type="button"
                aria-label={label || description || 'Toggle setting'}
                className={`relative flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-2 transition-all duration-300 ease-spring focus:outline-none ${checked ? 'border-[var(--color-primary-1)] bg-[var(--color-primary-1)] shadow-[0_0_15px_rgba(var(--color-primary-1-rgb),0.4)]' : 'border-white/20 bg-black/30'}`}
            >
                <span className="sr-only">Toggle {label}</span>
                <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition-transform duration-300 ease-spring ${checked ? 'translate-x-5 scale-110' : 'translate-x-0.5 scale-90 opacity-70'}`} />
            </button>
        </div>
    );
}

export function SliderField({ label, value, min = 0, max = 100, onChange, valueLabel }: { label: string; value: number; min?: number; max?: number; onChange: (v: number) => void; valueLabel?: string }) {
    const percentage = ((value - min) / (max - min)) * 100;

    return (
        <div className="space-y-4 group">
            <div className="flex items-center justify-between transition-colors">
                <span className="text-sm font-semibold tracking-wide text-white/50 group-hover:text-white/80">{label}</span>
                <Badge variant={percentage > 75 ? 'danger' : percentage > 40 ? 'warning' : 'success'}>
                    {valueLabel || value}
                </Badge>
            </div>
            <div className="relative h-2.5 w-full pt-1 pb-1 flex items-center">
                <input
                    type="range"
                    min={min}
                    max={max}
                    value={value}
                    onChange={(e) => onChange(Number(e.target.value))}
                    className="absolute z-10 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="relative w-full h-1.5 bg-black/40 rounded-full overflow-hidden border border-white/5 shadow-inner">
                    <div
                        className="absolute h-full left-0 rounded-full transition-all duration-200 ease-out"
                        style={{
                            width: `${percentage}%`,
                            background: `linear-gradient(90deg, var(--color-primary-1) 0%, ${percentage > 75 ? '#f43f5e' : percentage > 40 ? '#f59e0b' : '#10b981'} 100%)`,
                            boxShadow: '0 0 10px rgba(var(--color-primary-1-rgb), 0.5)'
                        }}
                    />
                </div>
                {/* Thumb pseudo-element simulator */}
                <div
                    className="absolute h-4 w-4 bg-white rounded-full shadow-[0_0_10px_rgba(255,255,255,0.5)] border-2 border-[var(--color-primary-1)] pointer-events-none transition-all duration-200 ease-out"
                    style={{ left: `calc(${percentage}% - 8px)` }}
                />
            </div>
        </div>
    );
}

export function TagsInputField({ label, tags, placeholder, onAdd, onRemove }: { label: string; tags: string[]; placeholder?: string; onAdd: (tag: string) => void; onRemove: (index: number) => void }) {
    const [input, setInput] = useState('');

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            const val = input.trim();
            if (val && !tags.includes(val)) {
                onAdd(val);
                setInput('');
            }
        }
    };

    return (
        <div className="space-y-2 group">
            <span className="text-sm font-semibold tracking-wide text-white/50 transition-colors group-hover:text-white/80">{label}</span>
            <div className="min-h-[52px] w-full rounded-2xl border border-white/10 bg-black/20 backdrop-blur-md p-2 transition-all duration-300 hover:bg-black/40 hover:border-white/20 focus-within:border-[var(--color-primary-1)] focus-within:ring-2 focus-within:ring-[var(--color-primary-1)]/20 shadow-inner">
                <div className="flex flex-wrap gap-2 items-center">
                    {tags.map((tag, i) => (
                        <span key={i} className="flex items-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/90 shadow-sm transition-all hover:bg-white/20 backdrop-blur-md">
                            {tag}
                            <button
                                type="button"
                                onClick={() => onRemove(i)}
                                className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-black/20 text-white/60 hover:bg-rose-500 hover:text-white transition-colors"
                            >
                                &times;
                            </button>
                        </span>
                    ))}
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={tags.length === 0 ? placeholder : 'Type and press Enter...'}
                        className="flex-1 bg-transparent px-2 py-1.5 text-sm text-white/80 outline-none w-auto min-w-[150px] placeholder:text-white/30"
                    />
                </div>
            </div>
        </div>
    );
}

export function SegmentedTabs({ active, onChange, labels, tabs, icons }: { active: string; onChange: (tab: string) => void; labels: Record<string, string>; tabs: readonly string[]; icons?: Record<string, React.ReactNode> }) {
    return (
        <div className="flex items-center gap-1 flex-wrap bg-[#111111] border border-white/[0.04] rounded-2xl p-1.5 shadow-sm shadow-black/20 w-full min-w-0">
            {tabs.map((tab) => {
                const isActive = active === tab;
                return (
                    <button
                        key={tab}
                        type="button"
                        onClick={() => onChange(tab)}
                        className={`flex-1 flex justify-center items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${isActive
                                ? 'bg-[#75F16A] text-[#0a0a0a] shadow-[0_0_20px_rgba(117,241,106,0.3)]'
                                : 'text-white/40 hover:text-white/80 hover:bg-white/[0.04]'
                            }`}
                    >
                        {icons && icons[tab] && <span>{icons[tab]}</span>}
                        <span>{labels[tab]}</span>
                    </button>
                );
            })}
        </div>
    );
}

// --- Missed Components ---

export function TextAreaField({ label, value, placeholder, rows = 4, onChange }: { label?: string; value: string; placeholder?: string; rows?: number; onChange: (v: string) => void }) {
    return (
        <label className="block space-y-2 group">
            {label && <span className="text-sm font-semibold tracking-wide text-white/50 transition-colors group-hover:text-white/80">{label}</span>}
            <textarea
                value={value}
                rows={rows}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                aria-label={label || placeholder || 'Text area'}
                className="w-full rounded-2xl border border-white/10 bg-black/20 backdrop-blur-md px-4 py-3.5 text-sm text-white/90 outline-none transition-all duration-300 hover:bg-black/40 hover:border-white/20 focus:border-[var(--color-primary-1)] focus:ring-2 focus:ring-[var(--color-primary-1)]/20 shadow-inner placeholder:text-white/30 resize-y whitespace-pre-wrap"
            />
        </label>
    );
}

export function MultiSelectField({ label, options, selected, onChange, placeholder }: { label: string; options: SelectOption[]; selected: string[]; onChange: (keys: string[]) => void; placeholder?: string }) {
    const [inputValue, setInputValue] = useState('');
    const [activeKey, setActiveKey] = useState<string | null>(null);

    const selectedOptions = useMemo(
        () => selected.map((id) => options.find((option) => option.id === id)).filter(Boolean) as SelectOption[],
        [options, selected]
    );

    const availableOptions = useMemo(
        () => options.filter((option) => !selected.includes(option.id)),
        [options, selected]
    );

    const filteredOptions = useMemo(
        () => availableOptions.filter((option) => matchesQuery(option, inputValue)),
        [availableOptions, inputValue]
    );

    return (
        <div className="space-y-2 group">
            <span className="text-sm font-semibold tracking-wide text-white/50 transition-colors group-hover:text-white/80">{label}</span>
            <div className="w-full rounded-2xl border border-white/10 bg-black/20 backdrop-blur-md p-2 shadow-inner transition-all duration-300 hover:bg-black/40 hover:border-white/20 focus-within:border-[var(--color-primary-1)] focus-within:ring-2 focus-within:ring-[var(--color-primary-1)]/20">
                {selectedOptions.length > 0 ? (
                    <div className="mb-2 flex flex-wrap gap-2">
                        {selectedOptions.map((option) => (
                            <SelectedChip
                                key={option.id}
                                option={option}
                                onRemove={() => onChange(selected.filter((id) => id !== option.id))}
                            />
                        ))}
                    </div>
                ) : null}
                <Autocomplete
                    aria-label={label || placeholder || 'Select options'}
                    items={filteredOptions}
                    selectedKey={activeKey}
                    inputValue={inputValue}
                    onInputChange={setInputValue}
                    onSelectionChange={(key) => {
                        if (!key) return;
                        const nextKey = String(key);
                        if (!selected.includes(nextKey)) {
                            onChange([...selected, nextKey]);
                        }
                        setActiveKey(null);
                        setInputValue('');
                    }}
                    allowsCustomValue={false}
                    isClearable
                    isVirtualized={false}
                    placeholder={selected.length === 0 ? (placeholder || 'Type to search and add...') : 'Type to add more...'}
                    classNames={{
                        base: "w-full",
                        listboxWrapper: "bg-[#111111]",
                        popoverContent: "bg-[#111111] border border-white/10 rounded-2xl shadow-2xl p-2"
                    }}
                    inputProps={{
                        classNames: {
                            inputWrapper: "bg-transparent border-0 shadow-none min-h-[38px] px-1 data-[hover=true]:bg-transparent group-data-[focus=true]:bg-transparent",
                            input: "text-sm font-medium text-white/90 placeholder:text-white/30",
                            clearButton: "text-white/50 hover:text-white"
                        }
                    }}
                    listboxProps={{
                        classNames: {
                            base: "p-1",
                            list: "flex flex-col gap-2"
                        },
                        itemClasses: {
                            base: "rounded-xl p-2 data-[hover=true]:bg-white/[0.04]"
                        }
                    }}
                >
                    {(option) => (
                        <AutocompleteItem
                            key={option.id}
                            isDisabled={option.disabled || option.isSeparator}
                            textValue={`${option.name} ${option.categoryName || ''}`}
                            startContent={option.isSeparator ? null : <OptionIcon option={option} />}
                            endContent={
                                option.isSeparator
                                    ? undefined
                                    : option.isCategory
                                    ? <CategoryBadge />
                                    : option.categoryName
                                        ? <CategoryHint name={option.categoryName} />
                                        : undefined
                            }
                            selectedIcon={option.isSeparator ? undefined : ({ isSelected }) => <SelectionMarker isSelected={Boolean(isSelected)} />}
                            classNames={{
                                base: option.isSeparator
                                    ? 'min-h-[30px] cursor-default rounded-none border-0 bg-transparent px-2 py-1 opacity-80'
                                    : `min-h-[46px] items-center rounded-xl border px-3 py-2 data-[hover=true]:bg-white/[0.04] ${option.isCategory ? 'border-amber-300/20 bg-amber-300/[0.06]' : 'border-white/10 bg-white/[0.01]'} data-[selected=true]:border-[var(--color-primary-1)] data-[selected=true]:bg-[var(--color-primary-1)]/[0.08]`,
                                wrapper: option.isSeparator ? 'min-w-0 flex flex-1 items-center justify-center overflow-hidden' : 'min-w-0 flex flex-1 items-center justify-start overflow-hidden',
                                title: option.isSeparator ? 'truncate text-[10px] font-bold uppercase tracking-[0.2em] text-white/25' : option.isCategory ? 'truncate text-sm font-bold tracking-wide text-amber-100' : 'truncate text-sm font-medium text-white/90',
                                selectedIcon: option.isSeparator ? 'hidden' : 'order-[-1] mr-2 ml-0 flex h-6 w-6 shrink-0 items-center justify-center self-center'
                            }}
                        >
                            {option.name}
                        </AutocompleteItem>
                    )}
                </Autocomplete>
            </div>
        </div>
    );
}

export const SectionCard = AnimatedCard;
export const SelectField = InteractiveSelect;
export const ToggleField = SmoothToggle;
