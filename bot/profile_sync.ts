import { PrismaClient } from '@prisma/client';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';

const statsPrisma = new PrismaClient({
    datasources: { db: { url: 'file:D:/discord_bot/Dev/bot/prisma/stats.db' } }
});

async function run() {
    const guildId = '1374115841855197184';
    const tz = 'UTC';
    const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    
    console.time('Total');
    console.time('Fetch');
    const rawMessages = await statsPrisma.statMessage.findMany({ where: { guildId, createdAt: { gte: since } }});
    console.timeEnd('Fetch');
    
    console.time('Loop');
    const hourlyStats = new Map();
    const dailyStats = new Map();
    const getTruncatedUTC = (date: Date, truncateTo: 'hour' | 'day'): Date => {
        const zoned = toZonedTime(date, tz);
        const y = zoned.getUTCFullYear();
        const m = String(zoned.getUTCMonth() + 1).padStart(2, '0');
        const d = String(zoned.getUTCDate()).padStart(2, '0');
        const h = truncateTo === 'hour' ? String(zoned.getUTCHours()).padStart(2, '0') : '00';
        
        const localTruncatedStr = `${y}-${m}-${d}T${h}:00:00`;
        return fromZonedTime(localTruncatedStr, tz);
    };

    const getHourlyEntry = (date: Date) => {
        const truncated = getTruncatedUTC(date, 'hour');
        const key = truncated.toISOString();
        if (!hourlyStats.has(key)) hourlyStats.set(key, { messages: 0, voice: 0, joined: 0, left: 0 });
        return hourlyStats.get(key)!;
    };

    const getDailyEntry = (date: Date) => {
        const truncated = getTruncatedUTC(date, 'day');
        const key = truncated.toISOString();
        if (!dailyStats.has(key)) dailyStats.set(key, { messages: 0, voice: 0, joined: 0, left: 0 });
        return dailyStats.get(key)!;
    };

    for (const msg of rawMessages) {
        const h = getHourlyEntry(msg.createdAt);
        h.messages++;
        const d = getDailyEntry(msg.createdAt);
        d.messages++;
    }
    console.timeEnd('Loop');
    console.timeEnd('Total');
}
run();
