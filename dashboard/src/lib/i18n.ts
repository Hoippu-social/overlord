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

    const setLocale = (next: LocaleCode) => {
        const normalized = normalizeLocale(next);
        setStoredLocale(normalized);
        setLocaleState(normalized);
    };

    return { locale, setLocale };
};

export const useGuildTimezone = (guildId?: string) => {
    const [timezone, setTimezone] = useState<string>('Europe/Moscow');

    useEffect(() => {
        if (!guildId) return;
        fetch(`/api/guilds/${guildId}/bot-settings`)
            .then(res => res.json())
            .then(data => {
                if (data.config && data.config.timezone) {
                    setTimezone(data.config.timezone);
                }
            })
            .catch(() => { });
    }, [guildId]);

    return timezone;
};
