
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('--- Database Stats Check (Full) ---');

    // Check main tables
    const msgCount = await prisma.statMessage.count();
    const voiceCount = await prisma.statVoiceState.count();
    const memberCount = await prisma.statMemberCount.count();
    const activityCount = await prisma.statActivity.count();

    console.log(`StatMessage count: ${msgCount}`);

    // Check Guilds
    const guilds = await prisma.guild.findMany();
    console.log('--- Guilds in DB ---');
    guilds.forEach(g => console.log(`ID: ${g.id} | Name: ${g.name}`));
    console.log('--------------------');

    console.log(`StatVoiceState count: ${voiceCount}`);
    console.log(`StatMemberCount count: ${memberCount}`);
    console.log(`StatActivity count: ${activityCount}`);

    // Check aggregations
    const hourlyCount = await prisma.statHourly.count();
    const dailyCount = await prisma.statDaily.count();

    console.log(`StatHourly count: ${hourlyCount}`);
    console.log(`StatDaily count: ${dailyCount}`);

    // Check Top Rankings
    const topMemberCount = await prisma.statTopMember.count();
    const topChannelCount = await prisma.statTopChannel.count();

    console.log(`StatTopMember count: ${topMemberCount}`);
    console.log(`StatTopChannel count: ${topChannelCount}`);

    if (dailyCount > 0) {
        const dailies = await prisma.statDaily.findMany({
            orderBy: { date: 'desc' },
            take: 5
        });
        console.log('Last StatStats (Daily):');
        dailies.forEach(d => console.log(`  Guild: ${d.guildId} | Date: ${d.date.toISOString()} | Msgs: ${d.messages}`));
    }

    if (hourlyCount > 0) {
        const hourlies = await prisma.statHourly.findMany({
            orderBy: { dateHour: 'desc' },
            take: 5
        });
        console.log('Last StatStats (Hourly):');
        hourlies.forEach(h => console.log(`  Guild: ${h.guildId} | Date: ${h.dateHour.toISOString()} | Msgs: ${h.messages}`));
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
