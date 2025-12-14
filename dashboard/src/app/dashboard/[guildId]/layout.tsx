import React from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';

interface LayoutProps {
    children: React.ReactNode;
    params: Promise<{ guildId: string }>;
}

export default async function GuildLayout({ children, params }: LayoutProps) {
    const { guildId } = await params;

    return (
        <DashboardLayout guildId={guildId}>
            {children}
        </DashboardLayout>
    );
}
