'use client';
import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
    Breadcrumbs, BreadcrumbItem, Button, Card, CardBody,
    CardHeader, Chip, Divider, Input, Select, SelectItem, Spinner, Textarea
} from '@nextui-org/react';
import { ArrowLeft, ArrowSquareOut } from '@phosphor-icons/react';
import { useGuildLocale } from '@/lib/i18n';

type Ticket = {
    id: number;
    number: number;
    authorId: string;
    claimedBy: string | null;
    responsibleUserId: string | null;
    previousResponsibleUserId: string | null;
    transferState: string;
    transferRequestedBy: string | null;
    transferRequestedTo: string | null;
    status: string;
    formAnswers: string | null;
    closeReason: string | null;
    closedBy: string | null;
    closedAt: string | null;
    transcriptToken: string | null;
    createdAt: string;
    category: { id: number; name: string } | null;
    priorityId: number | null;
    priority: Priority | null;
    transferRequests: TransferRequest[];
    internalNotes: InternalNote[];
};

type Event = {
    id: number;
    eventType: string;
    actorUserId: string | null;
    note: string | null;
    createdAt: string;
};

type Priority = {
    id: number;
    key: string;
    name: string;
    color: string;
};

type TransferRequest = {
    id: number;
    fromUserId: string;
    toUserId: string;
    status: string;
    note: string | null;
    requestedAt: string;
    expiresAt: string;
};

type InternalNote = {
    id: number;
    authorId: string;
    body: string;
    createdAt: string;
};

const STATUS_COLOR: Record<string, 'success' | 'warning' | 'default'> = {
    OPEN: 'success',
    ON_HOLD: 'warning',
    CLOSED: 'default',
};

const MESSAGES = {
    en: {
        tickets: 'Tickets',
        liveTickets: 'Live Tickets',
        ticket: 'Ticket',
        info: 'Info',
        category: 'Category',
        priority: 'Priority',
        normal: 'Normal',
        author: 'Author',
        claimedBy: 'Claimed By',
        responsible: 'Responsible',
        transfer: 'Transfer',
        created: 'Created',
        closedBy: 'Closed By',
        closedAt: 'Closed At',
        reason: 'Reason',
        formAnswers: 'Form Answers',
        actions: 'Actions',
        close: 'Close',
        reopen: 'Reopen',
        claim: 'Claim',
        resume: 'Resume',
        hold: 'Hold',
        transcript: 'Transcript',
        assignment: 'Assignment',
        transferToUser: 'Transfer to Discord user ID',
        requestTransfer: 'Request Transfer',
        transferNote: 'Transfer note',
        pendingTransferTo: 'Pending transfer to',
        from: 'from',
        expires: 'expires',
        accept: 'Accept',
        decline: 'Decline',
        internalNotes: 'Internal Notes',
        newNote: 'New note',
        saveNote: 'Save Note',
        timeline: 'Timeline',
        by: 'by',
    },
    ru: {
        tickets: 'Тикеты',
        liveTickets: 'Живые тикеты',
        ticket: 'Тикет',
        info: 'Информация',
        category: 'Категория',
        priority: 'Приоритет',
        normal: 'Обычный',
        author: 'Автор',
        claimedBy: 'Взял в работу',
        responsible: 'Ответственный',
        transfer: 'Передача',
        created: 'Создан',
        closedBy: 'Закрыл',
        closedAt: 'Закрыт',
        reason: 'Причина',
        formAnswers: 'Ответы формы',
        actions: 'Действия',
        close: 'Закрыть',
        reopen: 'Переоткрыть',
        claim: 'Взять',
        resume: 'Возобновить',
        hold: 'Пауза',
        transcript: 'Транскрипт',
        assignment: 'Назначение',
        transferToUser: 'Передать Discord user ID',
        requestTransfer: 'Запросить передачу',
        transferNote: 'Комментарий к передаче',
        pendingTransferTo: 'Ожидает передачи пользователю',
        from: 'от',
        expires: 'истекает',
        accept: 'Принять',
        decline: 'Отклонить',
        internalNotes: 'Внутренние заметки',
        newNote: 'Новая заметка',
        saveNote: 'Сохранить заметку',
        timeline: 'Таймлайн',
        by: 'от',
    },
} as const;

export default function TicketDetailPage() {
    const { guildId, ticketId } = useParams<{ guildId: string; ticketId: string }>();
    const router = useRouter();
    const { locale } = useGuildLocale(guildId);
    const t = MESSAGES[locale as keyof typeof MESSAGES] || MESSAGES.en;
    const [ticket, setTicket] = useState<Ticket | null>(null);
    const [events, setEvents] = useState<Event[]>([]);
    const [priorities, setPriorities] = useState<Priority[]>([]);
    const [actorId, setActorId] = useState<string | null>(null);
    const [transferTo, setTransferTo] = useState('');
    const [transferNote, setTransferNote] = useState('');
    const [noteBody, setNoteBody] = useState('');
    const [loading, setLoading] = useState(true);
    const [acting, setActing] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/guilds/${guildId}/tickets/items/${ticketId}`);
            if (!res.ok) { router.back(); return; }
            const data = await res.json() as { ticket: Ticket; events: Event[]; priorities: Priority[]; actorId: string };
            setTicket(data.ticket);
            setEvents(data.events);
            setPriorities(data.priorities);
            setActorId(data.actorId);
        } finally {
            setLoading(false);
        }
    }, [guildId, ticketId, router]);

    useEffect(() => { void load(); }, [load]);

    const doAction = async (action: string, reason?: string, extra: Record<string, unknown> = {}) => {
        setActing(true);
        try {
            await fetch(`/api/guilds/${guildId}/tickets/items/${ticketId}/action`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, reason, ...extra }),
            });
            await load();
        } finally {
            setActing(false);
        }
    };

    const changePriority = async (priorityId: string) => {
        if (!priorityId) return;
        await doAction('priority', undefined, { priorityId: Number(priorityId) });
    };

    const requestTransfer = async () => {
        if (!transferTo.trim()) return;
        await doAction('transfer', undefined, { toUserId: transferTo.trim(), note: transferNote.trim() || undefined });
        setTransferTo('');
        setTransferNote('');
    };

    const resolveTransfer = async (requestId: number, accept: boolean) => {
        await doAction(accept ? 'transfer_accept' : 'transfer_decline', undefined, { requestId });
    };

    const saveNote = async () => {
        if (!noteBody.trim()) return;
        await doAction('note', undefined, { note: noteBody.trim() });
        setNoteBody('');
    };

    if (loading) return <div className="flex justify-center py-32"><Spinner color="primary" /></div>;
    if (!ticket) return null;

    let formAnswers: { label: string; answer: string }[] = [];
    try { formAnswers = ticket.formAnswers ? JSON.parse(ticket.formAnswers) : []; } catch { /* noop */ }

    const isClosed = ticket.status === 'CLOSED';
    const isOnHold = ticket.status === 'ON_HOLD';

    return (
        <div className="space-y-6 pb-10 animate-fade-in max-w-3xl">
            <Breadcrumbs size="lg" className="mb-4">
                <BreadcrumbItem href={`/dashboard/${guildId}/tickets`}>{t.tickets}</BreadcrumbItem>
                <BreadcrumbItem href={`/dashboard/${guildId}/tickets/live`}>{t.liveTickets}</BreadcrumbItem>
                <BreadcrumbItem>#{ticket.number}</BreadcrumbItem>
            </Breadcrumbs>

            <div className="flex items-center gap-4">
                <Button isIconOnly variant="flat" size="sm" onPress={() => router.back()}><ArrowLeft /></Button>
                <h1 className="text-3xl font-bold text-white">{t.ticket} #{ticket.number}</h1>
                <Chip variant="flat" color={STATUS_COLOR[ticket.status] ?? 'default'}>{ticket.status}</Chip>
            </div>

            {/* Info */}
            <Card className="bg-[var(--surface-card)] border border-[var(--border-subtle)] rounded-2xl">
                <CardHeader className="text-sm font-semibold text-default-400 uppercase tracking-wider px-6 pt-5 pb-2">
                    {t.info}
                </CardHeader>
                <CardBody className="px-6 pb-6 grid grid-cols-2 gap-4 text-sm">
                    <div><span className="text-default-400">{t.category}</span><br /><span className="text-white">{ticket.category?.name ?? '-'}</span></div>
                    <div><span className="text-default-400">{t.priority}</span><br /><span className="text-white">{ticket.priority?.name ?? t.normal}</span></div>
                    <div><span className="text-default-400">{t.author}</span><br /><span className="font-mono text-xs text-white">{ticket.authorId}</span></div>
                    <div><span className="text-default-400">{t.claimedBy}</span><br /><span className="font-mono text-xs text-white">{ticket.claimedBy ?? '-'}</span></div>
                    <div><span className="text-default-400">{t.responsible}</span><br /><span className="font-mono text-xs text-white">{ticket.responsibleUserId ?? '-'}</span></div>
                    <div><span className="text-default-400">{t.transfer}</span><br /><span className="text-white">{ticket.transferState}</span></div>
                    <div><span className="text-default-400">{t.created}</span><br /><span className="text-white">{new Date(ticket.createdAt).toLocaleString()}</span></div>
                    {isClosed && (
                        <>
                            <div><span className="text-default-400">{t.closedBy}</span><br /><span className="font-mono text-xs text-white">{ticket.closedBy ?? '—'}</span></div>
                            <div><span className="text-default-400">{t.closedAt}</span><br /><span className="text-white">{ticket.closedAt ? new Date(ticket.closedAt).toLocaleString() : '—'}</span></div>
                            {ticket.closeReason && (
                                <div className="col-span-2"><span className="text-default-400">{t.reason}</span><br /><span className="text-white">{ticket.closeReason}</span></div>
                            )}
                        </>
                    )}
                </CardBody>
            </Card>

            {/* Form answers */}
            {formAnswers.length > 0 && (
                <Card className="bg-[var(--surface-card)] border border-[var(--border-subtle)] rounded-2xl">
                    <CardHeader className="text-sm font-semibold text-default-400 uppercase tracking-wider px-6 pt-5 pb-2">
                        {t.formAnswers}
                    </CardHeader>
                    <CardBody className="px-6 pb-6 space-y-4">
                        {formAnswers.map((a, i) => (
                            <div key={i}>
                                <div className="text-xs text-default-400 mb-1">{a.label}</div>
                                <div className="text-white bg-white/5 rounded-lg px-3 py-2 text-sm whitespace-pre-wrap">{a.answer || '—'}</div>
                            </div>
                        ))}
                    </CardBody>
                </Card>
            )}

            {/* Actions */}
            <Card className="bg-[var(--surface-card)] border border-[var(--border-subtle)] rounded-2xl">
                <CardHeader className="text-sm font-semibold text-default-400 uppercase tracking-wider px-6 pt-5 pb-2">
                    {t.actions}
                </CardHeader>
                <CardBody className="px-6 pb-6 flex flex-row flex-wrap gap-3">
                    {!isClosed && (
                        <Button size="sm" color="danger" variant="flat" isLoading={acting} onPress={() => doAction('close')}>
                            {t.close}
                        </Button>
                    )}
                    {isClosed && (
                        <Button size="sm" color="success" variant="flat" isLoading={acting} onPress={() => doAction('reopen')}>
                            {t.reopen}
                        </Button>
                    )}
                    {!isClosed && (
                        <>
                            <Button size="sm" variant="flat" isLoading={acting} onPress={() => doAction('claim')}>
                                {t.claim}
                            </Button>
                            {isOnHold ? (
                                <Button size="sm" variant="flat" isLoading={acting} onPress={() => doAction('resume')}>
                                    {t.resume}
                                </Button>
                            ) : (
                                <Button size="sm" variant="flat" isLoading={acting} onPress={() => doAction('hold')}>
                                    {t.hold}
                                </Button>
                            )}
                        </>
                    )}
                    {ticket.transcriptToken && (
                        <Button
                            as="a"
                            href={`/transcripts/${ticket.transcriptToken}`}
                            target="_blank"
                            size="sm"
                            color="primary"
                            variant="flat"
                            endContent={<ArrowSquareOut size={14} />}
                        >
                            {t.transcript}
                        </Button>
                    )}
                </CardBody>
            </Card>

            {!isClosed && (
                <Card className="bg-[var(--surface-card)] border border-[var(--border-subtle)] rounded-2xl">
                    <CardHeader className="text-sm font-semibold text-default-400 uppercase tracking-wider px-6 pt-5 pb-2">
                        {t.assignment}
                    </CardHeader>
                    <CardBody className="px-6 pb-6 space-y-4">
                        <Select
                            size="sm"
                            label={t.priority}
                            selectedKeys={ticket.priorityId ? new Set([String(ticket.priorityId)]) : new Set([])}
                            onSelectionChange={(keys) => {
                                const next = [...keys][0] as string | undefined;
                                if (next) void changePriority(next);
                            }}
                        >
                            {priorities.map((priority) => (
                                <SelectItem key={String(priority.id)}>{priority.name}</SelectItem>
                            ))}
                        </Select>

                        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                            <Input
                                size="sm"
                                label={t.transferToUser}
                                value={transferTo}
                                onValueChange={setTransferTo}
                            />
                            <Button size="sm" variant="flat" isLoading={acting} onPress={requestTransfer}>
                                {t.requestTransfer}
                            </Button>
                        </div>
                        <Textarea
                            size="sm"
                            label={t.transferNote}
                            minRows={2}
                            value={transferNote}
                            onValueChange={setTransferNote}
                        />

                        {ticket.transferRequests.filter((request) => request.status === 'PENDING').map((request) => (
                            <div key={request.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <div>
                                        <div className="text-sm text-white">{t.pendingTransferTo} <span className="font-mono text-xs">{request.toUserId}</span></div>
                                        <div className="text-xs text-default-400">{t.from} {request.fromUserId} | {t.expires} {new Date(request.expiresAt).toLocaleString()}</div>
                                    </div>
                                    {actorId === request.toUserId && (
                                        <div className="flex gap-2">
                                            <Button size="sm" color="success" variant="flat" isLoading={acting} onPress={() => resolveTransfer(request.id, true)}>{t.accept}</Button>
                                            <Button size="sm" color="danger" variant="flat" isLoading={acting} onPress={() => resolveTransfer(request.id, false)}>{t.decline}</Button>
                                        </div>
                                    )}
                                </div>
                                {request.note && <p className="mt-2 text-sm text-default-300">{request.note}</p>}
                            </div>
                        ))}
                    </CardBody>
                </Card>
            )}

            <Card className="bg-[var(--surface-card)] border border-[var(--border-subtle)] rounded-2xl">
                <CardHeader className="text-sm font-semibold text-default-400 uppercase tracking-wider px-6 pt-5 pb-2">
                    {t.internalNotes}
                </CardHeader>
                <CardBody className="px-6 pb-6 space-y-4">
                    <Textarea
                        size="sm"
                        label={t.newNote}
                        minRows={3}
                        value={noteBody}
                        onValueChange={setNoteBody}
                    />
                    <Button size="sm" variant="flat" isLoading={acting} onPress={saveNote}>
                        {t.saveNote}
                    </Button>
                    {ticket.internalNotes.map((note) => (
                        <div key={note.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                            <div className="mb-1 flex items-center justify-between gap-3 text-xs text-default-400">
                                <span className="font-mono">{note.authorId}</span>
                                <span>{new Date(note.createdAt).toLocaleString()}</span>
                            </div>
                            <p className="whitespace-pre-wrap text-sm text-white">{note.body}</p>
                        </div>
                    ))}
                </CardBody>
            </Card>

            {/* Timeline */}
            {events.length > 0 && (
                <Card className="bg-[var(--surface-card)] border border-[var(--border-subtle)] rounded-2xl">
                    <CardHeader className="text-sm font-semibold text-default-400 uppercase tracking-wider px-6 pt-5 pb-2">
                        {t.timeline}
                    </CardHeader>
                    <CardBody className="px-6 pb-6 space-y-3">
                        {events.map((e, i) => (
                            <div key={e.id}>
                                {i > 0 && <Divider className="my-2 opacity-10" />}
                                <div className="flex items-start gap-3">
                                    <div className="flex-1">
                                        <span className="text-xs font-semibold text-[var(--color-primary-2)]">{e.eventType}</span>
                                        {e.actorUserId && (
                                            <span className="text-xs text-default-400 ml-2">{t.by} {e.actorUserId}</span>
                                        )}
                                        {e.note && <p className="text-sm text-default-300 mt-1">{e.note}</p>}
                                    </div>
                                    <span className="text-xs text-default-500 whitespace-nowrap">
                                        {new Date(e.createdAt).toLocaleString()}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </CardBody>
                </Card>
            )}
        </div>
    );
}


