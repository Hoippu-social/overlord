import { PrismaClient } from '@prisma/client';
import path from 'path';

const statsPrisma = new PrismaClient({
    datasources: { db: { url: `file:${path.resolve('../bot/prisma/stats.db')}` } }
});

async function run() {
    const guildId = '1374115841855197184';
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    console.log(`Checking StatInteraction for guild ${guildId} since ${startDate.toISOString()}...`);
    const interactions = await statsPrisma.statInteraction.findMany({
        where: { guildId, createdAt: { gte: startDate } }
    });

    const userSet = new Set<string>();
    for (const i of interactions) {
        userSet.add(i.fromUserId);
        userSet.add(i.toUserId);
    }

    const voice = await statsPrisma.statVoiceState.findMany({
        where: { guildId, OR: [{ leftAt: { gte: startDate } }, { leftAt: null, joinedAt: { gte: startDate } }] }
    });
    for (const v of voice) {
        userSet.add(v.userId);
    }

    console.log(`Found ${interactions.length} interactions and ${voice.length} voice states.`);
    console.log(`Total unique active users: ${userSet.size}`);

    if (userSet.size > 150) {
        console.log('--- EGO MODE TRIGGERED ---');
    } else {
        console.log('--- FULL GRAPH MODE ---');
    }
}

run().finally(() => statsPrisma.$disconnect());
