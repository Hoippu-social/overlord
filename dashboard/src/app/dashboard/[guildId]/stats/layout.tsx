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
        <div className="relative -mx-6 min-h-screen sm:mx-0">
            <div className="sticky top-0 z-20 border-b border-divider bg-background/95 px-3 pb-3 pt-2 backdrop-blur-xl sm:static sm:border-b-0 sm:bg-transparent sm:px-0 sm:pb-4 sm:pt-0">
                <StatsNav guildId={guildId} />
            </div>

            {/* Main content */}
            <div className="pb-20">
                {children}
            </div>
        </div>
    );
}
