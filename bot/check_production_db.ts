import { PrismaClient } from '@prisma/client';

const run = async () => {
    const url = 'file:D:/discord_bot/Release/bot/prisma/production.db';
    const prisma = new PrismaClient({ datasources: { db: { url } } });

    try {
        console.log("Checking Release/bot/prisma/production.db...");
        const voiceCount = await (prisma as any).statVoiceState.count().catch(() => 'No table');
        console.log(`- statVoiceState: ${voiceCount} rows`);

        if (typeof voiceCount === 'number' && voiceCount > 0) {
            const sample = await (prisma as any).statVoiceState.findFirst({ orderBy: { joinedAt: 'asc' } });
            console.log(`  Oldest raw voice record: ${sample?.joinedAt}`);
        }

        const dailyCount = await (prisma as any).statDaily.count().catch(() => 'No table');
        if (typeof dailyCount === 'number' && dailyCount > 0) {
            const sampleDaily = await (prisma as any).statDaily.findFirst({
                where: { voiceSeconds: { gt: 0 } },
                orderBy: { date: 'asc' }
            });
            console.log(`- statDaily: ${dailyCount} rows. Oldest with voice: ${sampleDaily?.date}`);
        }

    } catch (e: any) {
        console.log("Error:", e.message);
    } finally {
        await prisma.$disconnect();
    }
};

run().catch(console.error);
