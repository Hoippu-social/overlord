import { PrismaClient } from '@prisma/client';
import path from 'path';

const statsPrisma = new PrismaClient({
    datasources: { db: { url: `file:${path.resolve('../bot/prisma/stats.db')}` } }
});

async function computeTextEdges(guildId: string, startDate: Date) {
    const interactions = await statsPrisma.statInteraction.findMany({
        where: { guildId, createdAt: { gte: startDate } },
        select: { fromUserId: true, toUserId: true, type: true }
    });

    const edges = new Map<string, { weight: number; types: Set<string> }>();
    const REPLY_WEIGHT = 3;
    const MENTION_WEIGHT = 2;

    for (const ix of interactions) {
        if (ix.fromUserId === ix.toUserId) continue;
        const key = [ix.fromUserId, ix.toUserId].sort().join('|');
        if (!edges.has(key)) edges.set(key, { weight: 0, types: new Set() });
        const edge = edges.get(key)!;
        edge.weight += ix.type === 'REPLY' ? REPLY_WEIGHT : MENTION_WEIGHT;
        edge.types.add(ix.type.toLowerCase());
    }
    return edges;
}

async function computeVoiceEdges(guildId: string, startDate: Date) {
    const sessions = await statsPrisma.statVoiceState.findMany({
        where: { guildId, OR: [{ leftAt: { gte: startDate } }, { leftAt: null, joinedAt: { gte: startDate } }] },
        select: { userId: true, channelId: true, joinedAt: true, leftAt: true, duration: true }
    });

    const edgeWeights = new Map<string, number>();
    const channelGroups = new Map<string, any[]>();
    for (const s of sessions) {
        if (!channelGroups.has(s.channelId)) channelGroups.set(s.channelId, []);
        channelGroups.get(s.channelId)!.push(s);
    }

    for (const [channelId, participants] of channelGroups) {
        for (let i = 0; i < participants.length; i++) {
            for (let j = i + 1; j < participants.length; j++) {
                const a = participants[i];
                const b = participants[j];
                if (a.userId === b.userId) continue;

                const start = Math.max(a.joinedAt.getTime(), b.joinedAt.getTime());
                const endA = a.leftAt ? a.leftAt.getTime() : (a.joinedAt.getTime() + (a.duration || 0) * 1000);
                const endB = b.leftAt ? b.leftAt.getTime() : (b.joinedAt.getTime() + (b.duration || 0) * 1000);
                const end = Math.min(endA, endB);

                const overlapSec = Math.max(0, Math.floor((end - start) / 1000));
                if (overlapSec > 30) {
                    const key = [a.userId, b.userId].sort().join('|');
                    edgeWeights.set(key, (edgeWeights.get(key) || 0) + overlapSec);
                }
            }
        }
    }
    return edgeWeights;
}

async function run() {
    const guildId = '1374115841855197184';
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    console.log('Computing text edges...');
    const textEdges = await computeTextEdges(guildId, startDate);
    console.log(`Found ${textEdges.size} text edges.`);

    console.log('Computing voice edges...');
    const voiceWeights = await computeVoiceEdges(guildId, startDate);
    console.log(`Found ${voiceWeights.size} voice edges (potential).`);

    const mergedEdges = new Map<string, { weight: number; types: string[] }>();
    for (const [key, overlapSec] of voiceWeights) {
        const weight = Math.floor(overlapSec / 300);
        if (weight <= 0) continue;
        if (!mergedEdges.has(key)) mergedEdges.set(key, { weight: 0, types: [] });
        const e = mergedEdges.get(key)!;
        e.weight += weight;
        e.types.push('voice');
    }

    for (const [key, data] of textEdges) {
        if (!mergedEdges.has(key)) mergedEdges.set(key, { weight: 0, types: [] });
        const e = mergedEdges.get(key)!;
        e.weight += data.weight;
        for (const t of data.types) e.types.push(t);
    }

    console.log(`Edges in mixed mode: ${mergedEdges.size}`);
}

run().finally(() => statsPrisma.$disconnect());
