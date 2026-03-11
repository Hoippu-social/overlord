import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useCallback, useMemo } from 'react';

export function usePersistentPeriod(defaultPeriod = '7d') {
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();

    const period = useMemo(() => {
        return searchParams.get('period') || defaultPeriod;
    }, [searchParams, defaultPeriod]);

    const setPeriod = useCallback((newPeriod: string) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set('period', newPeriod);
        router.push(`${pathname}?${params.toString()}`, { scroll: false });
    }, [searchParams, router, pathname]);

    return [period, setPeriod] as const;
}
