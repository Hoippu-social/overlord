import { PrismaClient } from '@prisma/client';
const statsPrisma = new PrismaClient({
    datasources: {
        db: {
            url: 'file:D:/discord_bot/Dev/bot/prisma/stats.db',
        },
    },
});

async function run() {
    console.log("StatMessage:", await statsPrisma.statMessage.count());
}
run();
