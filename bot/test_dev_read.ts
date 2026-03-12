import { PrismaClient } from '@prisma/client';

const run = async () => {
    // Both Bot and Dashboard use this exact connection pattern:
    const statsPrisma = new PrismaClient({
        datasources: {
            db: {
                url: 'file:D:/discord_bot/Dev/bot/prisma/development.db',
            },
        },
    });

    console.log("=== DB CONNECTION VERIFICATION ===");
    console.log("Connected to development.db successfully. Checking table row counts...");

    try {
        const msgCount = await (statsPrisma as any).statMessage.count();
        const voiceCount = await (statsPrisma as any).statVoiceState.count();

        console.log(`- statMessage: ${msgCount} rows`);
        console.log(`- statVoiceState: ${voiceCount} rows`);

        const sampleVoice = await (statsPrisma as any).statVoiceState.findFirst({
            where: { duration: { gt: 0 } },
            orderBy: { joinedAt: 'asc' }
        });

        console.log("\nOldest StatVoiceState with duration in dev.db:");
        console.log(JSON.stringify(sampleVoice, null, 2));

    } catch (e) {
        console.error("Failed verification:", e);
    } finally {
        await statsPrisma.$disconnect();
    }
};

run().catch(console.error);
