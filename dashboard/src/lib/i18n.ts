'use client';

import { useEffect, useState } from 'react';

export type LocaleCode = 'ru' | 'en';

export const DEFAULT_LOCALE: LocaleCode = 'ru';
const STORAGE_KEY = 'dashboardLocale';
const LOCALE_EVENT = 'dashboardLocaleChange';

export const normalizeLocale = (value?: string | null): LocaleCode => {
    if (value === 'en') return 'en';
    return 'ru';
};

export const getStoredLocale = (): LocaleCode => {
    if (typeof window === 'undefined') return DEFAULT_LOCALE;
    return normalizeLocale(window.localStorage.getItem(STORAGE_KEY));
};

export const setStoredLocale = (locale: LocaleCode) => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEY, locale);
    window.dispatchEvent(new CustomEvent(LOCALE_EVENT, { detail: locale }));
};

export const useGuildLocale = (guildId?: string) => {
    const [locale, setLocaleState] = useState<LocaleCode>(getStoredLocale());

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const handleLocaleChange = (event: Event) => {
            const next = (event as CustomEvent<LocaleCode>).detail;
            setLocaleState(normalizeLocale(next));
        };
        window.addEventListener(LOCALE_EVENT, handleLocaleChange);
        return () => window.removeEventListener(LOCALE_EVENT, handleLocaleChange);
    }, []);

    useEffect(() => {
        // Keep hook reactive to guild changes but do not override dashboard locale automatically.
        setLocaleState(getStoredLocale());
    }, [guildId]);

    const setLocale = (next: LocaleCode) => {
        const normalized = normalizeLocale(next);
        setStoredLocale(normalized);
        setLocaleState(normalized);
    };

    return { locale, setLocale };
};
