import { PrismaClient } from '@prisma/client';

const run = async () => {
    const url = 'file:D:/discord_bot/Dev/bot/prisma/development.db';
    const prisma = new PrismaClient({ datasources: { db: { url } } });

    try {
        console.log("Checking StatMessage (raw) for February in development.db...");
        const msgCount = await (prisma as any).statMessage.count({
            where: {
                createdAt: {
                    gte: new Date('2026-02-01'),
                    lt: new Date('2026-03-01')
                }
            }
        });
        console.log(`Found ${msgCount} raw messages in February.`);

    } catch (e: any) {
        console.log("Error:", e.message);
    } finally {
        await prisma.$disconnect();
    }
};

run().catch(console.error);
