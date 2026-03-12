/**
 * Скрипт пересчёта statHourly / statDaily на UTC-полуночи.
 * Запускать ОДИН РАЗ после перехода на UTC в StatsService.
 */
import { PrismaClient } from '@prisma/client';

const mainDb = new PrismaClient();
const statsDb = new PrismaClient({
    datasources: { db: { url: 'file:D:/discord_bot/Dev/bot/prisma/stats.db' } }
});

const GUILD_IDS = ['1374115841855197184', '873909948730470400', '1079823668923867176'];

function getHourUTC(d: Date): Date {
    const h = new Date(d);
    h.setUTCMinutes(0, 0, 0);
    return h;
}

function getDayUTC(d: Date): Date {
    const day = new Date(d);
    day.setUTCHours(0, 0, 0, 0);
    return day;
}

async function recalcForGuild(db: PrismaClient, guildId: string, since: Date) {
    console.log(`\n[Recalc] Guild ${guildId}...`);

    const messages = await (db as any).statMessage.findMany({
        where: { guildId, createdAt: { gte: since } },
        select: { createdAt: true }
    });

    const voice = await (db as any).statVoiceState.findMany({
        where: { guildId, joinedAt: { gte: since } },
        select: { joinedAt: true, leftAt: true, duration: true, channelId: true }
    });

    const hourlyMap = new Map<string, { messages: number; voiceSeconds: number }>();
    const dailyMap = new Map<string, { messages: number; voiceSeconds: number }>();

    for (const msg of messages) {
        const hKey = getHourUTC(msg.createdAt).toISOString();
        const dKey = getDayUTC(msg.createdAt).toISOString();
        const h = hourlyMap.get(hKey) || { messages: 0, voiceSeconds: 0 };
        h.messages++;
        hourlyMap.set(hKey, h);
        const d = dailyMap.get(dKey) || { messages: 0, voiceSeconds: 0 };
        d.messages++;
        dailyMap.set(dKey, d);
    }

    for (const v of voice) {
        const dur = v.duration || (v.leftAt ? Math.floor((new Date(v.leftAt).getTime() - new Date(v.joinedAt).getTime()) / 1000) : 0);
        if (dur <= 0) continue;
        const hKey = getHourUTC(new Date(v.joinedAt)).toISOString();
        const dKey = getDayUTC(new Date(v.joinedAt)).toISOString();
        const h = hourlyMap.get(hKey) || { messages: 0, voiceSeconds: 0 };
        h.voiceSeconds += dur;
        hourlyMap.set(hKey, h);
        const d = dailyMap.get(dKey) || { messages: 0, voiceSeconds: 0 };
        d.voiceSeconds += dur;
        dailyMap.set(dKey, d);
    }

    console.log(`  Messages: ${messages.length}, Voice sessions: ${voice.length}`);
    console.log(`  Hourly buckets: ${hourlyMap.size}, Daily buckets: ${dailyMap.size}`);

    // Upsert hourly
    for (const [dateHourStr, counts] of hourlyMap) {
        const dateHour = new Date(dateHourStr);
        await (db as any).statHourly.upsert({
            where: { guildId_dateHour: { guildId, dateHour } },
            update: { messages: counts.messages, voiceSeconds: counts.voiceSeconds },
            create: { guildId, dateHour, messages: counts.messages, voiceSeconds: counts.voiceSeconds, newMembers: 0, leftMembers: 0 }
        });
    }

    // Upsert daily
    for (const [dateStr, counts] of dailyMap) {
        const date = new Date(dateStr);
        await (db as any).statDaily.upsert({
            where: { guildId_date: { guildId, date } },
            update: { messages: counts.messages, voiceSeconds: counts.voiceSeconds },
            create: { guildId, date, messages: counts.messages, voiceSeconds: counts.voiceSeconds, newMembers: 0, leftMembers: 0 }
        });
    }

    console.log(`  ✓ Done`);
}

async function main() {
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - 7);
    since.setUTCHours(0, 0, 0, 0);

    console.log(`Recalculating from ${since.toISOString()}...`);

    for (const guildId of GUILD_IDS) {
        await recalcForGuild(mainDb, guildId, since);
        await recalcForGuild(statsDb, guildId, since);
    }

    await mainDb.$disconnect();
    await statsDb.$disconnect();
    console.log('\n✅ All done!');
}

main().catch(e => { console.error(e); process.exit(1); });
