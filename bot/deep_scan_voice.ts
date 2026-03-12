import { PrismaClient } from '@prisma/client';
import fs from 'fs';

const run = async () => {
    const dbsToTry = [
        'file:D:/discord_bot/Dev/dev.bd backup/development.db',
        'file:D:/discord_bot/Dev/bot/development.db',
        'file:D:/discord_bot/Dev/bot/prisma/development.db',
        'file:D:/discord_bot/Dev/bot/prisma/stats.db',
        'file:D:/discord_bot/Dev/bot/prisma/stats_pre_migration.db',
    ];

    for (const url of dbsToTry) {
        const filePath = url.replace('file:', '');
        if (!fs.existsSync(filePath)) {
            console.log(`[x] Missing DB: ${filePath}`);
            continue;
        }

        const prisma = new PrismaClient({ datasources: { db: { url } } });
        try {
            console.log(`\n============================`);
            console.log(`Checking DB: ${filePath}`);

            // 1. statVoiceState
            const voiceCount = await (prisma as any).statVoiceState.count().catch(() => 'No table');
            if (typeof voiceCount === 'number' && voiceCount > 0) {
                const sample = await (prisma as any).statVoiceState.findFirst({ orderBy: { joinedAt: 'asc' } });
                console.log(`- statVoiceState: ${voiceCount} rows. Oldest: ${sample?.joinedAt}`);
            } else {
                console.log(`- statVoiceState: ${voiceCount} rows.`);
            }

            // 2. StatDaily
            const dailyCount = await (prisma as any).statDaily.count().catch(() => 'No table');
            if (typeof dailyCount === 'number' && dailyCount > 0) {
                const sampleDaily = await (prisma as any).statDaily.findFirst({
                    where: { voiceSeconds: { gt: 0 } },
                    orderBy: { date: 'asc' }
                });
                console.log(`- statDaily: ${dailyCount} rows. Oldest with voice: ${sampleDaily?.date}`);
            } else {
                console.log(`- statDaily: ${dailyCount} rows.`);
            }

            // 3. InviteUseEvent
            const invCount = await (prisma as any).inviteUseEvent.count().catch(() => 'No table');
            if (typeof invCount === 'number' && invCount > 0) {
                const sampleInv = await (prisma as any).inviteUseEvent.findFirst({
                    where: { voiceDurationSec: { gt: 0 } },
                    orderBy: { createdAt: 'asc' }
                });
                console.log(`- inviteUseEvent: ${invCount} rows. Oldest with voiceDuration: ${sampleInv?.createdAt}`);
            } else {
                console.log(`- inviteUseEvent: ${invCount} rows.`);
            }

        } catch (e: any) {
            console.log(`Error checking DB: ${e.message}`);
        } finally {
            await prisma.$disconnect();
        }
    }
};

run().catch(console.error);
