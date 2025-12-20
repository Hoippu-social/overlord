'use client';

import { NextUIProvider } from '@nextui-org/react';
import { ThemeProvider as NextThemesProvider } from 'next-themes';
import { useRouter } from 'next/navigation';
import { SessionProvider } from 'next-auth/react';

export function Providers({ children }: { children: React.ReactNode }) {
    const router = useRouter();

    return (
        <SessionProvider>
            <NextThemesProvider attribute="class" defaultTheme="dark" enableSystem={false}>
                <NextUIProvider navigate={router.push}>
                    {children}
                </NextUIProvider>
            </NextThemesProvider>
        </SessionProvider>
    );
}
