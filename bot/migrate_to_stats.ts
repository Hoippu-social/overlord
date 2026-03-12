import { PrismaClient } from '@prisma/client';

const run = async () => {
    const prisma = new PrismaClient({ datasources: { db: { url: 'file:../../bot/prisma/development.db' } } });
    const statsPrisma = new PrismaClient({ datasources: { db: { url: 'file:../../bot/prisma/stats.db' } } });

    console.log("Starting data migration from development.db to stats.db...");

    // Helper: Migrate a table using findMany chunks and createMany
    async function migrateTable(
        tableName: string,
        selectFields: string[],
        dateField: string,
        uniqueCheck: (devRow: any, statsRow: any) => boolean
    ) {
        console.log(`Migrating ${tableName}...`);

        let skip = 0;
        const take = 1000;
        let totalCreated = 0;

        while (true) {
            const batch = await (prisma as any)[tableName].findMany({
                skip,
                take,
                orderBy: { [dateField]: 'asc' }
            });

            if (batch.length === 0) break;

            const batchStart = batch[0][dateField];
            const batchEnd = batch[batch.length - 1][dateField];

            const existingInStats = await (statsPrisma as any)[tableName].findMany({
                where: {
                    [dateField]: {
                        gte: batchStart,
                        lte: batchEnd
                    }
                }
            });

            const toCreate = batch.filter((devRow: any) => {
                return !existingInStats.some((statsRow: any) => uniqueCheck(devRow, statsRow));
            }).map((r: any) => {
                const { id, ...rest } = r; // remove auto-increment id
                return rest;
            });

            if (toCreate.length > 0) {
                await (statsPrisma as any)[tableName].createMany({ data: toCreate });
                totalCreated += toCreate.length;
                console.log(`  Inserted ${toCreate.length} new records into ${tableName}`);
            }

            skip += take;
        }
        console.log(`Finished migrating ${tableName}. Inserted ${totalCreated} total new records.`);
    }

    // 1. StatVoiceState
    await migrateTable('statVoiceState', [], 'joinedAt', (d, s) => d.userId === s.userId && d.channelId === s.channelId && d.joinedAt.getTime() === s.joinedAt.getTime());

    // 2. StatMessage
    await migrateTable('statMessage', [], 'createdAt', (d, s) => d.authorId === s.authorId && d.channelId === s.channelId && d.createdAt.getTime() === s.createdAt.getTime());

    // 3. StatActivity
    await migrateTable('statActivity', [], 'startTime', (d, s) => d.userId === s.userId && d.name === s.name && d.startTime.getTime() === s.startTime.getTime());

    // 4. StatInteraction
    await migrateTable('statInteraction', [], 'createdAt', (d, s) => d.fromUserId === s.fromUserId && d.toUserId === s.toUserId && d.type === s.type && d.createdAt.getTime() === s.createdAt.getTime());

    // 5. StatMemberCount
    await migrateTable('statMemberCount', [], 'createdAt', (d, s) => d.guildId === s.guildId && d.createdAt.getTime() === s.createdAt.getTime());

    console.log("Migration completed!");
}

run().catch(console.error);
