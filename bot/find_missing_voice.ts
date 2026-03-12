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
    console.log(`Found ${dbFiles.length} DB files. Checking...`);

    for (const file of dbFiles) {
        console.log(`Checking ${file}...`);
        const db = new PrismaClient({
            datasources: { db: { url: `file:${file}` } }
        });

        try {
            const count = await (db as any).statVoiceState.count();
            if (count > 0) {
                const first = await (db as any).statVoiceState.findFirst({ orderBy: { joinedAt: 'asc' } });
                console.log(`[FOUND] ${file} | Count: ${count} | Start: ${first.joinedAt}`);
            }
        } catch (e) {
            // Probably not a stats DB
        } finally {
            await db.$disconnect();
        }
    }
}

check();
