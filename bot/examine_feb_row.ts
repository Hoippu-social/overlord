import { PrismaClient } from '@prisma/client';

const run = async () => {
    const url = 'file:D:/discord_bot/Dev/bot/prisma/development.db';
    const prisma = new PrismaClient({ datasources: { db: { url } } });

    try {
        const febRow = await (prisma as any).statDaily.findFirst({
            where: {
                date: { gte: new Date('2026-02-12'), lt: new Date('2026-02-13') }
            }
        });

        console.log("Feb 12th StatDaily row:");
        console.log(JSON.stringify(febRow, null, 2));

    } catch (e: any) {
        console.log("Error:", e.message);
    } finally {
        await prisma.$disconnect();
    }
};

run().catch(console.error);
