'use client';

import React, { useLayoutEffect, useRef, useState } from 'react';

interface FitSingleLineTextProps {
    children: React.ReactNode;
    className?: string;
    minFontSize?: number;
    maxFontSize?: number;
    mobileOnly?: boolean;
}

export function FitSingleLineText({
    children,
    className = '',
    minFontSize = 10,
    maxFontSize = 12,
    mobileOnly = false,
}: FitSingleLineTextProps) {
    const frameRef = useRef<HTMLSpanElement>(null);
    const textRef = useRef<HTMLSpanElement>(null);
    const [fontSize, setFontSize] = useState<number | undefined>(maxFontSize);

    useLayoutEffect(() => {
        const frame = frameRef.current;
        const text = textRef.current;

        if (!frame || !text || typeof window === 'undefined') {
            return;
        }

        const fit = () => {
            if (mobileOnly && window.matchMedia('(min-width: 768px)').matches) {
                setFontSize(undefined);
                return;
            }

            const availableWidth = frame.clientWidth;
            if (availableWidth <= 0) {
                return;
            }

            const previousFontSize = text.style.fontSize;
            text.style.fontSize = `${maxFontSize}px`;
            const naturalWidth = text.scrollWidth;
            text.style.fontSize = previousFontSize;

            if (naturalWidth <= availableWidth) {
                setFontSize(maxFontSize);
                return;
            }

            const fittedSize = Math.max(minFontSize, Math.floor((maxFontSize * availableWidth / naturalWidth) * 10) / 10);
            setFontSize(fittedSize);
        };

        fit();

        const resizeObserver = new ResizeObserver(fit);
        resizeObserver.observe(frame);
        resizeObserver.observe(text);

        void document.fonts?.ready.then(fit);

        window.addEventListener('resize', fit);

        return () => {
            resizeObserver.disconnect();
            window.removeEventListener('resize', fit);
        };
    }, [children, maxFontSize, minFontSize, mobileOnly]);

    return (
        <span ref={frameRef} className="block min-w-0 max-w-full overflow-hidden whitespace-nowrap">
            <span
                ref={textRef}
                className={`block max-w-full whitespace-nowrap ${className}`}
                style={fontSize ? { fontSize: `${fontSize}px` } : undefined}
            >
                {children}
            </span>
        </span>
    );
}
