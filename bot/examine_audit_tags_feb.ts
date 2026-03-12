import { PrismaClient } from '@prisma/client';

const run = async () => {
    const url = 'file:D:/discord_bot/Dev/bot/prisma/development.db';
    const prisma = new PrismaClient({ datasources: { db: { url } } });

    try {
        console.log("Searching for ANY AuditLogEvent in February...");
        const count = await (prisma as any).auditLogEvent.count({
            where: {
                createdAt: {
                    gte: new Date('2026-02-01'),
                    lt: new Date('2026-03-01')
                }
            }
        });
        console.log(`Found ${count} total events in Feb AuditLog.`);

        if (count > 0) {
            const tags = await (prisma as any).auditLogEvent.groupBy({
                by: ['tag'],
                where: {
                    createdAt: {
                        gte: new Date('2026-02-01'),
                        lt: new Date('2026-03-01')
                    }
                },
                _count: { id: true }
            });
            console.log("Tags found:", JSON.stringify(tags, null, 2));
        }

    } catch (e: any) {
        console.log("Error:", e.message);
    } finally {
        await prisma.$disconnect();
    }
};

run().catch(console.error);
