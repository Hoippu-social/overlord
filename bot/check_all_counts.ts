import { PrismaClient } from '@prisma/client';
const statsPrisma = new PrismaClient({ datasources: { db: { url: 'file:./prisma/stats.db' } }});

async function run() {
    console.log("StatMessage:", await statsPrisma.statMessage.count());
    console.log("StatVoiceState:", await statsPrisma.statVoiceState.count());
    console.log("AuditLogEvent:", await statsPrisma.auditLogEvent.count());
    console.log("StatHourly:", await statsPrisma.statHourly.count());
    console.log("StatDaily:", await statsPrisma.statDaily.count());
}
run();
