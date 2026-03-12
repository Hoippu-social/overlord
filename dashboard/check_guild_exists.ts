import { PrismaClient } from '@prisma/client';
import path from 'path';

const prisma = new PrismaClient({
    datasources: { db: { url: process.env.DATABASE_URL || `file:${path.resolve('../bot/prisma/development.db')}` } }
});

async function run() {
    const guildId = '1374115841855197184';
    console.log(`Checking Guild ${guildId} in development.db...`);
    const guild = await prisma.guild.findUnique({ where: { id: guildId } });
    console.log('Guild record:', guild);

    const botSettingsCount = await prisma.botSettings.count();
    console.log(`Total BotSettings count: ${botSettingsCount}`);
}

run().finally(() => prisma.$disconnect());
