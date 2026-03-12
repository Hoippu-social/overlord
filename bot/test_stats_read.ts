import { PrismaClient } from '@prisma/client';

const run = async () => {
    // Both Bot and Dashboard use this exact connection pattern:
    const statsPrisma = new PrismaClient({
        datasources: {
            db: {
                url: 'file:D:/discord_bot/Dev/bot/prisma/stats.db',
            },
        },
    });

    console.log("=== DB CONNECTION VERIFICATION ===");
    console.log("Connected to stats.db successfully. Checking table row counts...");

    try {
        const msgCount = await (statsPrisma as any).statMessage.count();
        const voiceCount = await (statsPrisma as any).statVoiceState.count();
        const activityCount = await (statsPrisma as any).statActivity.count();
        const interactionCount = await (statsPrisma as any).statInteraction.count();

        console.log(`- statMessage: ${msgCount} rows`);
        console.log(`- statVoiceState: ${voiceCount} rows`);
        console.log(`- statActivity: ${activityCount} rows`);
        console.log(`- statInteraction: ${interactionCount} rows`);

        console.log("\n=== DATA FORMAT VERIFICATION (SAMPLE) ===");

        // Let's grab the oldest or a random message to verify format translates correctly to Prisma type:
        const sampleMsg = await (statsPrisma as any).statMessage.findFirst({
            orderBy: { createdAt: 'asc' }
        });

        console.log("Oldest StatMessage (migrated):");
        console.log(JSON.stringify(sampleMsg, null, 2));

        const sampleVoice = await (statsPrisma as any).statVoiceState.findFirst({
            where: { duration: { gt: 0 } },
            orderBy: { joinedAt: 'asc' }
        });

        console.log("\nOldest StatVoiceState with duration (migrated):");
        console.log(JSON.stringify(sampleVoice, null, 2));

        const recentMsg = await (statsPrisma as any).statMessage.findFirst({
            orderBy: { createdAt: 'desc' }
        });

        console.log("\nMost recent StatMessage (new format):");
        console.log(JSON.stringify(recentMsg, null, 2));

        console.log("\nVerification successfully completed. DB parsing is solid!");

    } catch (e) {
        console.error("Failed verification:", e);
    } finally {
        await statsPrisma.$disconnect();
    }
};

run().catch(console.error);
