import { PrismaClient } from '@prisma/client';

const run = async () => {
    const url = 'file:D:/discord_bot/Dev/bot/prisma/development_pre_migration.db';
    const prisma = new PrismaClient({ datasources: { db: { url } } });

    try {
        console.log("Checking StatDaily in development_pre_migration.db...");
        const stats = await (prisma as any).statDaily.findMany({
            where: { voiceSeconds: { gt: 0 } },
            orderBy: { date: 'asc' },
            take: 5
        });
        stats.forEach((s: any) => console.log(`- ${s.date}: ${s.voiceSeconds}`));

        console.log("\nChecking StatVoiceState in development_pre_migration.db...");
        const count = await (prisma as any).statVoiceState.count();
        console.log(`Total raw voice records: ${count}`);

    } catch (e: any) {
        console.log("Error:", e.message);
    } finally {
        await prisma.$disconnect();
    }
};

run().catch(console.error);
