import { PrismaClient } from '@prisma/client';

const run = async () => {
    const url = 'file:D:/discord_bot/Dev/bot/prisma/development.db';
    const prisma = new PrismaClient({ datasources: { db: { url } } });

    try {
        console.log("Searching for ANY records in AuditLogEvent for February...");
        const events = await (prisma as any).auditLogEvent.findMany({
            where: {
                createdAt: {
                    gte: new Date('2026-02-01'),
                    lt: new Date('2026-03-01')
                }
            },
            take: 20
        });

        console.log(`Found ${events.length} sample events in February.`);
        events.forEach((evt: any) => {
            console.log(`- [${evt.createdAt}] Tag: ${evt.tag}, Payload: ${evt.payload}`);
        });

    } catch (e: any) {
        console.log("Error:", e.message);
    } finally {
        await prisma.$disconnect();
    }
};

run().catch(console.error);
