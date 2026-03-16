import { statsPrisma } from '@/lib/prisma';

const isMissingTableError = (error: unknown) => {
    const err = error as { code?: string; message?: string };
    if (err?.code === 'P2021') return true;
    const message = err?.message || '';
    return message.includes('no such table') || message.includes('does not exist');
};

export async function upsertTimezoneRebuildState(
    guildId: string,
    timezone: string,
    source = 'bot-settings'
) {
    try {
        const current = await statsPrisma.statsAggregationState.findUnique({
            where: { guildId },
            select: { timezone: true },
        });

        const timezoneChanged = current?.timezone !== timezone;

        await statsPrisma.statsAggregationState.upsert({
            where: { guildId },
            update: {
                timezone,
                rebuildRequired: timezoneChanged,
                jobStatus: timezoneChanged ? 'PENDING_TZ_REBUILD' : 'IDLE',
            },
            create: {
                guildId,
                timezone,
                rebuildRequired: true,
                jobStatus: 'PENDING_TZ_REBUILD',
            },
        });

        if (timezoneChanged || !current) {
            await statsPrisma.guildTimezoneHistory.create({
                data: {
                    guildId,
                    timezone,
                    source,
                },
            });
        }

        return { supported: true, timezoneChanged };
    } catch (error) {
        if (isMissingTableError(error)) {
            return { supported: false, timezoneChanged: false };
        }

        throw error;
    }
}
