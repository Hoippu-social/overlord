import { redirect } from 'next/navigation';

export default async function StatsSettingsRedirect({
    params,
}: {
    params: Promise<{ guildId: string }>;
}) {
    const { guildId } = await params;
    redirect(`/dashboard/${guildId}/stats`);
}
