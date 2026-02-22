import React from 'react';
import { StatsNav } from '@/components/StatsNav';
import { SyncProgressBar } from '@/components/stats/SyncProgressBar';

export default async function StatsLayout({
    children,
    params,
}: {
    children: React.ReactNode;
    params: Promise<{ guildId: string }>;
}) {
    const { guildId } = await params;

    return (
        <div className="relative min-h-screen">
            {/* Sync Progress Bar handles auto-sync logic internally */}
            <SyncProgressBar guildId={guildId} />

            <div className="px-6 pt-6">
                <StatsNav guildId={guildId} />
            </div>

            {/* Main content */}
            <div className="pb-20">
                {children}
            </div>
        </div>
    );
}
