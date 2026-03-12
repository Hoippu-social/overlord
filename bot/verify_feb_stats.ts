import { PrismaClient } from '@prisma/client';

const run = async () => {
    const url = 'file:D:/discord_bot/Dev/bot/prisma/development.db';
    const prisma = new PrismaClient({ datasources: { db: { url } } });

    try {
        console.log("Checking StatDaily for February in development.db...");
        const stats = await (prisma as any).statDaily.findMany({
            where: {
                date: {
                    gte: new Date('2026-02-01'),
                    lt: new Date('2026-03-01')
                },
                voiceSeconds: { gt: 0 }
            },
            orderBy: { date: 'asc' }
        });

        if (stats.length === 0) {
            console.log("No daily stats with voice for February.");
        } else {
            console.log(`Found ${stats.length} days in Feb with voice activity.`);
            stats.forEach((s: any) => {
                console.log(`- ${s.date}: ${s.voiceSeconds} seconds (${Math.floor(s.voiceSeconds / 60)}m)`);
            });
        }

        console.log("\nChecking for ANY raw StatVoiceState records before March 4th...");
        const raw = await (prisma as any).statVoiceState.findMany({
            where: {
                joinedAt: {
                    lt: new Date('2026-03-04')
                }
            }
        });
        console.log(`Found ${raw.length} raw voice records before March 4th.`);

    } catch (e: any) {
        console.log("Error:", e.message);
    } finally {
        await prisma.$disconnect();
    }
};

run().catch(console.error);
