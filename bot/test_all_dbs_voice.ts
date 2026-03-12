import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const run = async () => {
    const dbsToTry = [
        'file:D:/discord_bot/Dev/bot/prisma/dev.db',
        'file:D:/discord_bot/Dev/bot/prisma/development_pre_migration.db',
        'file:D:/discord_bot/Dev/bot/prisma/stats_pre_migration.db',
        'file:D:/discord_bot/Dev/bot/backups/stats_2026-03-05.db',
        'file:D:/discord_bot/Dev/bot/prisma/development.db',
        'file:D:/discord_bot/Dev/bot/prisma/stats.db',
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

            const voiceCount = await (prisma as any).statVoiceState.count().catch(() => 'No table');
            console.log(`- statVoiceState: ${voiceCount} rows`);

            if (typeof voiceCount === 'number' && voiceCount > 0) {
                const sample = await (prisma as any).statVoiceState.findFirst({
                    orderBy: { joinedAt: 'asc' }
                });
                console.log(`  Oldest voice record: joinedAt = ${sample?.joinedAt}`);
            }

            // Could there be another table that stored voice duration?
            const inviteEventsCount = await (prisma as any).inviteUseEvent.count().catch(() => 'No table');
            console.log(`- inviteUseEvent: ${inviteEventsCount} rows`);

            if (typeof inviteEventsCount === 'number' && inviteEventsCount > 0) {
                const sampleInv = await (prisma as any).inviteUseEvent.findFirst({
                    where: { voiceDurationSec: { gt: 0 } },
                    orderBy: { createdAt: 'asc' }
                });
                if (sampleInv) {
                    console.log(`  Oldest invite event with voiceDuration: createdAt = ${sampleInv?.createdAt}`);
                }
            }

        } catch (e) {
            console.log(`Error checking DB: ${e.message}`);
        } finally {
            await prisma.$disconnect();
        }
    }
};

run().catch(console.error);
