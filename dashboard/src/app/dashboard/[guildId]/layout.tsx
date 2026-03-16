import React from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';

import { prisma } from '@/lib/prisma';

interface LayoutProps {
    children: React.ReactNode;
    params: Promise<{ guildId: string }>;
}

export default async function GuildLayout({ children, params }: LayoutProps) {
    const { guildId } = await params;

    let guildName = null;
    let guildIcon = null;

    try {
        const guild = await prisma.guild.findUnique({
            where: { id: guildId },
            select: { name: true, icon: true }
        });
        if (guild) {
            guildName = guild.name;
            guildIcon = guild.icon;
        }
    } catch (e) {
        console.error("Failed to fetch guild info for layout:", e);
    }

    return (
        <DashboardLayout guildId={guildId} guildName={guildName} guildIcon={guildIcon}>
            {children}
        </DashboardLayout>
    );
}
