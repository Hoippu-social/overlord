import { NextRequest, NextResponse } from 'next/server';
import { requireGuildStatsAccess } from '@/lib/statsAccess';
import { isStatsPostgres, statsPrisma } from '@/lib/prisma';

type WindowKey = '24h' | '7d';

const parseWindow = (value: string | null): WindowKey => {
    return value === '7d' ? '7d' : '24h';
};

const buildWindowStart = (window: WindowKey) => {
    const now = new Date();
    if (window === '7d') {
        return new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
    }
    return new Date(now.getTime() - (24 * 60 * 60 * 1000));
};

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ guildId: string }> }
): Promise<Response> {
    const { guildId } = await params;
    const access = await requireGuildStatsAccess(request, guildId);
    if ('error' in access) {
        return access.error as Response;
    }

    if (!isStatsPostgres) {
        return NextResponse.json({ error: 'Stats telemetry requires PostgreSQL runtime.' }, { status: 400 });
    }

    const window = parseWindow(request.nextUrl.searchParams.get('window'));
    const windowStart = buildWindowStart(window);
    const bucketUnit = window === '7d' ? 'day' : 'hour';
    const bucketFormat = window === '7d' ? 'YYYY-MM-DD' : 'YYYY-MM-DD HH24:00';

    try {
        const [
            summaryRows,
            endpointRows,
            timelineRows,
            state,
            lastSourceRows,
            activeGuildRows,
        ] = await Promise.all([
            statsPrisma.$queryRaw<Array<{
                requests: number;
                avgMs: number;
                p50Ms: number;
                p95Ms: number;
                p99Ms: number;
                errorCount: number;
                slowRequests: number;
                distinctEndpoints: number;
            }>>`
                SELECT
                    COUNT(*)::int AS "requests",
                    COALESCE(AVG("durationMs"), 0)::float8 AS "avgMs",
                    COALESCE(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY "durationMs"), 0)::float8 AS "p50Ms",
                    COALESCE(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY "durationMs"), 0)::float8 AS "p95Ms",
                    COALESCE(PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY "durationMs"), 0)::float8 AS "p99Ms",
                    COALESCE(SUM(CASE WHEN "statusCode" >= 400 THEN 1 ELSE 0 END), 0)::int AS "errorCount",
                    COALESCE(SUM(CASE WHEN "durationMs" >= 1000 THEN 1 ELSE 0 END), 0)::int AS "slowRequests",
                    COUNT(DISTINCT "endpoint")::int AS "distinctEndpoints"
                FROM "StatsApiRequestMetric"
                WHERE "guildId" = ${guildId}
                  AND "createdAt" >= ${windowStart}
            `,
            statsPrisma.$queryRaw<Array<{
                endpoint: string;
                requests: number;
                p95Ms: number;
                errorRate: number;
            }>>`
                SELECT
                    "endpoint",
                    COUNT(*)::int AS "requests",
                    COALESCE(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY "durationMs"), 0)::float8 AS "p95Ms",
                    COALESCE(100.0 * SUM(CASE WHEN "statusCode" >= 400 THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 0)::float8 AS "errorRate"
                FROM "StatsApiRequestMetric"
                WHERE "guildId" = ${guildId}
                  AND "createdAt" >= ${windowStart}
                GROUP BY "endpoint"
                ORDER BY "p95Ms" DESC, "requests" DESC
                LIMIT 8
            `,
            statsPrisma.$queryRaw<Array<{
                bucket: string;
                requests: number;
                p95Ms: number;
                errorRate: number;
            }>>`
                SELECT
                    TO_CHAR(DATE_TRUNC(${bucketUnit}, "createdAt"), ${bucketFormat}) AS "bucket",
                    COUNT(*)::int AS "requests",
                    COALESCE(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY "durationMs"), 0)::float8 AS "p95Ms",
                    COALESCE(100.0 * SUM(CASE WHEN "statusCode" >= 400 THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 0)::float8 AS "errorRate"
                FROM "StatsApiRequestMetric"
                WHERE "guildId" = ${guildId}
                  AND "createdAt" >= ${windowStart}
                GROUP BY 1
                ORDER BY 1 ASC
            `,
            statsPrisma.statsAggregationState.findUnique({
                where: { guildId },
            }),
            statsPrisma.$queryRaw<Array<{ lastSourceEventAt: Date | null }>>`
                SELECT MAX("eventTs") AS "lastSourceEventAt"
                FROM (
                    SELECT MAX("createdAt") AS "eventTs" FROM "StatMessage" WHERE "guildId" = ${guildId}
                    UNION ALL
                    SELECT MAX(COALESCE("leftAt", "joinedAt")) AS "eventTs" FROM "StatVoiceState" WHERE "guildId" = ${guildId}
                    UNION ALL
                    SELECT MAX("createdAt") AS "eventTs" FROM "StatInteraction" WHERE "guildId" = ${guildId}
                    UNION ALL
                    SELECT MAX(COALESCE("endTime", "startTime")) AS "eventTs" FROM "StatActivity" WHERE "guildId" = ${guildId}
                    UNION ALL
                    SELECT MAX("createdAt") AS "eventTs" FROM "StatMemberEvent" WHERE "guildId" = ${guildId}
                ) AS "sourceEvents"
            `,
            statsPrisma.$queryRaw<Array<{ activeGuilds30d: number }>>`
                WITH "recentGuilds" AS (
                    SELECT "guildId" FROM "StatMessage" WHERE "createdAt" >= NOW() - INTERVAL '30 days'
                    UNION
                    SELECT "guildId" FROM "StatVoiceState" WHERE COALESCE("leftAt", "joinedAt") >= NOW() - INTERVAL '30 days'
                    UNION
                    SELECT "guildId" FROM "StatActivity" WHERE COALESCE("endTime", "startTime") >= NOW() - INTERVAL '30 days'
                    UNION
                    SELECT "guildId" FROM "StatInteraction" WHERE "createdAt" >= NOW() - INTERVAL '30 days'
                    UNION
                    SELECT "guildId" FROM "StatMemberEvent" WHERE "createdAt" >= NOW() - INTERVAL '30 days'
                )
                SELECT COUNT(*)::int AS "activeGuilds30d"
                FROM "recentGuilds"
            `,
        ]);

        const summary = summaryRows[0] ?? {
            requests: 0,
            avgMs: 0,
            p50Ms: 0,
            p95Ms: 0,
            p99Ms: 0,
            errorCount: 0,
            slowRequests: 0,
            distinctEndpoints: 0,
        };
        const lastSourceEventAt = lastSourceRows[0]?.lastSourceEventAt ?? null;
        const lastReadModelSyncAt = state?.lastReadModelSyncAt ?? null;
        const readModelLagMinutes = lastSourceEventAt && lastReadModelSyncAt
            ? Math.max(0, Math.round((new Date(lastSourceEventAt).getTime() - new Date(lastReadModelSyncAt).getTime()) / 60000))
            : null;

        return NextResponse.json({
            window,
            summary: {
                requests: Number(summary.requests || 0),
                avgMs: Number(summary.avgMs || 0),
                p50Ms: Number(summary.p50Ms || 0),
                p95Ms: Number(summary.p95Ms || 0),
                p99Ms: Number(summary.p99Ms || 0),
                errorCount: Number(summary.errorCount || 0),
                slowRequests: Number(summary.slowRequests || 0),
                distinctEndpoints: Number(summary.distinctEndpoints || 0),
                errorRate: Number(summary.requests || 0) > 0
                    ? Number((((summary.errorCount || 0) / summary.requests) * 100).toFixed(2))
                    : 0,
            },
            endpoints: endpointRows.map((row) => ({
                endpoint: row.endpoint,
                requests: Number(row.requests || 0),
                p95Ms: Number(row.p95Ms || 0),
                errorRate: Number(row.errorRate || 0),
            })),
            timeline: timelineRows.map((row) => ({
                date: row.bucket,
                requests: Number(row.requests || 0),
                p95Ms: Number(row.p95Ms || 0),
                errorRate: Number(row.errorRate || 0),
            })),
            ingestion: {
                activeGuilds30d: Number(activeGuildRows[0]?.activeGuilds30d || 0),
                rebuildRequired: Boolean(state?.rebuildRequired),
                jobStatus: state?.jobStatus || 'UNKNOWN',
                lastSourceEventAt,
                lastReadModelSyncAt,
                readModelLagMinutes,
            },
        });
    } catch (error) {
        console.error('[stats-telemetry] Failed to build telemetry response:', error);
        return NextResponse.json({ error: 'Failed to load stats telemetry.' }, { status: 500 });
    }
}
