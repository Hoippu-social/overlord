import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const guildId = '1374115841855197184';

    console.log('=== Полная диагностика сервера Штормград ===\n');

    // 1. Данные о гильдии
    const guild = await prisma.guild.findUnique({
        where: { id: guildId },
    });

    console.log('1. Информация о сервере:');
    console.log(`   ID: ${guildId}`);
    console.log(`   Имя: ${guild?.name}`);
    console.log(`   Участников: ${guild?.memberCount}`);
    console.log(`   Добавлен в БД: ${guild?.createdAt}`);
    console.log(`   Обновлен: ${guild?.updatedAt}`);
    console.log('');

    // 2. Временные голосовые
    const tempVoice = await prisma.tempVoiceConfig.findUnique({
        where: { guildId },
    });
    console.log('2. Временные голосовые:');
    if (tempVoice) {
        console.log(`   Hub канал: ${tempVoice.hubChannelId}`);
        console.log(`   Категория: ${tempVoice.categoryId}`);
    } else {
        console.log('   Не настроены');
    }
    console.log('');

    // 3. Все каналы (из JSON)
    console.log('3. Каналы сервера (из кэша):');
    if (guild?.channels) {
        try {
            const channels = JSON.parse(guild.channels);
            const voiceChannels = channels.filter((c: any) => c.type === 2); // GuildVoice = 2
            console.log(`   Всего каналов: ${channels.length}`);
            console.log(`   Голосовых каналов: ${voiceChannels.length}`);
            console.log('   Голосовые каналы:');
            for (const ch of voiceChannels.slice(0, 15)) {
                console.log(`      - ${ch.name} (${ch.id})`);
            }
            if (voiceChannels.length > 15) {
                console.log(`      ... и еще ${voiceChannels.length - 15}`);
            }
        } catch (e) {
            console.log('   Ошибка парсинга JSON каналов');
        }
    } else {
        console.log('   Нет данных о каналах');
    }
    console.log('');

    // 4. Все события с сервера
    const allAuditEvents = await prisma.auditLogEvent.count({
        where: { guildId }
    });
    console.log('4. Audit события:');
    console.log(`   Всего событий: ${allAuditEvents}`);

    // По тегам
    const eventsByTag = await prisma.auditLogEvent.groupBy({
        by: ['tag'],
        where: { guildId },
        _count: { id: true },
    });
    for (const t of eventsByTag) {
        console.log(`   ${t.tag}: ${t._count.id} событий`);
    }
    console.log('');

    // 5. Первое и последнее событие
    const firstEvent = await prisma.auditLogEvent.findFirst({
        where: { guildId },
        orderBy: { createdAt: 'asc' },
    });
    const lastEvent = await prisma.auditLogEvent.findFirst({
        where: { guildId },
        orderBy: { createdAt: 'desc' },
    });

    console.log('5. Временные рамки событий:');
    console.log(`   Первое событие: ${firstEvent?.createdAt}`);
    console.log(`   Последнее событие: ${lastEvent?.createdAt}`);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
