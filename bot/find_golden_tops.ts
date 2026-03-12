import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const searchDir = 'D:/discord_bot/Dev';

function getFiles(dir: string, files_: string[] = []): string[] {
    try {
        const files = fs.readdirSync(dir);
        for (const i in files) {
            const name = path.join(dir, files[i]);
            if (fs.statSync(name).isDirectory()) {
                if (name.includes('node_modules') || name.includes('.git') || name.includes('dist')) continue;
                getFiles(name, files_);
            } else {
                if (name.endsWith('.db')) {
                    files_.push(name);
                }
            }
        }
    } catch (e) { }
    return files_;
}

async function check() {
    const dbFiles = getFiles(searchDir);
    console.log(`Found ${dbFiles.length} DB files. Checking StatTopMember...`);

    for (const file of dbFiles) {
        console.log(`Checking ${file}...`);
        const db = new PrismaClient({
            datasources: { db: { url: `file:${file}` } }
        });

        try {
            const top = await (db as any).statTopMember.findFirst({
                where: { period: 'ALL', category: 'VOICE' },
                orderBy: { value: 'desc' }
            });
            if (top && top.value > 100000) { // More than 27 hours
                console.log(`[GOLDEN FIND!] ${file} | Top Voice: ${top.value} seconds (${Math.floor(top.value / 3600)}h) for user ${top.userId}`);
            } else if (top) {
                console.log(`[TABLE EXISTS] ${file} | Top Voice: ${top.value} seconds`);
            }
        } catch (e) {
            // Probably not a stats DB
        } finally {
            await db.$disconnect();
        }
    }
}

check();
