import { PrismaClient } from '@prisma/client';

const run = async () => {
    const url = 'file:D:/discord_bot/Dev/bot/prisma/prisma/stats.db';
    const prisma = new PrismaClient({ datasources: { db: { url } } });

    try {
        console.log("Checking mysterious DB: prisma/prisma/stats.db");
        const voiceCount = await (prisma as any).statVoiceState.count().catch(() => 'No table');
        console.log(`- statVoiceState: ${voiceCount} rows`);

        if (typeof voiceCount === 'number' && voiceCount > 0) {
            const sample = await (prisma as any).statVoiceState.findFirst({ orderBy: { joinedAt: 'asc' } });
            console.log(`  Oldest record: ${sample?.joinedAt}`);
        }

    } catch (e: any) {
        console.log("Error:", e.message);
    } finally {
        await prisma.$disconnect();
    }
};

run().catch(console.error);
