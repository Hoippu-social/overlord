'use client';
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
    Breadcrumbs, BreadcrumbItem, Button, Chip, Pagination,
    Table, TableBody, TableCell, TableColumn, TableHeader, TableRow
} from '@nextui-org/react';
import { Scroll, ArrowSquareOut } from '@phosphor-icons/react';
import { useGuildLocale } from '@/lib/i18n';
import { EmptyState } from '@/components/tickets/primitives';

type Ticket = {
    id: number;
    number: number;
    authorId: string;
    status: string;
    closedAt: string | null;
    transcriptToken: string | null;
    category: { name: string } | null;
};

const PAGE_SIZE = 20;

export default function TranscriptsPage() {
    const { guildId } = useParams<{ guildId: string }>();
    const { locale } = useGuildLocale(guildId);
    const copy = locale === 'ru' ? {
        tickets: 'Тикеты', title: 'Архив тикетов', empty: 'Закрытых тикетов пока нет', emptyHint: 'После закрытия обращения его транскрипт появится здесь.',
        category: 'Категория', author: 'Автор', closed: 'Закрыт', transcript: 'Транскрипт', view: 'Открыть', unavailable: 'Недоступен', table: 'Архив тикетов',
    } : {
        tickets: 'Tickets', title: 'Ticket archive', empty: 'No closed tickets yet', emptyHint: 'A transcript will appear here after a ticket is closed.',
        category: 'Category', author: 'Author', closed: 'Closed', transcript: 'Transcript', view: 'Open', unavailable: 'Unavailable', table: 'Ticket archive',
    };
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async (p: number) => {
        setLoading(true);
        try {
            const res = await fetch(`/api/guilds/${guildId}/tickets/list?status=CLOSED&page=${p}&limit=${PAGE_SIZE}`);
            if (!res.ok) return;
            const data = await res.json() as { tickets: Ticket[]; total: number };
            setTickets(data.tickets);
            setTotal(data.total);
        } finally {
            setLoading(false);
        }
    }, [guildId]);

    useEffect(() => { void load(page); }, [load, page]);

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    return (
        <div className="tickets-surface relative mx-auto w-full max-w-[1320px] space-y-6 pb-16 animate-fade-in">
            <div aria-hidden className="pointer-events-none absolute -inset-x-8 -top-20 -z-10 h-[420px]">
                <div className="absolute right-[8%] top-4 h-72 w-72 rounded-full bg-[var(--color-primary-2)] opacity-[0.055] blur-[110px]" />
                <div
                    className="absolute inset-0"
                    style={{
                        backgroundImage: 'radial-gradient(rgba(244,241,238,0.045) 1px, transparent 1.2px)',
                        backgroundSize: '26px 26px',
                        maskImage: 'radial-gradient(ellipse 75% 60% at 50% 20%, black 10%, transparent 80%)',
                        WebkitMaskImage: 'radial-gradient(ellipse 75% 60% at 50% 20%, black 10%, transparent 80%)',
                    }}
                />
            </div>

            <Breadcrumbs size="sm" classNames={{ list: 'text-[var(--text-muted)]' }}>
                <BreadcrumbItem href={`/dashboard/${guildId}/tickets`}>{copy.tickets}</BreadcrumbItem>
                <BreadcrumbItem>{copy.title}</BreadcrumbItem>
            </Breadcrumbs>

            <div className="flex items-center gap-4">
                <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-[var(--color-primary-2)]/30 bg-[linear-gradient(135deg,rgba(143,94,255,0.16),rgba(117,241,106,0.08))] text-[var(--color-primary-2)] shadow-[0_0_36px_rgba(143,94,255,0.18)]">
                    <span aria-hidden className="absolute inset-0 rounded-2xl border border-[var(--color-primary-2)]/15" style={{ animation: 'tkPulseRing 3.2s cubic-bezier(0,0,0.2,1) infinite' }} />
                    <Scroll size={28} weight="duotone" />
                </div>
                <h1 className="font-sans text-xl font-bold tracking-tight text-white sm:font-akony sm:text-2xl sm:font-black">{copy.title}</h1>
            </div>

            <div className="relative overflow-hidden rounded-[20px] border border-white/[0.06] bg-[linear-gradient(180deg,rgba(244,241,238,0.03),rgba(244,241,238,0.01))] shadow-[0_16px_40px_-24px_rgba(0,0,0,0.8)]" data-tour="tickets-transcripts-table">
                <span aria-hidden className="pointer-events-none absolute inset-x-4 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(143,94,255,0.4),transparent)]" />
                {loading ? (
                    <div className="flex flex-col items-center justify-center gap-5 py-16">
                        <div className="relative flex h-16 w-16 items-center justify-center">
                            <span className="absolute inset-0 rounded-full border border-[var(--color-primary-2)]/25" style={{ animation: 'tkPulseRing 1.8s cubic-bezier(0,0,0.2,1) infinite' }} />
                            <span className="h-9 w-9 animate-spin rounded-full border-2 border-[var(--color-primary-2)]/15 border-t-[var(--color-primary-2)]" />
                        </div>
                    </div>
                ) : tickets.length === 0 ? (
                    <div className="p-4"><EmptyState title={copy.empty} hint={copy.emptyHint} icon={<Scroll size={26} weight="light" />} /></div>
                ) : (
                    <div className="overflow-x-auto">
                    <Table
                        removeWrapper
                        aria-label={copy.table}
                        classNames={{
                            th: 'bg-white/[0.02] font-akony text-[9px] uppercase tracking-[0.16em] text-white/35',
                            td: 'border-b border-white/[0.03] py-3',
                        }}
                    >
                        <TableHeader>
                            <TableColumn>#</TableColumn>
                            <TableColumn>{copy.category}</TableColumn>
                            <TableColumn>{copy.author}</TableColumn>
                            <TableColumn>{copy.closed}</TableColumn>
                            <TableColumn>{copy.transcript}</TableColumn>
                        </TableHeader>
                        <TableBody>
                            {tickets.map((t) => (
                                <TableRow key={t.id} className="transition-colors hover:bg-white/[0.02]">
                                    <TableCell className="font-akony text-xs text-white/70">#{t.number}</TableCell>
                                    <TableCell className="font-sans text-sm font-semibold text-white/85">{t.category?.name ?? '—'}</TableCell>
                                    <TableCell className="font-mono text-xs text-[var(--text-secondary)]">{t.authorId}</TableCell>
                                    <TableCell className="text-sm text-[var(--text-muted)] tabular-nums">
                                        {t.closedAt ? new Date(t.closedAt).toLocaleDateString(locale === 'ru' ? 'ru-RU' : 'en-US') : '—'}
                                    </TableCell>
                                    <TableCell>
                                        {t.transcriptToken ? (
                                            <Button
                                                as="a"
                                                href={`/transcripts/${t.transcriptToken}`}
                                                target="_blank"
                                                size="sm"
                                                variant="flat"
                                                endContent={<ArrowSquareOut size={14} />}
                                                className="rounded-full border border-[var(--color-primary-2)]/30 bg-[var(--color-primary-2)]/10 text-xs font-bold text-[#c4b5fd] transition-shadow hover:shadow-[0_0_18px_rgba(143,94,255,0.2)]"
                                            >
                                                {copy.view}
                                            </Button>
                                        ) : (
                                            <Chip size="sm" variant="flat" className="border border-white/[0.07] bg-white/[0.04] text-xs text-[var(--text-muted)]">{copy.unavailable}</Chip>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                    </div>
                )}
            </div>

            {totalPages > 1 && (
                <div className="mt-4 flex justify-center">
                    <Pagination total={totalPages} page={page} onChange={setPage} color="secondary" />
                </div>
            )}
        </div>
    );
}
