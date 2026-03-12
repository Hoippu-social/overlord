import { PrismaClient } from '@prisma/client';

const run = async () => {
    const url = 'file:D:/discord_bot/Dev/bot/prisma/stats.db';
    const prisma = new PrismaClient({ datasources: { db: { url } } });

    try {
        console.log("Checking StatActivity oldest records...");
        const sample = await (prisma as any).statActivity.findFirst({
            orderBy: { startTime: 'asc' }
        });
        console.log(`Oldest StatActivity: ${sample?.startTime} (Name: ${sample?.name})`);

        const febCount = await (prisma as any).statActivity.count({
            where: {
                startTime: {
                    gte: new Date('2026-02-01'),
                    lt: new Date('2026-03-01')
                }
            }
        });
        console.log(`Found ${febCount} activity records in February.`);

    } catch (e: any) {
        console.log("Error:", e.message);
    } finally {
        await prisma.$disconnect();
    }
};

run().catch(console.error);
