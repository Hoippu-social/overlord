import { useState, useEffect } from 'react';

interface UseStatsOptions {
    guildId: string;
    type: 'overview' | 'messages' | 'voice' | 'members' | 'activities';
    period: string;
}

interface StatsData {
    [key: string]: any;
}

export function useStats({ guildId, type, period }: UseStatsOptions) {
    const [data, setData] = useState<StatsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);
    const [refreshKey, setRefreshKey] = useState(0);

    const refresh = () => setRefreshKey(prev => prev + 1);

    useEffect(() => {
        let isMounted = true;
        setLoading(true);
        setError(null);

        fetch(`/api/guilds/${guildId}/stats?type=${type}&period=${period}`)
            .then(async res => {
                const text = await res.text();
                try {
                    const data = JSON.parse(text);
                    if (!res.ok) throw new Error(data.error || 'Failed to fetch stats');
                    return data;
                } catch (e) {
                    console.error('[useStats] Failed to parse JSON:', text.substring(0, 100));
                    throw new Error(`Invalid response: ${res.statusText}`);
                }
            })
            .then(data => {
                if (isMounted) {
                    setData(data);
                    setLoading(false);
                }
            })
            .catch(err => {
                if (isMounted) {
                    console.error("Stats fetch error:", err);
                    setError(err);
                    setLoading(false);
                }
            });

        return () => { isMounted = false; };
    }, [guildId, type, period, refreshKey]);

    return { data, loading, error, refresh };
}
