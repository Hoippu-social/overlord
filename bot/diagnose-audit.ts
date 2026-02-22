import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const guildId = '1374115841855197184';

    console.log('=== Проверка AuditLog событий voice ===\n');

    // Voice events from audit log
    const voiceEvents = await prisma.auditLogEvent.findMany({
        where: {
            guildId,
            tag: 'voice'
        },
        orderBy: { createdAt: 'desc' },
        take: 30,
    });

    console.log(`Найдено ${voiceEvents.length} голосовых событий:\n`);

    for (const e of voiceEvents) {
        const payload = e.payload ? JSON.parse(e.payload) : {};
        console.log(`${e.createdAt.toISOString()} | ${payload.event} | Канал: ${payload.channelId || payload.toChannelId || 'N/A'} | Пользователь: ${e.actorId}`);
    }

    console.log('\n=== Уникальные каналы в событиях ===');
    const channelStats = new Map<string, number>();
    for (const e of voiceEvents) {
        const payload = e.payload ? JSON.parse(e.payload) : {};
        const channelId = payload.channelId || payload.toChannelId;
        if (channelId) {
            channelStats.set(channelId, (channelStats.get(channelId) || 0) + 1);
        }
    }

    for (const [chId, count] of channelStats) {
        console.log(`   Канал ${chId}: ${count} событий`);
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
