import { PrismaClient } from '@prisma/client';

const run = async () => {
    const prisma = new PrismaClient({ datasources: { db: { url: 'file:../../bot/prisma/development.db' } } });
    const statsPrisma = new PrismaClient({ datasources: { db: { url: 'file:../../bot/prisma/stats.db' } } });

    console.log("Starting aggressive data migration from development.db to stats.db...");

    async function migrateAll(tableName: string) {
        console.log(`Migrating ${tableName}...`);

        const allDevRecords = await (prisma as any)[tableName].findMany();
        if (allDevRecords.length === 0) {
            console.log(`No records found in development.db for ${tableName}.`);
            return;
        }

        let added = 0;
        let skipped = 0;

        for (const row of allDevRecords) {
            const { id, ...rest } = row; // id needs to be auto-generated in stats.db

            try {
                // To avoid duplicate entries, we can check for existence
                let exists = null;
                if (tableName === 'statMessage') {
                    exists = await (statsPrisma as any)[tableName].findFirst({
                        where: {
                            authorId: row.authorId,
                            channelId: row.channelId,
                            createdAt: row.createdAt
                        }
                    });
                } else if (tableName === 'statVoiceState') {
                    exists = await (statsPrisma as any)[tableName].findFirst({
                        where: {
                            userId: row.userId,
                            channelId: row.channelId,
                            joinedAt: row.joinedAt
                        }
                    });
                } else if (tableName === 'statActivity') {
                    exists = await (statsPrisma as any)[tableName].findFirst({
                        where: {
                            userId: row.userId,
                            name: row.name,
                            startTime: row.startTime
                        }
                    });
                } else if (tableName === 'statInteraction') {
                    exists = await (statsPrisma as any)[tableName].findFirst({
                        where: {
                            fromUserId: row.fromUserId,
                            toUserId: row.toUserId,
                            type: row.type,
                            createdAt: row.createdAt
                        }
                    });
                } else if (tableName === 'statMemberCount') {
                    exists = await (statsPrisma as any)[tableName].findFirst({
                        where: {
                            guildId: row.guildId,
                            createdAt: row.createdAt
                        }
                    });
                }

                if (!exists) {
                    await (statsPrisma as any)[tableName].create({ data: rest });
                    added++;
                } else {
                    skipped++;
                }
            } catch (err: any) {
                console.error(`Failed to insert row for ${tableName}:`, err.message);
            }
        }
        console.log(`Finished ${tableName}. Added: ${added}, Skipped (already exist): ${skipped}`);
    }

    await migrateAll('statVoiceState');
    await migrateAll('statMessage');
    await migrateAll('statActivity');
    await migrateAll('statInteraction');
    await migrateAll('statMemberCount');

    console.log("Migration completed!");
    await prisma.$disconnect();
    await statsPrisma.$disconnect();
};

run().catch(console.error);
