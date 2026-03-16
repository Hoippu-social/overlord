import { NextRequest, NextResponse } from 'next/server';
import { statsPrisma } from '@/lib/prisma';
import { requireGuildStatsAccess } from '@/lib/statsAccess';
import { getStatsStartDate, normalizeStatsPeriod } from '@/lib/stats';
import { withStatsTelemetry } from '@/lib/statsTelemetry';

export const dynamic = 'force-dynamic';

const BOT_API_URL = process.env.BOT_API_URL || 'http://127.0.0.1:3002';
const FULL_GRAPH_THRESHOLD = 150;

type UserInfo = {
    name?: string;
    avatar?: string | null;
};

type VoiceSessionInterval = {
    userId: string;
    channelId: string;
    start: number;
    end: number;
};

async function enrichUsers(
    guildId: string,
    userIds: string[]
): Promise<Map<string, { name: string; avatar: string | null }>> {
    const map = new Map<string, { name: string; avatar: string | null }>();
    if (userIds.length === 0) return map;

    try {
        const res = await fetch(`${BOT_API_URL}/api/enrich`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ guildId, userIds, channelIds: [] }),
        });
        if (!res.ok) return map;

        const data = await res.json();
        for (const [id, rawInfo] of Object.entries(data.users || {})) {
            const info = rawInfo as UserInfo;
            map.set(id, {
                name: info.name || id,
                avatar: info.avatar || null,
            });
        }
    } catch {
        // Bot API unavailable; fall back to raw IDs.
    }

    return map;
}

async function computeVoiceEdges(guildId: string, startDate: Date): Promise<Map<string, number>> {
    const nowMs = Date.now();
    const sessions = await statsPrisma.statVoiceState.findMany({
        where: {
            guildId,
            OR: [
                { leftAt: { gte: startDate } },
                { leftAt: null, joinedAt: { gte: startDate } },
            ],
        },
        select: {
            userId: true,
            channelId: true,
            joinedAt: true,
            leftAt: true,
        },
        orderBy: [{ channelId: 'asc' }, { joinedAt: 'asc' }],
    });

    const processedSessions: VoiceSessionInterval[] = sessions.map((session) => ({
        userId: session.userId,
        channelId: session.channelId,
        start: session.joinedAt.getTime(),
        end: session.leftAt ? session.leftAt.getTime() : nowMs,
    }));

    const byChannel = new Map<string, VoiceSessionInterval[]>();
    for (const session of processedSessions) {
        if (!byChannel.has(session.channelId)) {
            byChannel.set(session.channelId, []);
        }
        byChannel.get(session.channelId)!.push(session);
    }

    const edgeWeights = new Map<string, number>();

    for (const channelSessions of byChannel.values()) {
        channelSessions.sort((a, b) => a.start - b.start || a.end - b.end);
        const active: VoiceSessionInterval[] = [];

        for (const session of channelSessions) {
            let writeIndex = 0;
            for (const candidate of active) {
                if (candidate.end > session.start) {
                    active[writeIndex++] = candidate;
                }
            }
            active.length = writeIndex;

            for (const candidate of active) {
                if (candidate.userId === session.userId) continue;

                const overlapStart = Math.max(candidate.start, session.start);
                const overlapEnd = Math.min(candidate.end, session.end);
                if (overlapEnd <= overlapStart) continue;

                const overlapSec = (overlapEnd - overlapStart) / 1000;
                const key = [candidate.userId, session.userId].sort().join('|');
                edgeWeights.set(key, (edgeWeights.get(key) || 0) + overlapSec);
            }

            active.push(session);
        }
    }

    return edgeWeights;
}

async function computeTextEdges(
    guildId: string,
    startDate: Date
): Promise<Map<string, { weight: number; types: Set<string> }>> {
    const interactions = await statsPrisma.statInteraction.findMany({
        where: { guildId, createdAt: { gte: startDate } },
        select: { fromUserId: true, toUserId: true, type: true },
    });

    const edges = new Map<string, { weight: number; types: Set<string> }>();
    const replyWeight = 3;
    const mentionWeight = 2;

    for (const interaction of interactions) {
        const key = [interaction.fromUserId, interaction.toUserId].sort().join('|');
        if (!edges.has(key)) {
            edges.set(key, { weight: 0, types: new Set() });
        }

        const edge = edges.get(key)!;
        edge.weight += interaction.type === 'REPLY' ? replyWeight : mentionWeight;
        edge.types.add(interaction.type.toLowerCase());
    }

    return edges;
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ guildId: string }> }
) {
    const { guildId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const period = normalizeStatsPeriod(searchParams.get('period') || '30d');
    return withStatsTelemetry({ guildId, endpoint: 'contacts', method: 'GET', period }, async () => {
        const access = await requireGuildStatsAccess(request, guildId);
        if (!access.ok) {
            return access.response;
        }

        try {
            const mode = (searchParams.get('mode') || 'mixed') as 'voice' | 'text' | 'mixed';
            const focusUserId = searchParams.get('userId') || null;
            const startDate = getStatsStartDate(period);

        const voiceEdges =
            mode === 'voice' || mode === 'mixed'
                ? await computeVoiceEdges(guildId, startDate)
                : new Map<string, number>();

        const textEdges =
            mode === 'text' || mode === 'mixed'
                ? await computeTextEdges(guildId, startDate)
                : new Map<string, { weight: number; types: Set<string> }>();

        const mergedEdges = new Map<string, { weight: number; types: string[] }>();
        const voiceWeightPerFiveMin = 1;

        for (const [key, overlapSec] of voiceEdges) {
            const weight = Math.floor(overlapSec / 300) * voiceWeightPerFiveMin;
            if (weight <= 0) continue;

            if (!mergedEdges.has(key)) {
                mergedEdges.set(key, { weight: 0, types: [] });
            }

            const edge = mergedEdges.get(key)!;
            edge.weight += weight;
            if (!edge.types.includes('voice')) {
                edge.types.push('voice');
            }
        }

        for (const [key, data] of textEdges) {
            if (!mergedEdges.has(key)) {
                mergedEdges.set(key, { weight: 0, types: [] });
            }

            const edge = mergedEdges.get(key)!;
            edge.weight += data.weight;
            for (const type of data.types) {
                if (!edge.types.includes(type)) {
                    edge.types.push(type);
                }
            }
        }

        const userActivity = new Map<string, number>();
        for (const [key, edge] of mergedEdges) {
            const [a, b] = key.split('|');
            userActivity.set(a, (userActivity.get(a) || 0) + edge.weight);
            userActivity.set(b, (userActivity.get(b) || 0) + edge.weight);
        }

        const uniqueActiveUsers = userActivity.size;
        const graphMode = uniqueActiveUsers <= FULL_GRAPH_THRESHOLD ? 'full' : 'ego';

        if (graphMode === 'ego' && !focusUserId) {
            const topUsers = Array.from(userActivity.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, 30)
                .map(([id]) => id);

            const userInfo = await enrichUsers(guildId, topUsers);
            return NextResponse.json({
                graphMode: 'ego',
                uniqueActiveUsers,
                topUsers: topUsers.map((id) => ({
                    id,
                    name: userInfo.get(id)?.name || id,
                    avatar: userInfo.get(id)?.avatar || null,
                    activity: userActivity.get(id) || 0,
                })),
                nodes: [],
                edges: [],
            });
        }

        let relevantUserIds: Set<string>;
        if (graphMode === 'full') {
            relevantUserIds = new Set(userActivity.keys());
        } else {
            relevantUserIds = new Set<string>();
            if (focusUserId) {
                relevantUserIds.add(focusUserId);
                const level1 = new Set<string>();

                for (const key of mergedEdges.keys()) {
                    const [a, b] = key.split('|');
                    if (a === focusUserId) {
                        level1.add(b);
                        relevantUserIds.add(b);
                    }
                    if (b === focusUserId) {
                        level1.add(a);
                        relevantUserIds.add(a);
                    }
                }

                for (const level1User of level1) {
                    for (const key of mergedEdges.keys()) {
                        const [a, b] = key.split('|');
                        if (a === level1User && !relevantUserIds.has(b)) relevantUserIds.add(b);
                        if (b === level1User && !relevantUserIds.has(a)) relevantUserIds.add(a);
                    }
                }
            }
        }

        const maxActivity = Math.max(
            ...Array.from(relevantUserIds).map((id) => userActivity.get(id) || 0),
            1
        );
        const normalizeActivity = (value: number) =>
            Math.max(1, Math.round((value / maxActivity) * 9) + 1);

        const userInfo = await enrichUsers(guildId, Array.from(relevantUserIds));
        const topUsersRaw = Array.from(userActivity.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 30)
            .map(([id]) => id);
        const topUsersInfo = await enrichUsers(
            guildId,
            topUsersRaw.filter((id) => !userInfo.has(id))
        );
        const allUserInfo = new Map([...userInfo, ...topUsersInfo]);

        const nodes = Array.from(relevantUserIds).map((id) => ({
            id,
            name: allUserInfo.get(id)?.name || id,
            avatar: allUserInfo.get(id)?.avatar || null,
            activity: userActivity.get(id) || 0,
            size: normalizeActivity(userActivity.get(id) || 0),
            level: id === focusUserId ? 0 : undefined,
        }));

        const edges: { source: string; target: string; weight: number; types: string[] }[] = [];
        for (const [key, data] of mergedEdges) {
            const [a, b] = key.split('|');
            if (relevantUserIds.has(a) && relevantUserIds.has(b)) {
                edges.push({ source: a, target: b, weight: data.weight, types: data.types });
            }
        }

            return NextResponse.json({
                graphMode,
                uniqueActiveUsers,
                topUsers: topUsersRaw.map((id) => ({
                    id,
                    name: allUserInfo.get(id)?.name || id,
                    avatar: allUserInfo.get(id)?.avatar || null,
                    activity: userActivity.get(id) || 0,
                })),
                nodes,
                edges,
            });
        } catch (error) {
            console.error('[API] Contacts graph error:', error);
            return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
        }
    });
}
