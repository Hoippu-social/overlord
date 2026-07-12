'use client';

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';

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

const subscribeLocale = (onStoreChange: () => void) => {
    if (typeof window === 'undefined') return () => undefined;

    const handleLocaleChange = () => onStoreChange();
    const handleStorage = (event: StorageEvent) => {
        if (event.key === STORAGE_KEY) {
            onStoreChange();
        }
    };

    window.addEventListener(LOCALE_EVENT, handleLocaleChange);
    window.addEventListener('storage', handleStorage);
    return () => {
        window.removeEventListener(LOCALE_EVENT, handleLocaleChange);
        window.removeEventListener('storage', handleStorage);
    };
};

const getServerLocale = () => DEFAULT_LOCALE;

export const useGuildLocale = (guildId?: string) => {
    void guildId;

    const locale = useSyncExternalStore(subscribeLocale, getStoredLocale, getServerLocale);

    const setLocale = useCallback((next: LocaleCode) => {
        const normalized = normalizeLocale(next);
        setStoredLocale(normalized);
    }, []);

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
