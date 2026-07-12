'use client';

import React, { useState } from 'react';
import { ShieldCheck, UsersFour, Password, Eye, Lock } from '@phosphor-icons/react';
import type { LocaleCode } from '@/lib/i18n';
import { getTicketsCopy } from '@/lib/tickets/i18n';
import { MultiSelectField } from '@/components/moderation/ui';
import { FloatingSaveBar } from '@/components/common/FloatingSaveBar';
import type { DiscordRoleRef, PermissionAssignment, PermissionRoleKey } from '@/lib/tickets/types';
import { SectionHeading, TermHint } from './primitives';

interface AccessPanelProps {
    permissions: PermissionAssignment[];
    roles: DiscordRoleRef[];
    locale: LocaleCode;
    onSave: (permissions: PermissionAssignment[]) => Promise<void>;
}

const ROLE_ORDER: PermissionRoleKey[] = ['support_admin', 'support_agent', 'category_owner', 'viewer'];

const ROLE_ICON: Record<PermissionRoleKey, React.ReactNode> = {
    support_admin: <ShieldCheck size={18} weight="duotone" />,
    support_agent: <UsersFour size={18} weight="duotone" />,
    category_owner: <Password size={18} weight="duotone" />,
    viewer: <Eye size={18} weight="duotone" />,
};

const ROLE_ACCENT: Record<PermissionRoleKey, string> = {
    support_admin: 'var(--color-primary-1)',
    support_agent: 'var(--color-primary-2)',
    category_owner: 'var(--color-warning)',
    viewer: 'var(--text-muted)',
};

export function AccessPanel({ permissions, roles, locale, onSave }: AccessPanelProps) {
    const t = getTicketsCopy(locale);
    const [draft, setDraft] = useState<PermissionAssignment[]>(permissions);
    const [dirty, setDirty] = useState(false);
    const [saving, setSaving] = useState(false);

    const roleOptions = roles.map((r) => ({ id: r.id, name: r.name, color: typeof r.color === 'string' ? r.color : undefined }));

    const update = (role: PermissionRoleKey, ids: string[]) => {
        setDraft((prev) => prev.map((p) => (p.role === role ? { ...p, discordRoleIds: ids } : p)));
        setDirty(true);
    };
    const save = async () => {
        setSaving(true);
        try {
            await onSave(draft);
            setDirty(false);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-5 animate-fade-in">
            <SectionHeading icon={<ShieldCheck weight="duotone" />} title={<span className="inline-flex items-center">{t.access.heading}<TermHint explanation={t.terms.supportRoles} /></span>} desc={t.access.desc} />

            {/* Default admin notice */}
            <div className="flex items-center gap-3 rounded-2xl border border-[var(--color-primary-1)]/25 bg-[linear-gradient(90deg,rgba(117,241,106,0.08),rgba(117,241,106,0.02))] px-4 py-3 shadow-[0_0_24px_rgba(117,241,106,0.07)]">
                <Lock size={18} weight="duotone" className="shrink-0 text-[var(--color-primary-1)]" />
                <p className="text-sm font-semibold text-white">{t.access.defaultAdmin}</p>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {ROLE_ORDER.map((roleKey) => {
                    const assignment = draft.find((p) => p.role === roleKey) ?? { role: roleKey, discordRoleIds: [] };
                    const accent = ROLE_ACCENT[roleKey];
                    return (
                        <div key={roleKey} className="relative overflow-hidden rounded-[20px] border border-white/[0.06] bg-[linear-gradient(180deg,rgba(244,241,238,0.035),rgba(244,241,238,0.012))] p-5 shadow-[0_16px_40px_-24px_rgba(0,0,0,0.8)] transition-colors duration-300 hover:border-white/[0.1]">
                            <span
                                aria-hidden
                                className="pointer-events-none absolute inset-x-4 top-0 h-px"
                                style={{ background: `linear-gradient(90deg, transparent, color-mix(in srgb, ${accent} 50%, transparent), transparent)` }}
                            />
                            <div className="mb-4 flex items-start gap-3">
                                <span
                                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                                    style={{
                                        backgroundColor: `color-mix(in srgb, ${accent} 13%, transparent)`,
                                        color: accent,
                                        boxShadow: `0 0 22px color-mix(in srgb, ${accent} 20%, transparent)`,
                                    }}
                                >
                                    {ROLE_ICON[roleKey]}
                                </span>
                                <div className="min-w-0">
                                    <h3 className="inline-flex items-center font-sans text-sm font-bold text-white">{t.permissionRoles[roleKey]}<TermHint explanation={t.terms.supportRoles} /></h3>
                                    <p className="mt-0.5 text-xs leading-relaxed text-[var(--text-muted)]">{t.permissionDesc[roleKey]}</p>
                                </div>
                            </div>

                            <div className="mb-1 inline-flex items-center text-xs font-semibold text-[var(--text-muted)]">{t.access.discordRoles}<TermHint explanation={t.terms.discordRole} /></div>
                            <MultiSelectField
                                label=""
                                options={roleOptions}
                                selected={assignment.discordRoleIds}
                                onChange={(ids) => update(roleKey, ids)}
                                placeholder={t.access.assignRoles}
                            />
                        </div>
                    );
                })}
            </div>

            <FloatingSaveBar
                visible={dirty}
                saving={saving}
                saveLabel={t.save}
                savingLabel={t.saving}
                resetLabel={t.reset}
                onSave={save}
                onReset={() => { setDraft(permissions); setDirty(false); }}
            />
        </div>
    );
}
