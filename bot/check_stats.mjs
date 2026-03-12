import { PrismaClient } from '@prisma/client';

const statsDb = new PrismaClient({
    datasources: { db: { url: 'file:D:/discord_bot/Dev/bot/prisma/stats.db' } }
});
const mainDb = new PrismaClient();

const since = new Date('2026-03-01T00:00:00.000Z');

async function main() {
    // stats.db
    const statsDaily = await statsDb.statDaily.findMany({ where: { date: { gte: since } }, orderBy: { date: 'asc' } });
    const statsHourlyCount = await statsDb.statHourly.count({ where: { dateHour: { gte: since } } });
    const statsLastHourly = await statsDb.statHourly.findFirst({ orderBy: { dateHour: 'desc' } });
    const statsMsgCount = await statsDb.statMessage.count({ where: { createdAt: { gte: since } } });

    console.log('=== stats.db ===');
    console.log('statDaily since Mar 1:', JSON.stringify(statsDaily, null, 2));
    console.log('statHourly count since Mar 1:', statsHourlyCount);
    console.log('statMessage count since Mar 1:', statsMsgCount);
    console.log('Last hourly entry:', JSON.stringify(statsLastHourly, null, 2));

    // development.db
    const mainDaily = await mainDb.statDaily.findMany({ where: { date: { gte: since } }, orderBy: { date: 'asc' } });
    const mainHourlyCount = await mainDb.statHourly.count({ where: { dateHour: { gte: since } } });
    const mainLastHourly = await mainDb.statHourly.findFirst({ orderBy: { dateHour: 'desc' } });
    const mainMsgCount = await mainDb.statMessage.count({ where: { createdAt: { gte: since } } });
    const mainVoiceCount = await mainDb.statVoiceState.count({ where: { joinedAt: { gte: since } } });

    console.log('\n=== development.db ===');
    console.log('statDaily since Mar 1:', JSON.stringify(mainDaily, null, 2));
    console.log('statHourly count since Mar 1:', mainHourlyCount);
    console.log('statMessage count since Mar 1:', mainMsgCount);
    console.log('statVoiceState count since Mar 1:', mainVoiceCount);
    console.log('Last hourly entry:', JSON.stringify(mainLastHourly, null, 2));

    await statsDb.$disconnect();
    await mainDb.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
