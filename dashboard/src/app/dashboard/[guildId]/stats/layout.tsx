import React from 'react';
import { StatsNav } from '@/components/StatsNav';

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
            <div className="px-3 pt-4 pb-4 sm:px-6 sm:pt-6">
                <StatsNav guildId={guildId} />
            </div>

            {/* Main content */}
            <div className="pb-20">
                {children}
            </div>
        </div>
    );
}
