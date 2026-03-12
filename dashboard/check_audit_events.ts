import { PrismaClient } from '@prisma/client';
import path from 'path';

const prisma = new PrismaClient({
    datasources: { db: { url: `file:${path.resolve('../bot/prisma/development.db')}` } }
});

async function run() {
    const events = await prisma.auditLogEvent.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10
    });

    console.log('Last 10 Audit Events:');
    events.forEach(ev => {
        const payload = JSON.parse(ev.payload || '{}');
        console.log(`- [${ev.createdAt}] ${ev.tag} | ${payload.event || 'no event'} | actor: ${ev.actorId} | target: ${ev.targetId}`);
        if (payload.contentBefore || payload.contentAfter) {
            console.log(`  Content: Before: "${payload.contentBefore?.substring(0, 20)}..." | After: "${payload.contentAfter?.substring(0, 20)}..."`);
        }
    });
}

run().finally(() => prisma.$disconnect());
