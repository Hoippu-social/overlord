import { PrismaClient } from '@prisma/client';
const statsPrisma = new PrismaClient({ datasources: { db: { url: 'file:./prisma/stats.db' } }});

async function run() {
    console.log("Msg:", await statsPrisma.$queryRawUnsafe("SELECT count(*) as count FROM StatMessage"));
    console.log("Voice:", await statsPrisma.$queryRawUnsafe("SELECT count(*) as count FROM StatVoiceState"));
    console.log("Msg by guild:", await statsPrisma.$queryRawUnsafe("SELECT guildId, count(*) as c FROM StatMessage GROUP BY guildId"));
}
run();
