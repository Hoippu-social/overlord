import { PrismaClient } from '@prisma/client';

const run = async () => {
    const url = 'file:D:/discord_bot/Dev/bot/prisma/development.db';
    const prisma = new PrismaClient({ datasources: { db: { url } } });

    try {
        const records = await (prisma as any).statVoiceState.findMany({
            where: {
                joinedAt: {
                    lt: new Date('2026-03-04')
                }
            }
        });

        console.log("Raw StatVoiceState records before March 4th:");
        console.log(JSON.stringify(records, null, 2));

    } catch (e: any) {
        console.log("Error:", e.message);
    } finally {
        await prisma.$disconnect();
    }
};

run().catch(console.error);
