'use client';

import { useEffect, useState } from 'react';

export function useTourAnchor(selector: string | null): DOMRect | null {
    const [rect, setRect] = useState<DOMRect | null>(null);

    useEffect(() => {
        if (!selector) {
            const frame = requestAnimationFrame(() => setRect(null));
            return () => cancelAnimationFrame(frame);
        }

        const el = document.querySelector(selector);
        if (!el) {
            const frame = requestAnimationFrame(() => setRect(null));
            return () => cancelAnimationFrame(frame);
        }

        let cancelled = false;
        const measure = () => {
            if (cancelled) return;
            setRect(el.getBoundingClientRect());
        };

        const isMobile = window.matchMedia('(max-width: 639px)').matches;
        el.scrollIntoView({
            block: 'center',
            inline: 'nearest',
            behavior: isMobile ? 'auto' : 'smooth',
        });
        const raf1 = requestAnimationFrame(() => {
            const raf2 = requestAnimationFrame(measure);
            cleanupRaf2 = raf2;
        });
        let cleanupRaf2 = 0;
        measure();

        const resizeObserver = new ResizeObserver(measure);
        resizeObserver.observe(el);

        const onScroll = () => measure();
        window.addEventListener('resize', measure);
        document.addEventListener('scroll', onScroll, true);

        return () => {
            cancelled = true;
            cancelAnimationFrame(raf1);
            cancelAnimationFrame(cleanupRaf2);
            resizeObserver.disconnect();
            window.removeEventListener('resize', measure);
            document.removeEventListener('scroll', onScroll, true);
        };
    }, [selector]);

    return rect;
}

export function scrollTourAnchorBy(selector: string, top: number) {
    const el = document.querySelector<HTMLElement>(selector);
    if (!el || Math.abs(top) < 1) return;

    let parent = el.parentElement;
    while (parent) {
        const overflowY = window.getComputedStyle(parent).overflowY;
        const canScroll = /(auto|scroll|overlay)/.test(overflowY) && parent.scrollHeight > parent.clientHeight;
        if (canScroll) {
            parent.scrollBy({ top, behavior: 'auto' });
            return;
        }
        parent = parent.parentElement;
    }

    window.scrollBy({ top, behavior: 'auto' });
}
