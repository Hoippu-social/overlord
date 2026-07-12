'use client';

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { signOut, useSession } from 'next-auth/react';
import { motion } from 'framer-motion';
import { CaretRight, Crown, MagnifyingGlass, SignOut } from '@phosphor-icons/react';
import { Image, Spinner } from '@nextui-org/react';
import { FastAverageColor } from 'fast-average-color';
import { getStoredLocale } from '@/lib/i18n';
import { BOT_OWNER_ID } from '@/lib/constants';
import { fetchWithTimeout } from '@/lib/requestTimeout';
import { getBrowserPublicHost, toPublicDashboardPath } from '@/lib/publicDashboard';
import { hyphenateServerName } from '@/lib/textHyphenation';
import { LoadingSkeleton } from '@/components/common/LoadingSkeleton';

interface Guild {
    id: string;
    name: string | null;
    icon: string | null;
}

const strings = {
    en: {
        loadingServers: 'Loading workspaces...',
        eyebrow: 'Workspace Routing',
        title: 'Select a Server',
        subtitle: 'Open the server you want to work with using the panels below. Many projects? Use the search field directly under this text.',
        logout: 'Logout',
        manageSettings: 'Open control surface',
        unknownServer: 'Unknown Server',
        noServers: 'No servers found. Make sure the bot is online and the sync has completed.',
        noMatches: 'No servers match the current query.',
        searchPlaceholder: 'Search servers',
        cardEyebrow: 'Command Center',
        masterModeOn: 'Master Mode On',
        masterModeOff: 'Master Mode Off',
    },
    ru: {
        loadingServers: 'Загрузка рабочих пространств...',
        eyebrow: 'Маршрутизация пространств',
        title: 'Выберите сервер',
        subtitle: 'Откройте сервер, с которым будете работать, на панелях ниже. Если проектов много, используйте строку поиска прямо под этим текстом.',
        logout: 'Выйти',
        manageSettings: 'Открыть центр управления',
        unknownServer: 'Неизвестный сервер',
        noServers: 'Упс! Кажется, у тебя ещё нет серверов. Добавь бота на свой первый и наслаждайся контролем',
        noMatches: 'По этому запросу серверы не найдены.',
        searchPlaceholder: 'Найти сервер',
        cardEyebrow: 'Command Center',
        masterModeOn: 'Мастер-режим вкл',
        masterModeOff: 'Мастер-режим выкл',
    },
} as const;

type Locale = keyof typeof strings;

function withAlpha(hex: string, alpha: string) {
    if (/^#[0-9a-f]{6}$/i.test(hex)) {
        return `${hex}${alpha}`;
    }

    return hex;
}

function AutoFitServerName({ name }: { name: string }) {
    const containerRef = useRef<HTMLHeadingElement | null>(null);
    const textRef = useRef<HTMLSpanElement | null>(null);
    const [fontSize, setFontSize] = useState(32);

    const fit = useCallback(() => {
        const container = containerRef.current;
        const text = textRef.current;

        if (!container || !text) {
            return;
        }

        const maxSize = 32;
        const minSize = 18;
        const lineHeight = 0.92;
        const allowedHeight = maxSize * lineHeight * 2.08;
        let nextSize = maxSize;

        text.style.fontSize = `${nextSize}px`;

        while ((text.scrollHeight > allowedHeight || text.scrollWidth > container.clientWidth) && nextSize > minSize) {
            nextSize -= 1;
            text.style.fontSize = `${nextSize}px`;
        }

        setFontSize(nextSize);
    }, []);

    useEffect(() => {
        const frame = requestAnimationFrame(fit);
        const observer = new ResizeObserver(() => requestAnimationFrame(fit));

        if (containerRef.current) {
            observer.observe(containerRef.current);
        }

        return () => {
            cancelAnimationFrame(frame);
            observer.disconnect();
        };
    }, [fit, name]);

    return (
        <h2
            ref={containerRef}
            className="mt-7 max-w-full overflow-hidden font-akony uppercase leading-[0.92] tracking-[0.04em] text-[var(--text-primary)]"
        >
            <span
                ref={textRef}
                className="dashboard-title-hyphenate-2 block max-w-full"
                style={{ fontSize: `${fontSize}px` }}
            >
                {hyphenateServerName(name)}
            </span>
        </h2>
    );
}

function ServerTile({
    guild,
    index,
    text,
}: {
    guild: Guild;
    index: number;
    text: (typeof strings)[Locale];
}) {
    const [color, setColor] = useState<string | null>(null);

    useEffect(() => {
        let active = true;

        if (!guild.icon) {
            return () => {
                active = false;
            };
        }

        const fac = new FastAverageColor();
        const iconUrl = `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=256`;

        void fac
            .getColorAsync(iconUrl, { crossOrigin: 'anonymous' })
            .then((result) => {
                if (active) {
                    setColor(result.hex);
                }
            })
            .catch(() => {
                if (active) {
                    setColor(null);
                }
            });

        return () => {
            active = false;
            fac.destroy();
        };
    }, [guild.icon, guild.id]);

    const accent = color || '#75F16A';
    const styles = {
        '--guild-accent': accent,
        '--guild-accent-line': withAlpha(accent, '66'),
        '--guild-accent-glow': withAlpha(accent, '2c'),
        '--guild-accent-soft': withAlpha(accent, '18'),
        '--guild-accent-surface': withAlpha(accent, '10'),
    } as CSSProperties;

    return (
        <motion.li
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: Math.min(index * 0.04, 0.28) }}
            className="list-none"
        >
            <Link href={toPublicDashboardPath(`/dashboard/${guild.id}`, getBrowserPublicHost())} className="group block h-full focus:outline-none">
                <article
                    className="relative flex h-full min-h-[20rem] flex-col overflow-hidden rounded-[30px] border border-white/[0.06] bg-[linear-gradient(180deg,rgba(13,16,20,0.96),rgba(8,10,14,0.98))] p-5 shadow-[0_22px_60px_-28px_rgba(14,14,14,0.9)] transition-all duration-500 group-hover:-translate-y-1.5 group-hover:border-[color:var(--guild-accent-line)] group-hover:shadow-[0_32px_80px_-28px_var(--guild-accent-glow)] group-focus-visible:-translate-y-1.5 group-focus-visible:border-[color:var(--guild-accent-line)] group-focus-visible:shadow-[0_32px_80px_-28px_var(--guild-accent-glow)]"
                    style={styles}
                >
                    <div
                        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100 group-focus-visible:opacity-100"
                        style={{
                            background: `radial-gradient(circle at 16% 16%, var(--guild-accent-soft), transparent 34%), linear-gradient(180deg, transparent 48%, var(--guild-accent-surface) 100%)`,
                        }}
                    />
                    <div
                        className="pointer-events-none absolute inset-x-8 bottom-0 h-px opacity-0 transition-opacity duration-500 group-hover:opacity-100 group-focus-visible:opacity-100"
                        style={{ background: 'linear-gradient(90deg, transparent, var(--guild-accent-line), transparent)' }}
                    />

                    <div className="relative z-10 flex h-full flex-col">
                        <div className="flex items-center justify-between text-[0.62rem] uppercase tracking-[0.32em] text-white/32">
                            <span>{String(index + 1).padStart(2, '0')}</span>
                            <span>{text.cardEyebrow}</span>
                        </div>

                        <div className="mt-7 flex-1">
                            <div
                                className="inline-flex rounded-[30px] border p-3 transition-transform duration-500 group-hover:scale-[1.03] group-focus-visible:scale-[1.03]"
                                style={{
                                    borderColor: withAlpha(accent, '2a'),
                                    background: `linear-gradient(180deg, ${withAlpha(accent, '12')}, rgba(244,241,238,0.02))`,
                                    boxShadow: `inset 0 1px 0 rgba(244,241,238,0.06), 0 18px 40px -22px ${withAlpha(accent, '44')}`,
                                }}
                            >
                                {guild.icon ? (
                                    <Image
                                        src={`https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=256`}
                                        alt={guild.name || text.unknownServer}
                                        crossOrigin="anonymous"
                                        className="h-[88px] w-[88px] rounded-[22px] object-cover shadow-[0_12px_24px_rgba(14,14,14,0.45)]"
                                        radius="none"
                                        removeWrapper
                                    />
                                ) : (
                                    <div className="flex h-[88px] w-[88px] items-center justify-center rounded-[22px] bg-white/[0.04] font-akony text-[2rem] text-white/55">
                                        {guild.name?.charAt(0) || '?'}
                                    </div>
                                )}
                            </div>

                            <AutoFitServerName name={guild.name || text.unknownServer} />
                            <p className="mt-4 max-w-[24ch] text-sm leading-[1.8] text-white/42">
                                {text.manageSettings}
                            </p>
                        </div>

                        <div className="mt-8 flex items-center justify-between border-t border-white/[0.08] pt-4">
                            <span
                                className="text-[0.68rem] font-semibold uppercase tracking-[0.26em] transition-colors duration-300 group-hover:text-[color:var(--guild-accent)] group-focus-visible:text-[color:var(--guild-accent)]"
                                style={{ color: 'rgba(244,241,238,0.44)' }}
                            >
                                {text.manageSettings}
                            </span>
                            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.02] text-white/40 transition-all duration-300 group-hover:border-[color:var(--guild-accent-line)] group-hover:text-[color:var(--guild-accent)] group-focus-visible:border-[color:var(--guild-accent-line)] group-focus-visible:text-[color:var(--guild-accent)]">
                                <CaretRight size={16} weight="bold" />
                            </span>
                        </div>
                    </div>
                </article>
            </Link>
        </motion.li>
    );
}

function LoadingState({ text }: { text: (typeof strings)[Locale] }) {
    return (
        <div className="min-h-screen bg-[#06080b] text-white">
            <div className="mx-auto max-w-[1520px] px-4 py-8 sm:px-6 lg:px-8">
                <div className="rounded-[36px] border border-white/[0.06] bg-[linear-gradient(180deg,rgba(14,18,23,0.96),rgba(8,10,14,0.98))] p-6 sm:p-8 lg:p-10">
                    <LoadingSkeleton className="h-3 w-40 rounded-full" />
                    <LoadingSkeleton className="mt-6 h-20 max-w-[38rem] rounded-[28px]" />
                    <LoadingSkeleton className="mt-6 h-10 max-w-[28rem] rounded-[18px]" />
                    <div className="mt-8 flex items-center gap-3 text-white/55">
                        <Spinner size="sm" color="success" />
                        <span>{text.loadingServers}</span>
                    </div>
                </div>

                <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                    {Array.from({ length: 6 }).map((_, index) => (
                        <div
                            key={index}
                            className="rounded-[30px] border border-white/[0.06] bg-[linear-gradient(180deg,rgba(13,16,20,0.96),rgba(8,10,14,0.98))] p-5"
                        >
                            <LoadingSkeleton className="h-3 w-28 rounded-full" />
                            <LoadingSkeleton className="mt-7 h-[116px] w-[116px] rounded-[30px]" />
                            <LoadingSkeleton className="mt-7 h-12 w-3/4 rounded-[18px]" />
                            <LoadingSkeleton className="mt-4 h-5 w-2/3 rounded-[12px]" />
                            <div className="mt-8 h-px w-full bg-white/[0.06]" />
                            <LoadingSkeleton className="mt-4 h-5 w-1/2 rounded-[12px]" />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

export default function Dashboard() {
    const { data: session } = useSession();
    const [guilds, setGuilds] = useState<Guild[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [mounted, setMounted] = useState(false);
    const [query, setQuery] = useState('');
    const [masterModeEnabled, setMasterModeEnabled] = useState(false);
    const [masterModeLoading, setMasterModeLoading] = useState(false);
    const [locale] = useState<Locale>(getStoredLocale() as Locale);
    const text = strings[locale] ?? strings.en;
    const deferredQuery = useDeferredValue(query);
    const isMasterEligible = (session?.user as { id?: string } | undefined)?.id === BOT_OWNER_ID;

    const loadGuilds = useCallback(async () => {
        const response = await fetchWithTimeout('/api/guilds', { cache: 'no-store' }, 8000, 'Dashboard guild list');

        if (response.status === 401 || response.status === 403) {
            void fetch('/api/logout', { method: 'POST' });
            void signOut({ redirect: false });
            window.location.assign('/login');
            return;
        }

        if (!response.ok) {
            throw new Error(`Dashboard guild list failed with HTTP ${response.status}`);
        }

        const data = await response.json();
        if (Array.isArray(data)) {
            setGuilds(data);
            setLoadError(null);
            return;
        }

        throw new Error('Dashboard guild list returned an unexpected response');
    }, []);

    useEffect(() => {
        setMounted(true);

        let active = true;

        const init = async () => {
            try {
                await loadGuilds();
            } catch (error) {
                console.error('Failed to load guild chooser data:', error);
                if (active) {
                    setLoadError(error instanceof Error ? error.message : 'Failed to load guilds');
                }
            } finally {
                if (active) {
                    setLoading(false);
                }
            }
        };

        void init();

        return () => {
            active = false;
        };
    }, [loadGuilds]);

    useEffect(() => {
        if (!mounted || !isMasterEligible) {
            setMasterModeEnabled(false);
            return;
        }

        let active = true;

        const loadMasterMode = async () => {
            try {
                const response = await fetch('/api/auth/master-mode', { cache: 'no-store' });
                if (!response.ok) {
                    return;
                }

                const data = await response.json();
                if (active && typeof data.enabled === 'boolean') {
                    setMasterModeEnabled(data.enabled);
                }
            } catch {
                // Ignore temporary state read failures on the chooser page.
            }
        };

        void loadMasterMode();

        return () => {
            active = false;
        };
    }, [isMasterEligible, mounted]);

    const filteredGuilds = useMemo(() => {
        const normalized = deferredQuery.trim().toLocaleLowerCase();
        if (!normalized) {
            return guilds;
        }

        return guilds.filter((guild) => (guild.name || text.unknownServer).toLocaleLowerCase().includes(normalized));
    }, [deferredQuery, guilds, text.unknownServer]);

    const handleLogout = async () => {
        await fetch('/api/logout', { method: 'POST' });
        await signOut({ callbackUrl: '/login' });
    };

    const handleMasterModeToggle = async () => {
        if (!isMasterEligible || masterModeLoading) {
            return;
        }

        setMasterModeLoading(true);
        try {
            const nextEnabled = !masterModeEnabled;
            const response = await fetch('/api/auth/master-mode', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled: nextEnabled }),
            });

            if (!response.ok) {
                return;
            }

            setMasterModeEnabled(nextEnabled);
            setLoading(true);
            await loadGuilds();
        } finally {
            setLoading(false);
            setMasterModeLoading(false);
        }
    };

    if (loading || !mounted) {
        return <LoadingState text={text} />;
    }

    return (
        <div className="relative min-h-screen overflow-hidden bg-[#06080b] text-[var(--text-primary)]">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_12%,rgba(117,241,106,0.1),transparent_24%),radial-gradient(circle_at_86%_10%,rgba(143,94,255,0.1),transparent_28%),linear-gradient(180deg,#0a0c0f_0%,#06080b_55%,#050608_100%)]" />
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(244,241,238,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(244,241,238,0.035)_1px,transparent_1px)] bg-[size:100%_144px,144px_100%] opacity-[0.06]" />

            <main className="relative mx-auto max-w-[1520px] px-4 py-8 pb-20 sm:px-6 lg:px-8">
                <section className="overflow-hidden rounded-[36px] border border-white/[0.06] bg-[linear-gradient(180deg,rgba(14,18,23,0.96),rgba(8,10,14,0.98))] p-6 shadow-[0_32px_90px_-45px_rgba(14,14,14,0.95)] sm:p-8 lg:p-10">
                    <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(244,241,238,0.18),transparent)] opacity-60" />

                    <div className="flex flex-col gap-8 xl:flex-row xl:items-end xl:justify-between">
                        <div className="max-w-[46rem]">
                            <p className="text-[0.72rem] uppercase tracking-[0.42em] text-[var(--color-primary-1)]">{text.eyebrow}</p>
                            <h1 className="mt-5 font-akony text-[clamp(2.3rem,6vw,5.5rem)] uppercase leading-[0.88] tracking-[0.05em] text-white">
                                {text.title}
                            </h1>
                            <p className="mt-6 max-w-[38rem] text-base leading-[1.9] text-white/58 sm:text-lg">
                                {text.subtitle}
                            </p>
                        </div>

                        <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
                            {isMasterEligible ? (
                                <button
                                    type="button"
                                    onClick={handleMasterModeToggle}
                                    disabled={masterModeLoading}
                                    className={`inline-flex min-h-[3.25rem] items-center justify-center gap-2 rounded-full border px-5 text-[0.74rem] font-bold uppercase tracking-[0.24em] transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-70 ${
                                        masterModeEnabled
                                            ? 'border-[rgba(117,241,106,0.34)] bg-[rgba(117,241,106,0.12)] text-[rgb(165,255,158)] hover:bg-[rgba(117,241,106,0.16)]'
                                            : 'border-white/[0.1] bg-white/[0.03] text-white/76 hover:border-white/[0.18] hover:bg-white/[0.05] hover:text-white'
                                    }`}
                                >
                                    <Crown size={16} weight={masterModeEnabled ? 'fill' : 'regular'} />
                                    {masterModeEnabled ? text.masterModeOn : text.masterModeOff}
                                </button>
                            ) : null}

                            <button
                                type="button"
                                onClick={handleLogout}
                                className="inline-flex min-h-[3.25rem] items-center justify-center gap-2 rounded-full border border-white/[0.1] bg-white/[0.03] px-5 text-[0.74rem] font-bold uppercase tracking-[0.24em] text-white/76 transition-all duration-300 hover:border-white/[0.18] hover:bg-white/[0.05] hover:text-white"
                            >
                                <SignOut size={16} weight="bold" />
                                {text.logout}
                            </button>
                        </div>
                    </div>

                    <div className="mt-8">
                        <label className="group flex min-h-[5.5rem] items-center gap-4 rounded-[28px] border border-white/[0.06] bg-white/[0.02] px-5 py-4 transition-colors duration-300 hover:border-white/[0.12] focus-within:border-[var(--color-primary-1)]">
                            <span className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/[0.08] bg-black/20 text-white/36 transition-colors duration-300 group-focus-within:text-[var(--color-primary-1)]">
                                <MagnifyingGlass size={18} weight="bold" />
                            </span>
                            <div className="min-w-0 flex-1">
                                <input
                                    type="text"
                                    value={query}
                                    onChange={(event) => setQuery(event.target.value)}
                                    placeholder={text.searchPlaceholder}
                                    className="w-full bg-transparent text-base text-white outline-none placeholder:text-white/28 sm:text-lg"
                                    aria-label={text.searchPlaceholder}
                                />
                            </div>
                        </label>
                    </div>
                </section>

                <motion.ul
                    className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
                    initial={{ opacity: 0, y: 18 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.45 }}
                >
                    {filteredGuilds.map((guild, index) => (
                        <ServerTile key={guild.id} guild={guild} index={index} text={text} />
                    ))}
                </motion.ul>

                {guilds.length === 0 && (
                    <div className="mt-8 rounded-[30px] border border-dashed border-white/[0.1] bg-white/[0.02] px-6 py-14 text-center">
                        <p className="mx-auto max-w-[42rem] text-base leading-[1.9] text-white/48 sm:text-lg">
                            {loadError ? `${text.noServers} (${loadError})` : text.noServers}
                        </p>
                    </div>
                )}

                {guilds.length > 0 && filteredGuilds.length === 0 && (
                    <div className="mt-8 rounded-[30px] border border-dashed border-white/[0.1] bg-white/[0.02] px-6 py-14 text-center">
                        <p className="mx-auto max-w-[42rem] text-base leading-[1.9] text-white/48 sm:text-lg">{text.noMatches}</p>
                    </div>
                )}
            </main>
        </div>
    );
}
