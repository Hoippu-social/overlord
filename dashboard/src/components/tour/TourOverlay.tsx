'use client';

import React, { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { X, CaretLeft, CaretRight } from '@phosphor-icons/react';
import { useGuildLocale } from '@/lib/i18n';
import { getTourCopy } from '@/lib/tour/i18n';
import { useTour } from './TourProvider';
import { scrollTourAnchorBy, useTourAnchor } from './useTourAnchor';
import type { TourPlacement } from '@/lib/tour/types';

const MARGIN = 12;
const GAP = 16;
const MAX_BUBBLE_WIDTH = 360;
const DEFAULT_SIZE = { width: 340, height: 240 };
const subscribeClientReady = () => () => undefined;
const getClientReadySnapshot = () => true;
const getServerReadySnapshot = () => false;

function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
}

type Side = 'top' | 'bottom';

type ViewportBounds = {
    left: number;
    top: number;
    right: number;
    bottom: number;
    width: number;
    height: number;
};

function getViewportBounds(): ViewportBounds {
    const visualViewport = window.visualViewport;
    const width = visualViewport?.width ?? window.innerWidth;
    const height = visualViewport?.height ?? window.innerHeight;
    const left = visualViewport?.offsetLeft ?? 0;
    const top = visualViewport?.offsetTop ?? 0;

    return {
        left,
        top,
        right: left + width,
        bottom: top + height,
        width,
        height,
    };
}

function getBubbleWidth(viewport: ViewportBounds) {
    return Math.max(0, Math.min(MAX_BUBBLE_WIDTH, viewport.width - MARGIN * 2));
}

function getBubbleMaxHeight(viewport: ViewportBounds) {
    return Math.max(0, viewport.height - MARGIN * 2);
}

function getAvailableSpace(rect: DOMRect, viewport: ViewportBounds): Record<Side, number> {
    return {
        bottom: Math.max(0, viewport.bottom - MARGIN - rect.bottom - GAP),
        top: Math.max(0, rect.top - GAP - viewport.top - MARGIN),
    };
}

function chooseSide(
    rect: DOMRect,
    height: number,
    placement: TourPlacement,
    viewport: ViewportBounds,
): Side {
    const availableSpace = getAvailableSpace(rect, viewport);
    const preferred: Side = placement === 'top' || placement === 'bottom'
        ? placement
        : availableSpace.bottom >= availableSpace.top ? 'bottom' : 'top';
    const opposite: Side = preferred === 'top' ? 'bottom' : 'top';

    if (availableSpace[preferred] >= height) return preferred;
    if (availableSpace[opposite] >= height) return opposite;

    return availableSpace.bottom >= availableSpace.top ? 'bottom' : 'top';
}

function chooseMobileSide(
    rect: DOMRect,
    placement: TourPlacement,
    viewport: ViewportBounds,
): Side {
    if (placement === 'top' || placement === 'bottom') return placement;

    const availableSpace = getAvailableSpace(rect, viewport);
    return availableSpace.bottom >= availableSpace.top ? 'bottom' : 'top';
}

function computeBubblePosition(
    rect: DOMRect,
    size: { width: number; height: number },
    placement: TourPlacement,
    viewport: ViewportBounds,
    forcedSide?: Side,
) {
    const centerX = rect.left + rect.width / 2;
    const safeSize = {
        width: Math.min(size.width, getBubbleWidth(viewport)),
        height: Math.min(size.height, getBubbleMaxHeight(viewport)),
    };
    const availableSpace = getAvailableSpace(rect, viewport);

    const minLeft = viewport.left + MARGIN;
    const maxLeft = Math.max(minLeft, viewport.right - safeSize.width - MARGIN);

    const chosen = forcedSide ?? chooseSide(rect, safeSize.height, placement, viewport);

    const maxHeight = Math.max(0, availableSpace[chosen]);
    const height = Math.min(safeSize.height, maxHeight);
    const rawTop = chosen === 'bottom'
        ? rect.bottom + GAP
        : rect.top - GAP - height;

    return {
        side: chosen,
        top: rawTop,
        left: clamp(centerX - safeSize.width / 2, minLeft, maxLeft),
        maxHeight,
    };
}

function useViewportBounds(active: boolean) {
    const [, setViewportVersion] = useState(0);

    useLayoutEffect(() => {
        if (!active) return;

        let frame = 0;
        const update = () => {
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(() => {
                setViewportVersion((version) => version + 1);
            });
        };
        update();

        window.addEventListener('resize', update);
        window.addEventListener('scroll', update, true);
        window.visualViewport?.addEventListener('resize', update);
        window.visualViewport?.addEventListener('scroll', update);

        return () => {
            cancelAnimationFrame(frame);
            window.removeEventListener('resize', update);
            window.removeEventListener('scroll', update, true);
            window.visualViewport?.removeEventListener('resize', update);
            window.visualViewport?.removeEventListener('scroll', update);
        };
    }, [active]);

    if (!active || typeof window === 'undefined') {
        return null;
    }

    return getViewportBounds();
}

export function TourOverlay({ guildId }: { guildId: string }) {
    const { active, steps, index, next, prev, stop } = useTour();
    const { locale } = useGuildLocale(guildId);
    const copy = getTourCopy(locale);
    const prefersReducedMotion = useReducedMotion();
    const mounted = useSyncExternalStore(
        subscribeClientReady,
        getClientReadySnapshot,
        getServerReadySnapshot,
    );
    const bubbleRef = useRef<HTMLDivElement | null>(null);
    const [bubbleSize, setBubbleSize] = useState(DEFAULT_SIZE);

    const step = steps[index] ?? null;
    const rect = useTourAnchor(step?.anchor ?? null);
    const viewport = useViewportBounds(active);
    const hasAnchorRect = rect !== null;
    const hasViewport = viewport !== null;

    useLayoutEffect(() => {
        const el = bubbleRef.current;
        if (!el) return;
        const measure = () => {
            const box = el.getBoundingClientRect();
            setBubbleSize((current) => {
                const next = { width: box.width, height: Math.max(box.height, el.scrollHeight) };
                if (Math.abs(current.width - next.width) < 1 && Math.abs(current.height - next.height) < 1) {
                    return current;
                }
                return next;
            });
        };
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(el);
        return () => observer.disconnect();
    }, [active, locale, step?.id, hasAnchorRect, hasViewport]);

    const isMobileViewport = Boolean(viewport && viewport.width < 640);
    const calculatedMobileSide = step && rect && viewport && isMobileViewport
        ? chooseMobileSide(rect, step.placement ?? 'auto', viewport)
        : null;
    const mobileSide = calculatedMobileSide;

    useLayoutEffect(() => {
        if (!active || !step || !rect || !viewport || !mobileSide) return;

        const desiredHeight = Math.min(bubbleSize.height, getBubbleMaxHeight(viewport));
        const availableSpace = getAvailableSpace(rect, viewport);
        const missingSpace = desiredHeight - availableSpace[mobileSide];

        if (missingSpace > 1) {
            scrollTourAnchorBy(step.anchor, mobileSide === 'top' ? -missingSpace : missingSpace);
        }
    }, [active, bubbleSize.height, mobileSide, rect, step, viewport]);

    useEffect(() => {
        if (!active) return;
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                stop();
            } else if (event.key === 'ArrowRight') {
                event.preventDefault();
                next();
            } else if (event.key === 'ArrowLeft') {
                event.preventDefault();
                prev();
            }
        };
        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, [active, next, prev, stop]);

    useEffect(() => {
        if (active) {
            bubbleRef.current?.focus();
        } else {
            const trigger = document.querySelector<HTMLElement>('[data-tour-trigger]');
            trigger?.focus();
        }
    }, [active, index]);

    if (!mounted || !active || !step) return null;

    const padding = step.padding ?? 8;
    const cutout = rect
        ? {
            x: rect.left - padding,
            y: rect.top - padding,
            width: rect.width + padding * 2,
            height: rect.height + padding * 2,
        }
        : null;

    const bubbleWidth = viewport ? getBubbleWidth(viewport) : DEFAULT_SIZE.width;
    const bubbleMaxHeight = viewport ? getBubbleMaxHeight(viewport) : undefined;
    const measuredBubbleSize = {
        width: bubbleWidth,
        height: bubbleMaxHeight ? Math.min(bubbleSize.height, bubbleMaxHeight) : bubbleSize.height,
    };
    const position = rect && viewport
        ? computeBubblePosition(
            rect,
            measuredBubbleSize,
            isMobileViewport && mobileSide ? mobileSide : step.placement ?? 'auto',
            viewport,
            isMobileViewport ? mobileSide ?? undefined : undefined,
        )
        : null;
    const transitionStyle = prefersReducedMotion
        ? undefined
        : { transition: 'x 280ms cubic-bezier(0.16,1,0.3,1), y 280ms cubic-bezier(0.16,1,0.3,1), width 280ms cubic-bezier(0.16,1,0.3,1), height 280ms cubic-bezier(0.16,1,0.3,1)' };

    const isLast = index === steps.length - 1;
    const arrowStyle = (() => {
        if (!position || !rect) return undefined;
        const size = 12;
        const targetCenter = rect.left + rect.width / 2;
        const offset = clamp(targetCenter - position.left, 20, measuredBubbleSize.width - 20);
        return {
            left: offset - size / 2,
            [position.side === 'top' ? 'bottom' : 'top']: -size / 2,
        } as React.CSSProperties;
    })();

    const handleBackdropClick = (event: React.MouseEvent) => {
        if (event.target === event.currentTarget) {
            stop();
        }
    };

    return createPortal(
        <div className="fixed inset-0 z-[90]" role="dialog" aria-modal="true">
            <svg
                className="absolute inset-0 h-full w-full cursor-pointer"
                onClick={handleBackdropClick}
            >
                <defs>
                    <mask id="tour-spotlight-mask">
                        <rect x="0" y="0" width="100%" height="100%" fill="white" />
                        {cutout && (
                            <rect
                                x={cutout.x}
                                y={cutout.y}
                                width={cutout.width}
                                height={cutout.height}
                                rx={16}
                                fill="black"
                                style={transitionStyle}
                            />
                        )}
                    </mask>
                </defs>
                <rect x="0" y="0" width="100%" height="100%" fill="rgba(0,0,0,0.65)" mask="url(#tour-spotlight-mask)" />
                {cutout && (
                    <rect
                        x={cutout.x}
                        y={cutout.y}
                        width={cutout.width}
                        height={cutout.height}
                        rx={16}
                        fill="none"
                        stroke="var(--color-primary-1)"
                        strokeWidth={2}
                        className="tour-pulse-ring"
                        style={transitionStyle}
                    />
                )}
            </svg>

            <AnimatePresence mode="wait">
                {position && (
                    <motion.div
                        key={step.id}
                        ref={bubbleRef}
                        tabIndex={-1}
                        style={{
                            position: 'fixed',
                            top: isMobileViewport && rect
                                ? position.side === 'top' ? rect.top - GAP : rect.bottom + GAP
                                : position.top,
                            translate: isMobileViewport && position.side === 'top' ? '0 -100%' : undefined,
                            left: position.left,
                            width: bubbleWidth,
                            maxHeight: position.maxHeight,
                            overflowY: 'auto',
                            overflowX: 'hidden',
                        }}
                        initial={prefersReducedMotion || isMobileViewport ? { opacity: 0 } : {
                            opacity: 0,
                            y: position.side === 'top' ? 6 : position.side === 'bottom' ? -6 : 0,
                        }}
                        animate={{ opacity: 1, x: 0, y: 0 }}
                        exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0 }}
                        transition={{ duration: prefersReducedMotion ? 0.01 : 0.22, ease: [0.16, 1, 0.3, 1] }}
                        className="rounded-[24px] border border-[var(--border-divider)] bg-[var(--surface-card)] p-5 shadow-2xl shadow-black/40 outline-none"
                    >
                        {arrowStyle && (
                            <span
                                aria-hidden
                                className="absolute hidden h-3 w-3 rotate-45 border border-[var(--border-divider)] bg-[var(--surface-card)] sm:block"
                                style={arrowStyle}
                            />
                        )}

                        <div className="relative flex items-start justify-between gap-3">
                            <h3 className="min-w-0 break-words font-akony text-base font-bold leading-tight text-white">
                                {step.title[locale]}
                            </h3>
                            <button
                                type="button"
                                onClick={stop}
                                aria-label={copy.close}
                                className="-mr-1 -mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-white"
                            >
                                <X size={16} weight="bold" />
                            </button>
                        </div>

                        <p className="relative mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
                            {step.body[locale]}
                        </p>

                        <div className="relative mt-4 flex items-center justify-between gap-3">
                            <span className="text-xs font-bold text-[var(--text-muted)]">
                                {copy.stepOf(index + 1, steps.length)}
                            </span>
                            <div className="flex items-center gap-2">
                                {index > 0 && (
                                    <button
                                        type="button"
                                        onClick={prev}
                                        className="flex h-9 items-center gap-1 rounded-full border border-[var(--border-divider)] px-3 text-xs font-bold text-[var(--text-secondary)] transition-colors hover:text-white"
                                    >
                                        <CaretLeft size={14} weight="bold" />
                                        {copy.back}
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={next}
                                    className="flex h-9 items-center gap-1 rounded-full bg-[var(--color-primary-1)] px-4 text-xs font-bold text-black transition-transform hover:scale-[1.03]"
                                >
                                    {isLast ? copy.done : copy.next}
                                    {!isLast && <CaretRight size={14} weight="bold" />}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>,
        document.body,
    );
}
