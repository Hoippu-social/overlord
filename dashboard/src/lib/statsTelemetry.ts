import { isStatsPostgres, statsPrisma } from '@/lib/prisma';

interface StatsTelemetryMeta {
    guildId: string;
    endpoint: string;
    method: 'GET' | 'POST' | 'PUT' | 'DELETE';
    period?: string | null;
}

const isMissingTelemetryTableError = (error: unknown) => {
    if (!(error instanceof Error)) return false;
    const message = error.message.toLowerCase();
    return message.includes('statsapirequestmetric') && (
        message.includes('does not exist') ||
        message.includes('no such table') ||
        message.includes('unknown table')
    );
};

export async function recordStatsApiMetric(
    meta: StatsTelemetryMeta,
    statusCode: number,
    durationMs: number,
    errorCode?: string | null,
) {
    if (!isStatsPostgres) return;

    try {
        await statsPrisma.$executeRaw`
            INSERT INTO "StatsApiRequestMetric" (
                "guildId",
                "endpoint",
                "method",
                "period",
                "statusCode",
                "durationMs",
                "errorCode"
            )
            VALUES (
                ${meta.guildId},
                ${meta.endpoint},
                ${meta.method},
                ${meta.period ?? null},
                ${statusCode},
                ${Math.max(0, Math.round(durationMs))},
                ${errorCode ?? null}
            )
        `;
    } catch (error) {
        if (!isMissingTelemetryTableError(error)) {
            console.error('[stats-telemetry] Failed to record request metric:', error);
        }
    }
}

export async function withStatsTelemetry(
    meta: StatsTelemetryMeta,
    handler: () => Promise<Response>,
): Promise<Response> {
    const startedAt = Date.now();
    let statusCode = 500;
    let errorCode: string | null = null;

    try {
        const response = await handler();
        statusCode = response.status;
        return response;
    } catch (error) {
        if (error instanceof Error) {
            errorCode = error.name || 'Error';
        } else {
            errorCode = 'UnknownError';
        }
        throw error;
    } finally {
        await recordStatsApiMetric(meta, statusCode, Date.now() - startedAt, errorCode);
    }
}
