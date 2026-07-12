'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { resolveTour } from '@/lib/tour/registry';
import type { TourStep } from '@/lib/tour/types';

type TourContextValue = {
    active: boolean;
    steps: TourStep[];
    index: number;
    available: boolean;
    start: () => void;
    stop: () => void;
    next: () => void;
    prev: () => void;
};

const TourContext = createContext<TourContextValue | null>(null);

function isAnchorVisible(selector: string): boolean {
    const el = document.querySelector(selector);
    if (!el) return false;

    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;

    const style = window.getComputedStyle(el);
    if (style.visibility === 'hidden' || style.display === 'none') return false;
    if (parseFloat(style.opacity || '1') < 0.05) return false;

    return true;
}

export function TourProvider({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [active, setActive] = useState(false);
    const [steps, setSteps] = useState<TourStep[]>([]);
    const [index, setIndex] = useState(0);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const resolvedTour = useMemo(() => resolveTour(pathname, searchParams), [pathname, searchParams]);
    // Gated on `mounted` so the first client render always matches the server-rendered
    // markup (useSearchParams can differ between SSR and hydration otherwise), avoiding
    // a hydration mismatch on the "?" button's disabled state.
    const available = mounted && resolvedTour !== null && resolvedTour.steps.length > 0;

    const stop = useCallback(() => {
        setActive(false);
        setSteps([]);
        setIndex(0);
    }, []);

    useEffect(() => {
        stop();
    }, [pathname, stop]);

    const start = useCallback(() => {
        if (!resolvedTour) return;
        const filtered = resolvedTour.steps.filter((step) => isAnchorVisible(step.anchor));
        if (filtered.length === 0) return;
        setSteps(filtered);
        setIndex(0);
        setActive(true);
    }, [resolvedTour]);

    const next = useCallback(() => {
        setIndex((current) => {
            if (current + 1 >= steps.length) {
                setActive(false);
                return current;
            }
            return current + 1;
        });
    }, [steps.length]);

    const prev = useCallback(() => {
        setIndex((current) => Math.max(0, current - 1));
    }, []);

    const value = useMemo<TourContextValue>(() => ({
        active,
        steps,
        index,
        available,
        start,
        stop,
        next,
        prev,
    }), [active, steps, index, available, start, stop, next, prev]);

    return <TourContext.Provider value={value}>{children}</TourContext.Provider>;
}

export function useTour() {
    const ctx = useContext(TourContext);
    if (!ctx) {
        throw new Error('useTour must be used within a TourProvider');
    }
    return ctx;
}
