import { PrismaClient } from '@prisma/client';
import path from 'path';

const statsPrisma = new PrismaClient({
    datasources: { db: { url: `file:${path.resolve('../bot/prisma/stats.db')}` } }
});

async function run() {
    const guildId = '1374115841855197184';
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    const interactions = await statsPrisma.statInteraction.findMany({
        where: { guildId, createdAt: { gte: startDate } },
        select: { fromUserId: true, toUserId: true, type: true }
    });

    const edges = new Map<string, { weight: number; types: Set<string> }>();
    const REPLY_WEIGHT = 3;
    const MENTION_WEIGHT = 2;

    for (const ix of interactions) {
        const key = [ix.fromUserId, ix.toUserId].sort().join('|');
        if (!edges.has(key)) edges.set(key, { weight: 0, types: new Set() });
        const edge = edges.get(key)!;
        edge.weight += ix.type === 'REPLY' ? REPLY_WEIGHT : MENTION_WEIGHT;
        edge.types.add(ix.type.toLowerCase());
    }

    console.log(`Merged ${interactions.length} interactions into ${edges.size} edges.`);
    if (edges.size > 0) {
        const firstKey = Array.from(edges.keys())[0];
        console.log(`Sample edge [${firstKey}]:`, edges.get(firstKey));
    }
}

run().finally(() => statsPrisma.$disconnect());
