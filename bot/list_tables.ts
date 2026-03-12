import { PrismaClient } from '@prisma/client';

const run = async () => {
    const url = 'file:D:/discord_bot/Dev/bot/prisma/development.db';
    const prisma = new PrismaClient({ datasources: { db: { url } } });

    try {
        const result: any[] = await prisma.$queryRaw`SELECT name FROM sqlite_master WHERE type='table'`;
        console.log("Tables in development.db:");
        result.forEach(r => console.log(`- ${r.name}`));

    } catch (e: any) {
        console.log("Error:", e.message);
    } finally {
        await prisma.$disconnect();
    }
};

run().catch(console.error);
