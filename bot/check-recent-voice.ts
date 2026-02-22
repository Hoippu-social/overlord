import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const guildId = '1374115841855197184';

    console.log('=== Проверка новых записей голосовых сессий ===\n');

    // Последние 20 записей
    const recentSessions = await prisma.statVoiceState.findMany({
        where: { guildId },
        orderBy: { joinedAt: 'desc' },
        take: 20,
    });

    console.log(`Найдено ${recentSessions.length} последних записей:\n`);

    for (const s of recentSessions) {
        const duration = Math.floor(s.duration);
        console.log(`${s.joinedAt.toISOString()} | Канал: ${s.channelId} | Пользователь: ${s.userId} | ${duration}с`);
    }

    // Статистика за последние 5 минут
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
    const recentCount = await prisma.statVoiceState.count({
        where: {
            guildId,
            joinedAt: { gte: fiveMinAgo }
        }
    });

    console.log(`\nЗаписей за последние 5 минут: ${recentCount}`);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
