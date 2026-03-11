'use client';

import React, { useState } from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from './Sidebar';
import { cn, Button } from "@nextui-org/react";
import { List } from "@phosphor-icons/react";

interface DashboardLayoutProps {
    children: React.ReactNode;
    guildId: string;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children, guildId }) => {
    const [collapsed, setCollapsed] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    const pathname = usePathname();
    const hideSidebar = pathname === `/dashboard/${guildId}`;

    return (
        <div className="flex min-h-screen bg-background">
            {/* Mobile Header when Sidebar exists */}
            {!hideSidebar && (
                <div className="md:hidden fixed top-0 left-0 w-full h-16 bg-surface border-b border-divider flex items-center justify-between px-4 z-40">
                    <div className="flex items-center gap-2">
                        <img src="/logos/logo-white.svg" alt="Overlord Logo" className="w-8 h-8 object-contain" />
                        <span className="text-xl font-akony bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent truncate tracking-widest leading-none mt-1">
                            Overlord
                        </span>
                    </div>
                    <Button isIconOnly variant="light" onPress={() => setMobileOpen(true)}>
                        <List size={24} />
                    </Button>
                </div>
            )}

            {!hideSidebar && (
                <Sidebar
                    guildId={guildId}
                    collapsed={collapsed}
                    onToggle={() => setCollapsed(!collapsed)}
                    mobileOpen={mobileOpen}
                    onMobileClose={() => setMobileOpen(false)}
                />
            )}

            <main
                className={cn(
                    "flex-1 transition-all duration-300 flex flex-col",
                    hideSidebar
                        ? "ml-0"
                        : collapsed ? "ml-0 md:ml-20 pt-16 md:pt-0" : "ml-0 md:ml-72 pt-16 md:pt-0"
                )}
            >
                <div className="p-4 md:p-8 max-w-7xl mx-auto w-full">
                    {children}
                </div>
            </main>
        </div>
    );
};
