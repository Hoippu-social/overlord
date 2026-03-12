import { PrismaClient } from '@prisma/client';
import path from 'path';

const prisma = new PrismaClient({
    datasources: { db: { url: process.env.DATABASE_URL || `file:${path.resolve('../bot/prisma/development.db')}` } }
});

async function run() {
    const guildId = '1374115841855197184';
    const timezone = 'Europe/Moscow';

    console.log(`Trying to upsert BotSettings for guild ${guildId} with timezone ${timezone}...`);

    try {
        const result = await prisma.botSettings.upsert({
            where: { guildId },
            update: { timezone },
            create: {
                guildId,
                timezone,
                locale: 'ru',
            }
        });
        console.log('Success:', result);
    } catch (e) {
        console.error('Error during upsert:', e);
    }
}

run().finally(() => prisma.$disconnect());
