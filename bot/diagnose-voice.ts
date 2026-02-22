import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const guildId = '1374115841855197184'; // Штормград

    console.log('=== Диагностика голосовой статистики для Штормград ===\n');

    // 1. Общая статистика голосовых сессий
    const voiceStats = await prisma.statVoiceState.aggregate({
        where: { guildId },
        _count: { id: true },
        _sum: { duration: true },
    });

    console.log('1. Голосовые сессии:');
    console.log(`   Всего сессий: ${voiceStats._count.id}`);
    console.log(`   Общее время: ${Math.floor((voiceStats._sum.duration || 0) / 3600)} часов\n`);

    // 2. Уникальные каналы
    const channels = await prisma.statVoiceState.groupBy({
        by: ['channelId'],
        where: { guildId },
        _count: { id: true },
        _sum: { duration: true },
    });

    console.log('2. Статистика по каналам:');
    for (const ch of channels) {
        console.log(`   Канал ${ch.channelId}: ${ch._count.id} сессий, ${Math.floor((ch._sum.duration || 0) / 60)} мин`);
    }
    console.log('');

    // 3. Последние 10 сессий
    const recentSessions = await prisma.statVoiceState.findMany({
        where: { guildId },
        orderBy: { joinedAt: 'desc' },
        take: 10,
    });

    console.log('3. Последние 10 сессий:');
    for (const s of recentSessions) {
        console.log(`   ${s.joinedAt.toISOString()} | Канал: ${s.channelId} | Пользователь: ${s.userId} | ${s.duration}с`);
    }
    console.log('');

    // 4. Сведения о гильдии
    const guild = await prisma.guild.findUnique({
        where: { id: guildId },
    });

    console.log('4. Данные о сервере:');
    console.log(`   Имя: ${guild?.name}`);
    console.log(`   Участников: ${guild?.memberCount}`);
    console.log('');

    // 5. Проверка hourly/daily агрегаций
    const hourlyVoice = await prisma.statHourly.aggregate({
        where: { guildId, voiceSeconds: { gt: 0 } },
        _count: { id: true },
        _sum: { voiceSeconds: true },
    });

    console.log('5. Агрегированные данные:');
    console.log(`   Записей StatHourly с голосом: ${hourlyVoice._count.id}`);
    console.log(`   Общее время (hourly): ${Math.floor((hourlyVoice._sum.voiceSeconds || 0) / 3600)} часов`);

    const dailyVoice = await prisma.statDaily.aggregate({
        where: { guildId, voiceSeconds: { gt: 0 } },
        _count: { id: true },
        _sum: { voiceSeconds: true },
    });

    console.log(`   Записей StatDaily с голосом: ${dailyVoice._count.id}`);
    console.log(`   Общее время (daily): ${Math.floor((dailyVoice._sum.voiceSeconds || 0) / 3600)} часов`);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
