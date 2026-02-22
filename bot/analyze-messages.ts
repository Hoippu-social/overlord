import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const guildId = '1374115841855197184';

    console.log('=== Анализ статистики сообщений по дням ===\n');

    // Получаем статистику по дням
    const dailyStats = await prisma.statDaily.findMany({
        where: { guildId },
        orderBy: { date: 'desc' },
        take: 100,
    });

    console.log('Статистика по дням (последние 100 записей):\n');
    console.log('Дата                | Сообщений');
    console.log('-'.repeat(40));

    for (const stat of dailyStats) {
        const dateStr = stat.date.toISOString().split('T')[0];
        console.log(`${dateStr}          | ${stat.messages}`);
    }

    // Анализ - сколько сообщений в среднем за последнюю неделю vs ранее
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const recentStats = dailyStats.filter(s => s.date >= weekAgo);
    const olderStats = dailyStats.filter(s => s.date < weekAgo);

    const recentAvg = recentStats.length > 0
        ? recentStats.reduce((sum, s) => sum + s.messages, 0) / recentStats.length
        : 0;
    const olderAvg = olderStats.length > 0
        ? olderStats.reduce((sum, s) => sum + s.messages, 0) / olderStats.length
        : 0;

    console.log('\n=== Анализ ===');
    console.log(`Последняя неделя: ${recentStats.length} дней, среднее ${Math.round(recentAvg)} сообщений/день`);
    console.log(`Ранее: ${olderStats.length} дней, среднее ${Math.round(olderAvg)} сообщений/день`);

    // Проверяем "сырые" данные StatMessage
    console.log('\n=== Анализ StatMessage ===');

    const messageCount = await prisma.statMessage.count({
        where: { guildId }
    });
    console.log(`Всего записей StatMessage: ${messageCount}`);

    // По дням
    const rawByDay = await prisma.statMessage.groupBy({
        by: ['createdAt'],
        where: { guildId },
        _count: { id: true },
    });

    // Группируем вручную по дате
    const dayCount = new Map<string, number>();
    for (const row of rawByDay) {
        const dateStr = row.createdAt.toISOString().split('T')[0];
        dayCount.set(dateStr, (dayCount.get(dateStr) || 0) + row._count.id);
    }

    console.log('\nРаспределение StatMessage по дням (топ-20):');
    const sorted = [...dayCount.entries()].sort((a, b) => b[0].localeCompare(a[0]));
    for (const [date, count] of sorted.slice(0, 20)) {
        console.log(`${date}: ${count} сообщений`);
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
