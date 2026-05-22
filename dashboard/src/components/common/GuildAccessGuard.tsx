'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Modal, ModalBody, ModalContent } from '@nextui-org/react';
import { ArrowRight, WarningCircle } from '@phosphor-icons/react';
import { motion } from 'framer-motion';
import { useGuildLocale } from '@/lib/i18n';
import { getBrowserPublicHost, getDashboardHomePath } from '@/lib/publicDashboard';

const ACCESS_POLL_INTERVAL_MS = 2000;
const REDIRECT_DELAY_MS = 5000;
const EXIT_ANIMATION_MS = 220;

const strings = {
    en: {
        title: 'Access Removed',
        description:
            'Your administrator access to this server has been revoked. You will now be redirected to the server chooser.',
        redirecting: 'Redirecting to server chooser',
        action: 'Go now',
        badge: 'Security update',
        secondsShort: 'sec',
    },
    ru: {
        title: '\u0414\u043e\u0441\u0442\u0443\u043f \u043e\u0442\u043e\u0437\u0432\u0430\u043d',
        description:
            '\u0412\u0430\u0448\u0438 \u043f\u0440\u0430\u0432\u0430 \u0430\u0434\u043c\u0438\u043d\u0438\u0441\u0442\u0440\u0430\u0442\u043e\u0440\u0430 \u043d\u0430 \u044d\u0442\u043e\u043c \u0441\u0435\u0440\u0432\u0435\u0440\u0435 \u0431\u044b\u043b\u0438 \u043e\u0442\u043e\u0437\u0432\u0430\u043d\u044b. \u0421\u0435\u0439\u0447\u0430\u0441 \u0432\u044b \u0431\u0443\u0434\u0435\u0442\u0435 \u043f\u0435\u0440\u0435\u043d\u0430\u043f\u0440\u0430\u0432\u043b\u0435\u043d\u044b \u043d\u0430 \u0441\u0442\u0440\u0430\u043d\u0438\u0446\u0443 \u0432\u044b\u0431\u043e\u0440\u0430 \u0441\u0435\u0440\u0432\u0435\u0440\u043e\u0432.',
        redirecting:
            '\u041f\u0435\u0440\u0435\u043d\u0430\u043f\u0440\u0430\u0432\u043b\u0435\u043d\u0438\u0435 \u043d\u0430 \u0441\u0442\u0440\u0430\u043d\u0438\u0446\u0443 \u0432\u044b\u0431\u043e\u0440\u0430 \u0441\u0435\u0440\u0432\u0435\u0440\u043e\u0432',
        action: '\u041f\u0435\u0440\u0435\u0439\u0442\u0438 \u0441\u0435\u0439\u0447\u0430\u0441',
        badge: '\u041e\u0431\u043d\u043e\u0432\u043b\u0435\u043d\u0438\u0435 \u0431\u0435\u0437\u043e\u043f\u0430\u0441\u043d\u043e\u0441\u0442\u0438',
        secondsShort: '\u0441\u0435\u043a',
    },
} as const;

type GuildAccessGuardProps = {
    guildId: string;
};

export function GuildAccessGuard({ guildId }: GuildAccessGuardProps) {
    const router = useRouter();
    const { locale } = useGuildLocale(guildId);
    const text = strings[locale] ?? strings.en;
    const [revoked, setRevoked] = useState(false);
    const [isClosing, setIsClosing] = useState(false);
    const [elapsedMs, setElapsedMs] = useState(0);
    const [progressAnimated, setProgressAnimated] = useState(false);
    const redirectTimerRef = useRef<number | null>(null);
    const countdownTimerRef = useRef<number | null>(null);
    const exitTimerRef = useRef<number | null>(null);
    const redirectTriggeredRef = useRef(false);

    const secondsLeft = Math.max(1, Math.ceil((REDIRECT_DELAY_MS - elapsedMs) / 1000));
    const progressValue = useMemo(
        () =>
            Math.max(
                0,
                Math.min(100, ((REDIRECT_DELAY_MS - elapsedMs) / REDIRECT_DELAY_MS) * 100)
            ),
        [elapsedMs]
    );

    const startRedirect = useCallback(() => {
        if (redirectTriggeredRef.current) {
            return;
        }

        redirectTriggeredRef.current = true;
        setIsClosing(true);

        if (countdownTimerRef.current !== null) {
            window.clearInterval(countdownTimerRef.current);
            countdownTimerRef.current = null;
        }
        if (redirectTimerRef.current !== null) {
            window.clearTimeout(redirectTimerRef.current);
            redirectTimerRef.current = null;
        }
        if (exitTimerRef.current !== null) {
            window.clearTimeout(exitTimerRef.current);
        }

        exitTimerRef.current = window.setTimeout(() => {
            router.replace(getDashboardHomePath(getBrowserPublicHost()));
            router.refresh();
        }, EXIT_ANIMATION_MS);
    }, [router]);

    useEffect(() => {
        if (revoked) {
            return;
        }

        let active = true;

        const checkAccess = async () => {
            try {
                const response = await fetch(`/api/guilds/${guildId}/access`, {
                    cache: 'no-store',
                });

                if (!active) {
                    return;
                }

                if (response.status === 403) {
                    setRevoked(true);
                    return;
                }

                if (response.status === 401) {
                    router.replace('/login');
                }
            } catch {
                // Ignore transient network failures and retry on the next interval.
            }
        };

        void checkAccess();
        const intervalId = window.setInterval(() => {
            void checkAccess();
        }, ACCESS_POLL_INTERVAL_MS);

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                void checkAccess();
            }
        };

        window.addEventListener('focus', handleVisibilityChange);
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            active = false;
            window.clearInterval(intervalId);
            window.removeEventListener('focus', handleVisibilityChange);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [guildId, revoked, router]);

    useEffect(() => {
        if (!revoked) {
            return;
        }

        redirectTriggeredRef.current = false;

        const animationFrameId = window.requestAnimationFrame(() => {
            setElapsedMs(0);
            setIsClosing(false);
            setProgressAnimated(true);
        });

        countdownTimerRef.current = window.setInterval(() => {
            setElapsedMs((current) => Math.min(current + 100, REDIRECT_DELAY_MS));
        }, 100);

        redirectTimerRef.current = window.setTimeout(() => {
            startRedirect();
        }, REDIRECT_DELAY_MS);

        return () => {
            if (countdownTimerRef.current !== null) {
                window.clearInterval(countdownTimerRef.current);
                countdownTimerRef.current = null;
            }
            if (redirectTimerRef.current !== null) {
                window.clearTimeout(redirectTimerRef.current);
                redirectTimerRef.current = null;
            }
            if (exitTimerRef.current !== null) {
                window.clearTimeout(exitTimerRef.current);
                exitTimerRef.current = null;
            }
            window.cancelAnimationFrame(animationFrameId);
            redirectTriggeredRef.current = false;
        };
    }, [revoked, startRedirect]);

    return (
        <Modal
            isOpen={revoked}
            hideCloseButton
            isDismissable={false}
            isKeyboardDismissDisabled
            classNames={{
                base: 'm-4 overflow-hidden rounded-[32px] border border-[var(--border-subtle)] bg-[var(--surface-card)] shadow-[0_40px_140px_rgba(0,0,0,0.78),0_0_0_1px_rgba(244,63,94,0.08)]',
                backdrop: 'bg-black/86 backdrop-blur-[10px]',
            }}
        >
            <ModalContent>
                <motion.div
                    initial={{ opacity: 0, y: 18, scale: 0.96 }}
                    animate={
                        isClosing
                            ? { opacity: 0, y: 12, scale: 0.97 }
                            : { opacity: 1, y: 0, scale: 1 }
                    }
                    transition={{
                        duration: isClosing ? 0.22 : 0.28,
                        ease: [0.22, 1, 0.36, 1],
                    }}
                    className="relative flex flex-col overflow-hidden"
                >
                    <div className="pointer-events-none absolute inset-0">
                        <div className="absolute inset-x-0 top-0 h-28 bg-[radial-gradient(circle_at_top,rgba(244,63,94,0.2),transparent_68%)]" />
                        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),transparent_26%,rgba(0,0,0,0.12)_100%)]" />
                    </div>

                    <div className="relative border-b border-[var(--border-divider)] bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.015))] px-6 py-5">
                        <div className="flex items-center gap-4">
                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[var(--color-destructive)]/30 bg-[var(--color-destructive)]/14 text-[var(--color-destructive)] shadow-[0_0_32px_rgba(239,68,68,0.22)]">
                                <WarningCircle size={24} weight="fill" />
                            </div>
                            <div>
                                <h2 className="text-lg leading-tight font-bold text-white">
                                    {text.title}
                                </h2>
                                <p className="mt-1 text-xs font-medium uppercase tracking-[0.18em] text-[var(--color-destructive)]">
                                    {text.badge}
                                </p>
                            </div>
                        </div>
                    </div>

                    <ModalBody className="relative px-6 py-6">
                        <div className="rounded-[24px] border border-[var(--border-subtle)] bg-black/24 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                            <p className="text-sm leading-7 text-white/78">
                                {text.description}
                            </p>
                        </div>

                        <div className="mt-5 rounded-[24px] border border-[var(--border-subtle)] bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(0,0,0,0.12))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                            <div className="mb-3 flex items-center justify-between gap-4 text-sm">
                                <span className="font-semibold text-white">
                                    {text.redirecting}
                                </span>
                                <span className="text-right leading-none">
                                    <span className="font-sans text-2xl font-black tabular-nums text-[var(--color-destructive)]">
                                        {secondsLeft}
                                    </span>
                                    <span className="ml-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                                        {text.secondsShort}
                                    </span>
                                </span>
                            </div>
                            <div
                                aria-label={text.redirecting}
                                role="progressbar"
                                aria-valuemin={0}
                                aria-valuemax={100}
                                aria-valuenow={Math.round(isClosing ? 0 : progressValue)}
                                className="relative h-3 w-full overflow-hidden rounded-full border border-[var(--border-subtle)] bg-white/[0.04]"
                            >
                                <div
                                    className={`absolute inset-y-0 left-0 rounded-full bg-[linear-gradient(90deg,rgba(239,68,68,0.95),rgba(245,158,11,0.9))] ${
                                        progressAnimated ? 'transition-[width] duration-100 linear' : 'transition-none'
                                    }`}
                                    style={{ width: `${isClosing ? 0 : progressValue}%` }}
                                />
                            </div>
                        </div>
                    </ModalBody>

                    <div className="relative flex justify-end border-t border-[var(--border-divider)] bg-[linear-gradient(180deg,rgba(255,255,255,0.02),rgba(0,0,0,0.14))] px-6 py-4">
                        <Button
                            onPress={startRedirect}
                            className="h-11 rounded-xl bg-[var(--color-destructive)] px-5 text-sm font-bold text-white shadow-[0_14px_34px_rgba(239,68,68,0.26)] transition-transform hover:scale-[1.02] hover:bg-[var(--color-destructive)]/90"
                            endContent={<ArrowRight size={16} weight="bold" />}
                        >
                            {text.action}
                        </Button>
                    </div>
                </motion.div>
            </ModalContent>
        </Modal>
    );
}
