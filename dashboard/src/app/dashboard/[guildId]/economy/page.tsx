import React from 'react';
import { EconomyWorkspace } from '@/components/economy/EconomyWorkspace';

export default async function EconomyPage({ params }: { params: Promise<{ guildId: string }> }) {
    const { guildId } = await params;

    return <EconomyWorkspace guildId={guildId} />;
}
