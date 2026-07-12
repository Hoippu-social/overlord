import { redirect } from 'next/navigation';

export default async function LegacyTicketStatsPage({ params }: { params: Promise<{ guildId: string }> }) {
    const { guildId } = await params;
    redirect(`/dashboard/${guildId}/tickets`);
}
