import { PrismaClient } from '@prisma/client';
import path from 'path';

const prisma = new PrismaClient({
    datasources: { db: { url: process.env.DATABASE_URL || `file:${path.resolve('../bot/prisma/development.db')}` } }
});

async function run() {
    const musicCount = await prisma.musicConfig.count();
    console.log(`MusicConfig count: ${musicCount}`);

    const guildId = '1374115841855197184';
    const config = await prisma.musicConfig.findUnique({ where: { guildId } });
    console.log('MusicConfig for guild:', config);
}

run().finally(() => prisma.$disconnect());
