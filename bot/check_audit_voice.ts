import { PrismaClient } from '@prisma/client';

const run = async () => {
    const url = 'file:D:/discord_bot/Dev/bot/prisma/development.db';
    const prisma = new PrismaClient({ datasources: { db: { url } } });

    try {
        console.log("Checking AuditLogEvent for 'voice' tag in February...");
        const count = await (prisma as any).auditLogEvent.count({
            where: {
                tag: 'voice',
                createdAt: {
                    gte: new Date('2026-02-01'),
                    lt: new Date('2026-03-01')
                }
            }
        });
        console.log(`Found ${count} voice audit log events in Feb.`);

        if (count > 0) {
            const sample = await (prisma as any).auditLogEvent.findFirst({
                where: { tag: 'voice', createdAt: { gte: new Date('2026-02-01') } },
                orderBy: { createdAt: 'asc' }
            });
            console.log("Sample event:", JSON.stringify(sample, null, 2));
        }

    } catch (e: any) {
        console.log("Error:", e.message);
    } finally {
        await prisma.$disconnect();
    }
};

run().catch(console.error);
