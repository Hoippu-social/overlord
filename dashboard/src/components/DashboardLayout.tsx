'use client';

import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { cn } from "@nextui-org/react";

interface DashboardLayoutProps {
    children: React.ReactNode;
    guildId: string;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children, guildId }) => {
    const [collapsed, setCollapsed] = useState(false);

    return (
        <div className="flex min-h-screen bg-background">
            <Sidebar
                guildId={guildId}
                collapsed={collapsed}
                onToggle={() => setCollapsed(!collapsed)}
            />

            <main
                className={cn(
                    "flex-1 transition-all duration-300 flex flex-col",
                    collapsed ? "ml-20" : "ml-72"
                )}
            >
                <div className="p-6 md:p-8 max-w-7xl mx-auto w-full">
                    {children}
                </div>
            </main>
        </div>
    );
};
