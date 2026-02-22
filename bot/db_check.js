const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    console.log('--- DB Check Started ---');

    const msgCount = await prisma.statMessage.count();
    console.log(`StatMessage count: ${msgCount}`);

    const voiceCount = await prisma.statVoiceState.count();
    console.log(`StatVoiceState count: ${voiceCount}`);

    const lastMsgs = await prisma.statMessage.findMany({ take: 5, orderBy: { createdAt: 'desc' } });
    console.log('Last 5 Messages:', lastMsgs);

    console.log('--- Top 5 Guilds by Message Count ---');
    const guilds = await prisma.statMessage.groupBy({
        by: ['guildId'],
        _count: { id: true },
    });
    console.log(guilds);

    console.log('--- DB Check Finished ---');
}

check()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
