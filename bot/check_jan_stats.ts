import { PrismaClient } from '@prisma/client';

const run = async () => {
    const url = 'file:D:/discord_bot/Dev/bot/prisma/development.db';
    const prisma = new PrismaClient({ datasources: { db: { url } } });

    try {
        console.log("Checking StatDaily for JANUARY in development.db...");
        const stats = await (prisma as any).statDaily.findMany({
            where: {
                date: {
                    gte: new Date('2026-01-01'),
                    lt: new Date('2026-02-01')
                },
                voiceSeconds: { gt: 0 }
            },
            orderBy: { date: 'asc' }
        });

        if (stats.length === 0) {
            console.log("No daily stats with voice for January.");
        } else {
            console.log(`Found ${stats.length} days in Jan with voice activity.`);
        }

    } catch (e: any) {
        console.log("Error:", e.message);
    } finally {
        await prisma.$disconnect();
    }
};

run().catch(console.error);
