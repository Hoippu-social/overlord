'use client';

import React from 'react';
import { Sidebar } from './Sidebar';
import { TopNav } from './TopNav';

interface DashboardLayoutProps {
    children: React.ReactNode;
    guildId: string;
    guildName?: string | null;
    guildIcon?: string | null;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children, guildId, guildName, guildIcon }) => {
    return (
        <div className="flex h-screen w-screen bg-[var(--bg-base)] text-[var(--text-primary)] overflow-hidden font-sans">
            {/* Left Sidebar (Fixed 280px) */}
            <Sidebar guildId={guildId} guildName={guildName} guildIcon={guildIcon} />

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col h-screen overflow-hidden relative min-w-0 bg-[var(--bg-base)]">
                {/* Sticky Header */}
                <TopNav guildId={guildId} guildName={guildName} guildIcon={guildIcon} />

                {/* Scrollable Content */}
                <main className="flex-1 overflow-x-hidden overflow-y-auto w-full">
                    <div className="w-full h-full p-6 xl:p-8">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
};
