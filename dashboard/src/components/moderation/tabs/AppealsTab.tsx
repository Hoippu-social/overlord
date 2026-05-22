'use client';

import React, { useMemo, useState } from 'react';
import { Checks, FlowArrow, ShieldCheck, Ticket, WarningCircle } from '@phosphor-icons/react';
import { AppealReviewDecision, AppealTicketState, ConfigState } from '@/app/dashboard/[guildId]/moderation/types';
import { APPEAL_REVIEW_OPTIONS, formatDate } from '@/app/dashboard/[guildId]/moderation/constants';
import { InteractiveSelect, MultiSelectField, SectionCard, TextAreaField, TextField, ToggleField } from '@/components/moderation/ui';
import DiscordMessagePreview, { MessagePayload } from '@/components/tickets/DiscordMessagePreview';
import { buildChannelSelectOptions } from '@/lib/channelSelectOptions';

interface AppealsTabProps {
    config: ConfigState;
    setConfig: React.Dispatch<React.SetStateAction<ConfigState>>;
    appealState: AppealTicketState;
    locale: 'en' | 'ru';
    tr: (ru: string, en: string) => string;
}

function SummaryCard({ title, value, tone, icon }: { title: string; value: number; tone: string; icon: React.ReactNode }) {
    return (
        <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5 shadow-[0_12px_40px_rgba(0,0,0,0.25)]">
            <div className="mb-4 flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/40">{title}</span>
                <span className={tone}>{icon}</span>
            </div>
            <div className="font-akony text-3xl leading-none text-white">{value}</div>
        </div>
    );
}

export function AppealsTab({ config, setConfig, appealState, locale, tr }: AppealsTabProps) {
    const [reviewingId, setReviewingId] = useState<number | null>(null);
    const [reviewNote, setReviewNote] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const updateAppealConfig = <K extends keyof ConfigState['appealConfig']>(key: K, value: ConfigState['appealConfig'][K]) => {
        setConfig((prev) => ({
            ...prev,
            appealConfig: {
                ...prev.appealConfig,
                [key]: value,
            },
        }));
    };

    const updateNested = <K extends 'dedicatedPanel' | 'sharedPlacement' | 'firstEmbed'>(
        section: K,
        value: ConfigState['appealConfig'][K],
    ) => updateAppealConfig(section, value);

    const updateQuestion = (index: number, updates: Partial<ConfigState['appealConfig']['intakeQuestions'][number]>) => {
        updateAppealConfig('intakeQuestions', config.appealConfig.intakeQuestions.map((question, questionIndex) => (
            questionIndex === index ? { ...question, ...updates } : question
        )));
    };

    const handleAction = async (ticketId: number, decision: AppealReviewDecision) => {
        setSubmitting(true);
        try {
            const guildId = window.location.pathname.split('/')[3];
            const response = await fetch(`/api/guilds/${guildId}/moderation/appeals/review`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ticketId, decision, note: reviewNote }),
            });

            if (!response.ok) {
                throw new Error('Failed to update appeal');
            }

            window.location.reload();
        } catch (error) {
            console.error(error);
            alert(tr('\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0441\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c \u0440\u0435\u0448\u0435\u043d\u0438\u0435 \u043f\u043e \u0430\u043f\u0435\u043b\u043b\u044f\u0446\u0438\u0438.', 'Failed to save appeal review.'));
        } finally {
            setSubmitting(false);
            setReviewingId(null);
            setReviewNote('');
        }
    };

    const roleOptions = config.roles.map((role) => ({ id: role.id, name: role.name, color: role.color }));
    const channelCategories = config.channels.filter((channel) => channel.isCategory || channel.type === 4 || channel.type === 'category' || channel.type === 'GUILD_CATEGORY');
    const channelOptions = buildChannelSelectOptions({
        channels: config.channels.filter((channel) => !channel.isCategory && !channelCategories.some((category) => category.id === channel.id)),
        categories: channelCategories,
        includeCategories: true,
    }).filter((channel) => channel.isCategory || [0, 5, 11, 12, 15, 16, 'text', 'announcement', 'news', 'public_thread', 'private_thread', 'forum', 'media'].includes(channel.type ?? 'text'));
    const punishmentTypeOptions = [
        { id: 'WARN', name: tr('\u041f\u0440\u0435\u0434\u0443\u043f\u0440\u0435\u0436\u0434\u0435\u043d\u0438\u0435', 'Warn') },
        { id: 'TIMEOUT', name: tr('\u0422\u0430\u0439\u043c-\u0430\u0443\u0442', 'Timeout') },
        { id: 'MUTE', name: tr('\u041c\u0443\u0442', 'Mute') },
        { id: 'BAN', name: tr('\u0411\u0430\u043d', 'Ban') },
        { id: 'TEMPBAN', name: tr('\u0412\u0440\u0435\u043c\u0435\u043d\u043d\u044b\u0439 \u0431\u0430\u043d', 'Tempban') },
    ];

    const previewMessage = useMemo<MessagePayload>(() => ({
        content: '',
        embeds: [{
            title: config.appealConfig.firstEmbed.title.replace('{appealId}', 'A-204').replace('{caseNumber}', '15'),
            description: config.appealConfig.firstEmbed.intro,
            color: 0x60a5fa,
            fields: [
                { name: tr('\u0421\u0442\u0430\u0442\u0443\u0441', 'Status'), value: 'SUBMITTED', inline: true },
                { name: tr('\u041f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044c', 'User'), value: '@McNugget', inline: true },
                { name: tr('\u0418\u0441\u0445\u043e\u0434\u043d\u043e\u0435 \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0435', 'Original action'), value: 'TIMEOUT', inline: true },
            ],
            footer: { text: config.appealConfig.firstEmbed.footer },
        }],
    }), [config.appealConfig.firstEmbed, tr]);

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
                <SummaryCard title={tr('\u0412\u0441\u0435\u0433\u043e', 'Total')} value={appealState.summary.total} icon={<Ticket size={20} weight="duotone" />} tone="text-[var(--color-primary-1)]" />
                <SummaryCard title={tr('\u041d\u043e\u0432\u044b\u0435', 'Submitted')} value={appealState.summary.open} icon={<WarningCircle size={20} weight="duotone" />} tone="text-amber-300" />
                <SummaryCard title={tr('\u0412 \u0440\u0430\u0431\u043e\u0442\u0435', 'In review')} value={appealState.summary.inReview} icon={<ShieldCheck size={20} weight="duotone" />} tone="text-sky-300" />
                <SummaryCard title={tr('\u041e\u0434\u043e\u0431\u0440\u0435\u043d\u043e', 'Approved')} value={appealState.summary.accepted} icon={<Checks size={20} weight="duotone" />} tone="text-emerald-300" />
            </div>

            <SectionCard title={tr('\u0421\u043e\u0441\u0442\u043e\u044f\u043d\u0438\u0435 \u0438 \u043f\u0440\u0430\u0432\u0438\u043b\u0430', 'State & Policy')} subtitle={tr('\u0410\u043f\u0435\u043b\u043b\u044f\u0446\u0438\u0438 \u0438\u0441\u043f\u043e\u043b\u044c\u0437\u0443\u044e\u0442 \u043e\u0431\u0449\u0438\u0439 ticket/request engine, \u043d\u043e \u043d\u0430\u0441\u0442\u0440\u0430\u0438\u0432\u0430\u044e\u0442\u0441\u044f \u0438 \u0443\u043f\u0440\u0430\u0432\u043b\u044f\u044e\u0442\u0441\u044f \u0437\u0434\u0435\u0441\u044c, \u0432 \u043c\u043e\u0434\u0435\u0440\u0430\u0446\u0438\u0438.', 'Appeals run on the shared ticket/request engine, but are configured and managed here inside moderation.')}>
                <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                    <div className="space-y-4">
                        <ToggleField label={tr('\u041c\u043e\u0434\u0443\u043b\u044c \u0430\u043f\u0435\u043b\u043b\u044f\u0446\u0438\u0439 \u0432\u043a\u043b\u044e\u0447\u0451\u043d', 'Appeals module enabled')} checked={config.appealConfig.enabled} onChange={(value) => updateAppealConfig('enabled', value)} />
                        <ToggleField label={tr('\u0420\u0430\u0437\u0440\u0435\u0448\u0438\u0442\u044c \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044c\u0441\u043a\u0438\u0435 \u0430\u043f\u0435\u043b\u043b\u044f\u0446\u0438\u0438', 'Allow user appeals')} checked={config.appealConfig.allowUserAppeals} onChange={(value) => updateAppealConfig('allowUserAppeals', value)} />
                        <ToggleField label={tr('\u041e\u0434\u043d\u0430 \u0430\u043a\u0442\u0438\u0432\u043d\u0430\u044f \u0430\u043f\u0435\u043b\u043b\u044f\u0446\u0438\u044f \u043d\u0430 \u043a\u0435\u0439\u0441', 'One active appeal per case')} checked={config.appealConfig.oneOpenAppealPerCase} onChange={(value) => updateAppealConfig('oneOpenAppealPerCase', value)} />
                        <ToggleField label={tr('\u0420\u0430\u0437\u0440\u0435\u0448\u0438\u0442\u044c \u043f\u0440\u044f\u043c\u043e\u0435 \u043f\u043e\u043c\u0438\u043b\u043e\u0432\u0430\u043d\u0438\u0435', 'Allow direct pardon')} checked={config.appealConfig.allowDirectPardon} onChange={(value) => updateAppealConfig('allowDirectPardon', value)} />
                    </div>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <InteractiveSelect label={tr('\u041a\u0430\u043d\u0430\u043b \u0434\u043b\u044f appeal-thread', 'Appeal thread channel')} value={config.appealConfig.threadChannelId} onChange={(value) => updateAppealConfig('threadChannelId', value)} options={channelOptions} placeholder={tr('\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u0442\u0435\u043a\u0441\u0442\u043e\u0432\u044b\u0439 \u043a\u0430\u043d\u0430\u043b...', 'Select a text channel...')} />
                        <InteractiveSelect label={tr('\u041a\u0430\u043d\u0430\u043b \u043b\u043e\u0433\u043e\u0432', 'Log channel')} value={config.appealConfig.logChannelId} onChange={(value) => updateAppealConfig('logChannelId', value)} options={channelOptions} placeholder={tr('\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u043a\u0430\u043d\u0430\u043b \u0434\u043b\u044f \u043b\u043e\u0433\u043e\u0432...', 'Select a log channel...')} />
                        <TextField label={tr('\u041e\u043a\u043d\u043e \u043f\u043e\u0434\u0430\u0447\u0438 (\u0434\u043d\u0438)', 'Appeal window (days)')} value={String(config.appealConfig.appealWindowDays)} type="number" onChange={(value) => updateAppealConfig('appealWindowDays', Math.max(1, Number(value) || 14))} />
                        <TextField label={tr('SLA \u043f\u0435\u0440\u0432\u043e\u0433\u043e \u043e\u0442\u0432\u0435\u0442\u0430 (\u0447\u0430\u0441\u044b)', 'First response SLA (hours)')} value={String(config.appealConfig.firstResponseSlaHours)} type="number" onChange={(value) => updateAppealConfig('firstResponseSlaHours', Math.max(1, Number(value) || 24))} />
                        <TextField label={tr('\u0410\u0432\u0442\u043e\u0437\u0430\u043a\u0440\u044b\u0442\u0438\u0435 \u043f\u043e\u0441\u043b\u0435 \u0444\u0438\u043d\u0430\u043b\u0430 (\u0447\u0430\u0441\u044b)', 'Auto-close after final state (hours)')} value={String(config.appealConfig.autoCloseHours)} type="number" onChange={(value) => updateAppealConfig('autoCloseHours', Math.max(1, Number(value) || 72))} />
                    </div>
                </div>
            </SectionCard>

            <SectionCard title={tr('\u0420\u043e\u043b\u0438 \u0438 \u0440\u0430\u0437\u043c\u0435\u0449\u0435\u043d\u0438\u0435', 'Roles & Placement')} subtitle={tr('\u0422\u043e\u0447\u043a\u0438 \u0432\u0445\u043e\u0434\u0430 \u0438 staff-\u0440\u043e\u043b\u0438. \u0412 \u043c\u043e\u0434\u0443\u043b\u0435 \u00ab\u0422\u0438\u043a\u0435\u0442\u044b\u00bb \u0430\u043f\u0435\u043b\u043b\u044f\u0446\u0438\u044f \u0434\u043e\u043b\u0436\u043d\u0430 \u043e\u0442\u043e\u0431\u0440\u0430\u0436\u0430\u0442\u044c\u0441\u044f \u043a\u0430\u043a \u0441\u0438\u0441\u0442\u0435\u043c\u043d\u0430\u044f \u043a\u0430\u0442\u0435\u0433\u043e\u0440\u0438\u044f, \u0430 \u043d\u0435 \u043a\u0430\u043a \u043e\u0442\u0434\u0435\u043b\u044c\u043d\u044b\u0439 \u0438\u0441\u0442\u043e\u0447\u043d\u0438\u043a \u043d\u0430\u0441\u0442\u0440\u043e\u0439\u043a\u0438.', 'Entry points and staff roles. In Tickets, the appeal entry should appear as a system-managed category, not as a second source of settings.')}>
                <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                    <div className="space-y-4">
                        <MultiSelectField label={tr('Triage \u0440\u043e\u043b\u0438', 'Triage roles')} options={roleOptions} selected={config.appealConfig.triageRoleIds} onChange={(keys) => updateAppealConfig('triageRoleIds', keys)} placeholder={tr('\u041a\u0442\u043e \u0434\u0435\u043b\u0430\u0435\u0442 \u043f\u0435\u0440\u0432\u0438\u0447\u043d\u044b\u0439 \u0440\u0430\u0437\u0431\u043e\u0440...', 'Who performs first-pass triage...')} />
                        <MultiSelectField label={tr('Reviewer \u0440\u043e\u043b\u0438', 'Reviewer roles')} options={roleOptions} selected={config.appealConfig.reviewerRoleIds} onChange={(keys) => updateAppealConfig('reviewerRoleIds', keys)} placeholder={tr('\u041a\u0442\u043e \u0432\u044b\u043d\u043e\u0441\u0438\u0442 \u0444\u0438\u043d\u0430\u043b\u044c\u043d\u043e\u0435 \u0440\u0435\u0448\u0435\u043d\u0438\u0435...', 'Who makes the final decision...')} />
                        <MultiSelectField label={tr('\u0420\u043e\u043b\u0438 \u0434\u043b\u044f \u043f\u0438\u043d\u0433\u0430', 'Mention roles')} options={roleOptions} selected={config.appealConfig.mentionRoleIds} onChange={(keys) => updateAppealConfig('mentionRoleIds', keys)} placeholder={tr('\u041a\u043e\u0433\u043e \u043f\u0438\u043d\u0433\u043e\u0432\u0430\u0442\u044c \u043f\u0440\u0438 \u0441\u043e\u0437\u0434\u0430\u043d\u0438\u0438 appeal-thread...', 'Who should be pinged when an appeal thread is created...')} />
                        <MultiSelectField label={tr('\u0420\u0430\u0437\u0440\u0435\u0448\u0451\u043d\u043d\u044b\u0435 \u0442\u0438\u043f\u044b \u043d\u0430\u043a\u0430\u0437\u0430\u043d\u0438\u0439', 'Allowed punishment types')} options={punishmentTypeOptions} selected={config.appealConfig.allowedActionTypes} onChange={(keys) => updateAppealConfig('allowedActionTypes', keys)} placeholder={tr('\u041a\u0430\u043a\u0438\u0435 \u043d\u0430\u043a\u0430\u0437\u0430\u043d\u0438\u044f \u043c\u043e\u0436\u043d\u043e \u043e\u0431\u0436\u0430\u043b\u043e\u0432\u0430\u0442\u044c...', 'Which punishment types can be appealed...')} />
                    </div>

                    <div className="space-y-5 rounded-[24px] border border-white/10 bg-black/20 p-5">
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <ToggleField label={tr('\u041e\u0442\u0434\u0435\u043b\u044c\u043d\u044b\u0439 Appeal Center', 'Dedicated Appeal Center')} checked={config.appealConfig.dedicatedPanel.enabled} onChange={(value) => updateNested('dedicatedPanel', { ...config.appealConfig.dedicatedPanel, enabled: value })} />
                            <ToggleField label={tr('\u041a\u0430\u0442\u0435\u0433\u043e\u0440\u0438\u044f \u0432 \u043e\u0431\u0449\u0435\u0439 \u043f\u0430\u043d\u0435\u043b\u0438 \u0442\u0438\u043a\u0435\u0442\u043e\u0432', 'Shared ticket-panel category')} checked={config.appealConfig.sharedPlacement.enabled} onChange={(value) => updateNested('sharedPlacement', { ...config.appealConfig.sharedPlacement, enabled: value })} />
                        </div>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <InteractiveSelect label={tr('\u041a\u0430\u043d\u0430\u043b \u043e\u0442\u0434\u0435\u043b\u044c\u043d\u043e\u0439 \u043f\u0430\u043d\u0435\u043b\u0438', 'Dedicated panel channel')} value={config.appealConfig.dedicatedPanel.channelId} onChange={(value) => updateNested('dedicatedPanel', { ...config.appealConfig.dedicatedPanel, channelId: value })} options={channelOptions} placeholder={tr('\u0413\u0434\u0435 \u043f\u0443\u0431\u043b\u0438\u043a\u043e\u0432\u0430\u0442\u044c \u043e\u0442\u0434\u0435\u043b\u044c\u043d\u044b\u0439 Appeal Center...', 'Where to publish the dedicated Appeal Center...')} />
                            <InteractiveSelect label={tr('\u041a\u0430\u043d\u0430\u043b \u043e\u0431\u0449\u0435\u0439 \u043f\u0430\u043d\u0435\u043b\u0438', 'Shared panel channel')} value={config.appealConfig.sharedPlacement.channelId} onChange={(value) => updateNested('sharedPlacement', { ...config.appealConfig.sharedPlacement, channelId: value })} options={channelOptions} placeholder={tr('\u0413\u0434\u0435 \u043f\u043e\u043a\u0430\u0437\u044b\u0432\u0430\u0442\u044c \u0441\u0438\u0441\u0442\u0435\u043c\u043d\u0443\u044e \u043a\u0430\u0442\u0435\u0433\u043e\u0440\u0438\u044e \u0430\u043f\u0435\u043b\u043b\u044f\u0446\u0438\u0439...', 'Where to publish the shared appeal category...')} />
                        </div>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <TextField label={tr('\u0417\u0430\u0433\u043e\u043b\u043e\u0432\u043e\u043a \u043e\u0442\u0434\u0435\u043b\u044c\u043d\u043e\u0439 \u043f\u0430\u043d\u0435\u043b\u0438', 'Dedicated panel title')} value={config.appealConfig.dedicatedPanel.title} onChange={(value) => updateNested('dedicatedPanel', { ...config.appealConfig.dedicatedPanel, title: value })} />
                            <TextField label={tr('\u041a\u043d\u043e\u043f\u043a\u0430 \u043e\u0442\u0434\u0435\u043b\u044c\u043d\u043e\u0439 \u043f\u0430\u043d\u0435\u043b\u0438', 'Dedicated panel button')} value={config.appealConfig.dedicatedPanel.buttonLabel} onChange={(value) => updateNested('dedicatedPanel', { ...config.appealConfig.dedicatedPanel, buttonLabel: value })} />
                        </div>
                        <TextAreaField label={tr('\u041e\u043f\u0438\u0441\u0430\u043d\u0438\u0435 \u043e\u0442\u0434\u0435\u043b\u044c\u043d\u043e\u0439 \u043f\u0430\u043d\u0435\u043b\u0438', 'Dedicated panel description')} value={config.appealConfig.dedicatedPanel.description} onChange={(value) => updateNested('dedicatedPanel', { ...config.appealConfig.dedicatedPanel, description: value })} rows={3} />
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                            <TextField label={tr('\u042f\u0440\u043b\u044b\u043a \u043e\u0431\u0449\u0435\u0439 \u043a\u0430\u0442\u0435\u0433\u043e\u0440\u0438\u0438', 'Shared category label')} value={config.appealConfig.sharedPlacement.label} onChange={(value) => updateNested('sharedPlacement', { ...config.appealConfig.sharedPlacement, label: value })} />
                            <TextField label={tr('Emoji \u043e\u0431\u0449\u0435\u0439 \u043a\u0430\u0442\u0435\u0433\u043e\u0440\u0438\u0438', 'Shared category emoji')} value={config.appealConfig.sharedPlacement.emoji} onChange={(value) => updateNested('sharedPlacement', { ...config.appealConfig.sharedPlacement, emoji: value })} />
                            <TextField label={tr('\u041f\u043e\u0440\u044f\u0434\u043e\u043a \u0432 \u043c\u0435\u043d\u044e', 'Menu order')} value={String(config.appealConfig.sharedPlacement.sortOrder)} type="number" onChange={(value) => updateNested('sharedPlacement', { ...config.appealConfig.sharedPlacement, sortOrder: Math.max(0, Number(value) || 0) })} />
                        </div>
                        <TextAreaField label={tr('\u041e\u043f\u0438\u0441\u0430\u043d\u0438\u0435 \u043e\u0431\u0449\u0435\u0439 \u043a\u0430\u0442\u0435\u0433\u043e\u0440\u0438\u0438', 'Shared category description')} value={config.appealConfig.sharedPlacement.description} onChange={(value) => updateNested('sharedPlacement', { ...config.appealConfig.sharedPlacement, description: value })} rows={2} />
                    </div>
                </div>
            </SectionCard>

            <SectionCard title={tr('\u041f\u043e\u0434\u0430\u0447\u0430 \u0438 \u043f\u0435\u0440\u0432\u044b\u0439 embed', 'Intake & First Embed')} subtitle={tr('\u0417\u0434\u0435\u0441\u044c \u0437\u0430\u0434\u0430\u044e\u0442\u0441\u044f \u0432\u043e\u043f\u0440\u043e\u0441\u044b intake \u0438 \u0441\u043e\u0434\u0435\u0440\u0436\u0438\u043c\u043e\u0435 \u043f\u0435\u0440\u0432\u043e\u0433\u043e pinned embed \u0432 appeal-thread.', 'Define intake questions and the first pinned embed shown in the appeal thread here.')}>
                <div className="grid grid-cols-1 gap-8 xl:grid-cols-[1.3fr_1fr]">
                    <div className="space-y-5">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-sm font-bold text-white">{tr('\u0412\u043e\u043f\u0440\u043e\u0441\u044b intake-\u0444\u043e\u0440\u043c\u044b', 'Intake questions')}</h3>
                                <p className="mt-1 text-xs text-white/45">{tr('\u041e\u043d\u0438 \u0437\u0430\u0434\u0430\u044e\u0442\u0441\u044f \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044e \u0434\u043e \u0441\u043e\u0437\u0434\u0430\u043d\u0438\u044f thread.', 'These questions are asked before the thread is created.')}</p>
                            </div>
                            <button type="button" onClick={() => updateAppealConfig('intakeQuestions', [...config.appealConfig.intakeQuestions, { id: `question_${config.appealConfig.intakeQuestions.length + 1}`, label: tr('\u041d\u043e\u0432\u044b\u0439 \u0432\u043e\u043f\u0440\u043e\u0441', 'New question'), placeholder: '', required: true, long: false }])} className="rounded-xl border border-[#7AAA7A]/40 bg-[#7AAA7A]/10 px-3 py-2 text-xs font-bold text-[#9AD49A] transition-colors hover:bg-[#7AAA7A]/20">{tr('\u0414\u043e\u0431\u0430\u0432\u0438\u0442\u044c \u0432\u043e\u043f\u0440\u043e\u0441', 'Add question')}</button>
                        </div>
                        {config.appealConfig.intakeQuestions.map((question, index) => (
                            <div key={question.id} className="space-y-4 rounded-[20px] border border-white/10 bg-white/[0.03] p-4">
                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                    <TextField label={tr('\u0422\u0435\u043a\u0441\u0442 \u0432\u043e\u043f\u0440\u043e\u0441\u0430', 'Question label')} value={question.label} onChange={(value) => updateQuestion(index, { label: value })} />
                                    <TextField label="Placeholder" value={question.placeholder} onChange={(value) => updateQuestion(index, { placeholder: value })} />
                                </div>
                                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                                    <ToggleField label={tr('\u041e\u0431\u044f\u0437\u0430\u0442\u0435\u043b\u044c\u043d\u044b\u0439 \u0432\u043e\u043f\u0440\u043e\u0441', 'Required question')} checked={question.required} onChange={(value) => updateQuestion(index, { required: value })} />
                                    <ToggleField label={tr('\u0414\u043b\u0438\u043d\u043d\u044b\u0439 \u043e\u0442\u0432\u0435\u0442', 'Long answer')} checked={question.long} onChange={(value) => updateQuestion(index, { long: value })} />
                                    <button type="button" onClick={() => updateAppealConfig('intakeQuestions', config.appealConfig.intakeQuestions.filter((_, questionIndex) => questionIndex !== index))} className="h-11 rounded-xl border border-rose-400/25 bg-rose-500/10 text-sm font-bold text-rose-300 transition-colors hover:bg-rose-500/20">{tr('\u0423\u0434\u0430\u043b\u0438\u0442\u044c', 'Remove')}</button>
                                </div>
                            </div>
                        ))}
                        <TextField label={tr('\u0417\u0430\u0433\u043e\u043b\u043e\u0432\u043e\u043a \u043f\u0435\u0440\u0432\u043e\u0433\u043e embed', 'First embed title')} value={config.appealConfig.firstEmbed.title} onChange={(value) => updateNested('firstEmbed', { ...config.appealConfig.firstEmbed, title: value })} />
                        <TextAreaField label={tr('\u0412\u0441\u0442\u0443\u043f\u0438\u0442\u0435\u043b\u044c\u043d\u044b\u0439 \u0442\u0435\u043a\u0441\u0442', 'Intro text')} value={config.appealConfig.firstEmbed.intro} onChange={(value) => updateNested('firstEmbed', { ...config.appealConfig.firstEmbed, intro: value })} rows={3} />
                        <TextAreaField label="Footer" value={config.appealConfig.firstEmbed.footer} onChange={(value) => updateNested('firstEmbed', { ...config.appealConfig.firstEmbed, footer: value })} rows={2} />
                    </div>
                    <div className="space-y-4 rounded-[24px] border border-white/10 bg-black/20 p-5">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-sky-400/20 bg-sky-500/10 text-sky-300">
                                <FlowArrow size={18} weight="duotone" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-white">{tr('Preview \u043f\u0435\u0440\u0432\u043e\u0433\u043e embed', 'First embed preview')}</h3>
                                <p className="mt-1 text-xs text-white/45">{tr('\u042d\u0442\u043e \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435 \u0431\u0443\u0434\u0435\u0442 \u0437\u0430\u043a\u0440\u0435\u043f\u043b\u0435\u043d\u043e \u0432 appeal-thread.', 'This message will be pinned inside the appeal thread.')}</p>
                            </div>
                        </div>
                        <DiscordMessagePreview message={previewMessage} botName={tr('\u041c\u043e\u0434\u0435\u0440\u0430\u0446\u0438\u044f', 'Moderation')} />
                    </div>
                </div>
            </SectionCard>

            <SectionCard title={tr('\u041e\u0447\u0435\u0440\u0435\u0434\u044c \u0430\u043f\u0435\u043b\u043b\u044f\u0446\u0438\u0439', 'Appeal Queue')} subtitle={tr('\u041c\u043e\u043d\u0438\u0442\u043e\u0440\u0438\u043d\u0433 \u0438 staff-\u0440\u0435\u0448\u0435\u043d\u0438\u044f \u043e\u0441\u0442\u0430\u044e\u0442\u0441\u044f \u0437\u0434\u0435\u0441\u044c, \u0432 \u043c\u043e\u0434\u0435\u0440\u0430\u0446\u0438\u0438.', 'Monitoring and staff decisions remain here in moderation.')}>
                {appealState.tickets.length === 0 ? (
                    <div className="rounded-[24px] border border-dashed border-white/10 bg-white/[0.02] px-6 py-12 text-center text-sm text-white/45">{tr('\u0410\u043a\u0442\u0438\u0432\u043d\u044b\u0445 appeal-ticket \u0441\u0435\u0439\u0447\u0430\u0441 \u043d\u0435\u0442.', 'There are no active appeal tickets right now.')}</div>
                ) : (
                    <div className="space-y-4">
                        {appealState.tickets.map((ticket) => {
                            const isOpen = ticket.status === 'OPEN' || ticket.status === 'IN_REVIEW';
                            const isReviewing = reviewingId === ticket.id;
                            return (
                                <div key={ticket.id} className="grid grid-cols-1 gap-5 rounded-[24px] border border-white/10 bg-white/[0.03] p-5 xl:grid-cols-[1.35fr_0.95fr]">
                                    <div className="space-y-4">
                                        <div className="flex flex-wrap items-center gap-3">
                                            <span className="font-akony text-xl text-white">#{ticket.id}</span>
                                            <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-white/55">{ticket.status}</span>
                                            <span className="text-xs text-white/35">{formatDate(ticket.createdAt)}</span>
                                        </div>
                                        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                                            <div className="rounded-2xl border border-white/10 bg-black/20 p-4"><div className="mb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-white/35">{tr('\u041a\u0435\u0439\u0441', 'Case')}</div><div className="text-sm font-semibold text-white">#{ticket.caseNumber}</div><div className="mt-1 text-xs text-white/45">{ticket.moderationCase.actionType}</div></div>
                                            <div className="rounded-2xl border border-white/10 bg-black/20 p-4"><div className="mb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-white/35">{tr('\u041f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044c', 'User')}</div><div className="text-sm font-semibold text-white">{ticket.userId}</div></div>
                                            <div className="rounded-2xl border border-white/10 bg-black/20 p-4"><div className="mb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-white/35">{tr('\u0422\u0438\u043f \u043e\u0431\u0440\u0430\u0449\u0435\u043d\u0438\u044f', 'Request type')}</div><div className="text-sm font-semibold text-white">{ticket.appealType}</div></div>
                                        </div>
                                        <div className="rounded-2xl border border-white/10 bg-black/20 p-4"><div className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-white/35">{tr('\u041f\u043e\u0437\u0438\u0446\u0438\u044f \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044f', 'User statement')}</div><p className="text-sm leading-6 text-white/80">{ticket.message}</p></div>
                                        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                                            <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-white/35">{tr('\u0422\u0430\u0439\u043c\u043b\u0430\u0439\u043d', 'Timeline')}</div>
                                            {ticket.events?.length ? (
                                                <div className="space-y-2">
                                                    {ticket.events.slice(0, 4).map((event) => (
                                                        <div key={event.id} className="flex items-start justify-between gap-4 rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2">
                                                            <div className="min-w-0">
                                                                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-white/75">{event.eventType}</div>
                                                                <div className="mt-1 text-xs text-white/45">{event.actorUserId || tr('\u0421\u0438\u0441\u0442\u0435\u043c\u0430', 'System')}</div>
                                                                {event.note ? <div className="mt-1 text-xs leading-5 text-white/60">{event.note}</div> : null}
                                                            </div>
                                                            <div className="shrink-0 text-[11px] text-white/35">{formatDate(event.createdAt)}</div>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="text-sm text-white/45">{tr('\u0421\u043e\u0431\u044b\u0442\u0438\u044f \u0435\u0449\u0451 \u043d\u0435 \u0437\u0430\u043f\u0438\u0441\u0430\u043d\u044b.', 'No timeline events yet.')}</div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="space-y-4">
                                        {!isOpen ? (
                                            <div className="rounded-[20px] border border-white/10 bg-black/20 p-5"><div className="mb-2 flex items-center gap-2 text-white"><ShieldCheck size={18} weight="duotone" className="text-[#7AAA7A]" /><span className="font-bold">{tr('\u0420\u0435\u0448\u0435\u043d\u0438\u0435 \u0443\u0436\u0435 \u043f\u0440\u0438\u043d\u044f\u0442\u043e', 'Decision already recorded')}</span></div><div className="space-y-2 text-sm text-white/55"><div>{tr('\u0421\u0442\u0430\u0442\u0443\u0441', 'Status')}: {ticket.status}</div><div>{tr('\u0420\u0435\u0432\u044c\u044e\u0435\u0440', 'Reviewer')}: {ticket.reviewerId || tr('\u041d\u0435 \u0443\u043a\u0430\u0437\u0430\u043d', 'Not set')}</div><div>{tr('\u0417\u0430\u043c\u0435\u0442\u043a\u0430', 'Note')}: {ticket.resolutionNote || tr('\u0411\u0435\u0437 \u0437\u0430\u043c\u0435\u0442\u043a\u0438', 'No note')}</div></div></div>
                                        ) : (
                                            <div className="rounded-[20px] border border-white/10 bg-black/20 p-5">
                                                <TextAreaField label={tr('\u041f\u043e\u044f\u0441\u043d\u0435\u043d\u0438\u0435 staff', 'Staff note')} value={isReviewing ? reviewNote : ''} onChange={isReviewing ? setReviewNote : () => setReviewingId(ticket.id)} placeholder={tr('\u0427\u0442\u043e \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044c \u0434\u043e\u043b\u0436\u0435\u043d \u0437\u043d\u0430\u0442\u044c \u043e \u0432\u0430\u0448\u0435\u043c \u0440\u0435\u0448\u0435\u043d\u0438\u0438?', 'What should the user know about your decision?')} rows={4} />
                                                <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2">
                                                    {APPEAL_REVIEW_OPTIONS.map((decision) => (
                                                        <button key={decision} type="button" disabled={submitting} onClick={() => { setReviewingId(ticket.id); void handleAction(ticket.id, decision); }} className={`rounded-xl border px-3 py-2 text-xs font-bold uppercase tracking-[0.14em] transition-colors ${decision === 'REJECTED' ? 'border-rose-400/25 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20' : decision === 'ACCEPTED' || decision === 'PARDONED' ? 'border-emerald-400/25 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20' : 'border-sky-400/25 bg-sky-500/10 text-sky-300 hover:bg-sky-500/20'}`}>
                                                            {locale === 'ru' ? ({ IN_REVIEW: '\u0412 \u0440\u0430\u0431\u043e\u0442\u0443', ACCEPTED: '\u041e\u0434\u043e\u0431\u0440\u0438\u0442\u044c', REJECTED: '\u041e\u0442\u043a\u043b\u043e\u043d\u0438\u0442\u044c', PARDONED: '\u041f\u043e\u043c\u0438\u043b\u043e\u0432\u0430\u0442\u044c' } as Record<AppealReviewDecision, string>)[decision] : decision}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </SectionCard>
        </div>
    );
}
