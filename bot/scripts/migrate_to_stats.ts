/**
 * Migration script: dev.db → stats.db
 * 
 * For each stat table, finds records in development.db that are
 * missing from stats.db and inserts them.
 * 
 * Run with: npx ts-node -e "require('./scripts/migrate_to_stats')"
 * Or: npx tsx scripts/migrate_to_stats.ts
 */

import { PrismaClient } from '@prisma/client';
import path from 'path';

const devPrisma = new PrismaClient({
    datasources: { db: { url: process.env.DATABASE_URL || 'file:./prisma/development.db' } }
});

const statsPrisma = new PrismaClient({
    datasources: {
        db: {
            url: process.env.STATS_DATABASE_URL || `file:${path.resolve(__dirname, '../prisma/stats.db')}`
        }
    }
});

async function migrate() {
    console.log('=== Stats DB Migration: dev.db → stats.db ===\n');

    await devPrisma.$connect();
    await statsPrisma.$connect();

    // 1. StatMessage
    {
        const devRecords = await devPrisma.statMessage.findMany();
        const statsRecords = await statsPrisma.statMessage.findMany({ select: { channelId: true, authorId: true, createdAt: true } });
        const statsSet = new Set(statsRecords.map(r => `${r.channelId}:${r.authorId}:${r.createdAt.getTime()}`));

        const toInsert = devRecords.filter(r => !statsSet.has(`${r.channelId}:${r.authorId}:${r.createdAt.getTime()}`));
        for (const r of toInsert) {
            await statsPrisma.statMessage.create({ data: { guildId: r.guildId, channelId: r.channelId, authorId: r.authorId, length: r.length, createdAt: r.createdAt } });
        }
        console.log(`StatMessage:    dev=${devRecords.length}, stats=${statsRecords.length}, migrated=${toInsert.length}`);
    }

    // 2. StatVoiceState
    {
        const devRecords = await devPrisma.statVoiceState.findMany();
        const statsRecords = await statsPrisma.statVoiceState.findMany({ select: { channelId: true, userId: true, joinedAt: true } });
        const statsSet = new Set(statsRecords.map(r => `${r.channelId}:${r.userId}:${r.joinedAt.getTime()}`));

        const toInsert = devRecords.filter(r => !statsSet.has(`${r.channelId}:${r.userId}:${r.joinedAt.getTime()}`));
        for (const r of toInsert) {
            await statsPrisma.statVoiceState.create({ data: { guildId: r.guildId, channelId: r.channelId, userId: r.userId, joinedAt: r.joinedAt, leftAt: r.leftAt, duration: r.duration } });
        }
        console.log(`StatVoiceState: dev=${devRecords.length}, stats=${statsRecords.length}, migrated=${toInsert.length}`);
    }

    // 3. StatActivity
    {
        const devRecords = await devPrisma.statActivity.findMany();
        const statsRecords = await statsPrisma.statActivity.findMany({ select: { guildId: true, userId: true, name: true, startTime: true } });
        const statsSet = new Set(statsRecords.map(r => `${r.guildId}:${r.userId}:${r.name}:${r.startTime.getTime()}`));

        const toInsert = devRecords.filter(r => !statsSet.has(`${r.guildId}:${r.userId}:${r.name}:${r.startTime.getTime()}`));
        for (const r of toInsert) {
            await statsPrisma.statActivity.create({ data: { guildId: r.guildId, userId: r.userId, name: r.name, startTime: r.startTime, endTime: r.endTime, duration: r.duration } });
        }
        console.log(`StatActivity:   dev=${devRecords.length}, stats=${statsRecords.length}, migrated=${toInsert.length}`);
    }

    // 4. StatInteraction
    {
        const devRecords = await devPrisma.statInteraction.findMany();
        const statsRecords = await statsPrisma.statInteraction.findMany({ select: { guildId: true, fromUserId: true, toUserId: true, type: true, createdAt: true } });
        const statsSet = new Set(statsRecords.map(r => `${r.guildId}:${r.fromUserId}:${r.toUserId}:${r.type}:${r.createdAt.getTime()}`));

        const toInsert = devRecords.filter(r => !statsSet.has(`${r.guildId}:${r.fromUserId}:${r.toUserId}:${r.type}:${r.createdAt.getTime()}`));
        for (const r of toInsert) {
            await statsPrisma.statInteraction.create({ data: { guildId: r.guildId, channelId: r.channelId, fromUserId: r.fromUserId, toUserId: r.toUserId, type: r.type, createdAt: r.createdAt } });
        }
        console.log(`StatInteraction:dev=${devRecords.length}, stats=${statsRecords.length}, migrated=${toInsert.length}`);
    }

    // 5. StatMemberCount
    {
        const devRecords = await devPrisma.statMemberCount.findMany();
        const statsRecords = await statsPrisma.statMemberCount.findMany({ select: { guildId: true, createdAt: true } });
        const statsSet = new Set(statsRecords.map(r => `${r.guildId}:${r.createdAt.getTime()}`));

        const toInsert = devRecords.filter(r => !statsSet.has(`${r.guildId}:${r.createdAt.getTime()}`));
        for (const r of toInsert) {
            await statsPrisma.statMemberCount.create({ data: { guildId: r.guildId, online: r.online, idle: r.idle, dnd: r.dnd, offline: r.offline, total: r.total, createdAt: r.createdAt } });
        }
        console.log(`StatMemberCount:dev=${devRecords.length}, stats=${statsRecords.length}, migrated=${toInsert.length}`);
    }

    // 6. StatHourly (upsert by unique key)
    {
        const devRecords = await devPrisma.statHourly.findMany();
        let migrated = 0;
        for (const r of devRecords) {
            const existing = await statsPrisma.statHourly.findUnique({ where: { guildId_dateHour: { guildId: r.guildId, dateHour: r.dateHour } } });
            if (!existing) {
                await statsPrisma.statHourly.create({ data: { guildId: r.guildId, dateHour: r.dateHour, messages: r.messages, voiceSeconds: r.voiceSeconds, newMembers: r.newMembers, leftMembers: r.leftMembers } });
                migrated++;
            }
        }
        const statsCount = await statsPrisma.statHourly.count();
        console.log(`StatHourly:     dev=${devRecords.length}, stats=${statsCount}, migrated=${migrated}`);
    }

    // 7. StatDaily (upsert by unique key)
    {
        const devRecords = await devPrisma.statDaily.findMany();
        let migrated = 0;
        for (const r of devRecords) {
            const existing = await statsPrisma.statDaily.findUnique({ where: { guildId_date: { guildId: r.guildId, date: r.date } } });
            if (!existing) {
                await statsPrisma.statDaily.create({ data: { guildId: r.guildId, date: r.date, messages: r.messages, voiceSeconds: r.voiceSeconds, newMembers: r.newMembers, leftMembers: r.leftMembers } });
                migrated++;
            }
        }
        const statsCount = await statsPrisma.statDaily.count();
        console.log(`StatDaily:      dev=${devRecords.length}, stats=${statsCount}, migrated=${migrated}`);
    }

    // 8. StatTopMember (upsert by guildId+userId+period+category)
    {
        const devRecords = await devPrisma.statTopMember.findMany();
        let migrated = 0;
        for (const r of devRecords) {
            const existing = await statsPrisma.statTopMember.findFirst({ where: { guildId: r.guildId, userId: r.userId, period: r.period, category: r.category } });
            if (!existing) {
                await statsPrisma.statTopMember.create({ data: { guildId: r.guildId, userId: r.userId, period: r.period, category: r.category, value: r.value } });
                migrated++;
            }
        }
        const statsCount = await statsPrisma.statTopMember.count();
        console.log(`StatTopMember:  dev=${devRecords.length}, stats=${statsCount}, migrated=${migrated}`);
    }

    // 9. StatTopChannel
    {
        const devRecords = await devPrisma.statTopChannel.findMany();
        let migrated = 0;
        for (const r of devRecords) {
            const existing = await statsPrisma.statTopChannel.findFirst({ where: { guildId: r.guildId, channelId: r.channelId, period: r.period, category: r.category } });
            if (!existing) {
                await statsPrisma.statTopChannel.create({ data: { guildId: r.guildId, channelId: r.channelId, period: r.period, category: r.category, value: r.value } });
                migrated++;
            }
        }
        const statsCount = await statsPrisma.statTopChannel.count();
        console.log(`StatTopChannel: dev=${devRecords.length}, stats=${statsCount}, migrated=${migrated}`);
    }

    console.log('\n=== Migration complete ===');
    await devPrisma.$disconnect();
    await statsPrisma.$disconnect();
}

migrate().catch(e => {
    console.error('Migration failed:', e);
    process.exit(1);
});
