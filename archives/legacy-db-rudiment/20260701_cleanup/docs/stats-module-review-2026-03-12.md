# Ревью модуля статистики

Дата: 2026-03-12

## Краткий вывод

Основная проблема модуля не в одном дефектном файле, а в том, что статистика считается несколькими независимыми путями с разной временной моделью:

- live ingest и UTC-агрегация в `StatsService`
- rollup топов в `RollupService`
- timezone-aware пересчёт в `dashboard/api/.../stats/sync`
- UTC-пересчёт после historical sync в `HistoricalSyncService`
- прямые raw-сканы в `stats`, `users`, `channels`, `contacts`

Из-за этого система уже хранит одновременно несколько несовместимых наборов day/hour buckets. На локальной БД `StatDaily` для основной guild за последние 30 дней содержит 90 строк, а не 30, и эти строки лежат на часах `00`, `21` и `22` UTC. Это соответствует как минимум трём моделям бакетизации: UTC, UTC+3 и UTC+2.

Практический вывод: базовый фокус ревью действительно должен быть на БД, API дешборда и локализации, но код бота нельзя исключать, потому что именно он создаёт часть рассинхрона.

## Объём и метод

Проверены:

- схема и таблицы статистики в `bot/prisma/schema.prisma`
- bot ingest и rollup
- dashboard API для `stats`, `users`, `channels`, `contacts`, `sync`, `historical-sync`
- клиентские страницы statistics и i18n helpers
- локальная `stats.db` и `development.db`

Практические прогоны выполнены только по read-paths. Мутирующие пути (`/stats/sync`, `/stats/rollup`, historical sync) анализировались статически, чтобы не менять tracked `stats.db`.

## Карта потоков данных

1. Сбор raw-событий
- `MessageCreate` пишет `StatMessage` и `StatInteraction`
- `voiceAudit` пишет `StatVoiceState`
- `guildMemberAdd/Remove` увеличивают in-memory buffer новых/ушедших участников
- `presenceUpdate` пишет `StatActivity`

2. Онлайн-агрегация
- `StatsService.writeMetrics()` агрегирует buffer в `StatHourly` и `StatDaily`
- бакеты режутся по UTC: `setUTCMinutes(0,0,0)` и `setUTCHours(0,0,0,0)`

3. Фоновый rollup
- `RollupService` пересчитывает `StatTopMember` и `StatTopChannel`
- для сообщений фильтр по `createdAt`
- для голоса фильтр по `joinedAt`

4. Dashboard sync
- `/api/guilds/[guildId]/stats/sync` пересчитывает `StatHourly` и `StatDaily`
- бакеты режутся через `date-fns-tz` по `BotSettings.timezone`
- сообщения бакетизируются по `createdAt`
- голос бакетизируется по `leftAt || now`, а не по `joinedAt`

5. Historical sync
- `HistoricalSyncService` импортирует raw messages
- затем пересчитывает только message aggregates
- бакеты снова режутся по UTC

6. Чтение в dashboard
- `stats/route.ts` использует смесь rollup-таблиц и raw данных
- `users/route.ts` и `channels/route.ts` почти полностью сканируют raw tables
- `contacts/route.ts` строит граф напрямую из raw `StatVoiceState` и `StatInteraction`
- клиент дополнительно форматирует heatmap и даты через timezone на фронте

## Матрица метрик и источников истины

| Экран / контракт | Метрики | Таблицы | Где считаются | Семантика периода | Риск |
| --- | --- | --- | --- | --- | --- |
| `stats?type=overview` | `totalMessages`, `totalVoiceSeconds`, `newMembers`, `activityData` | `StatHourly`, `StatDaily` | server route | hourly по `dateHour`, daily по `date` | высокий: route склеивает несовместимые daily buckets по строковой дате |
| `stats?type=messages` | line chart, heatmap, tops, unique users/channels | `StatDaily`, `StatHourly`, `StatTop*`, `StatMessage` | server route | >24h: rollup + daily, 24h: raw/hourly | высокий: tops и uniques считаются и из rollup, и из raw |
| `stats?type=voice` | area chart, heatmap, tops, avg session, peak hour | `StatDaily`, `StatHourly`, `StatTop*`, `StatVoiceState` | server route | часть пути по `joinedAt`, часть по `leftAt` | критичный: голос имеет разную временную семантику |
| `stats?type=members` | growth, joins/leaves, trends | `StatDaily`, `Guild.memberCount` | server route | по `date` из daily | высокий: зависит от уже смешанных daily buckets |
| `stats?type=activities` | top activities | `StatActivity` | server route | по `startTime` | средний: отдельный источник истины, без timezone-пересчёта |
| `stats/users` | list + drilldown | `StatMessage`, `StatVoiceState` | raw route | messages по `createdAt`, voice по `joinedAt` | высокий: полный raw scan и своя агрегация |
| `stats/channels` | list + drilldown | `StatMessage`, `StatVoiceState` | raw route | messages по `createdAt`, voice по `joinedAt` | высокий: полный raw scan и своя агрегация |
| `stats/contacts` | nodes/edges | `StatVoiceState`, `StatInteraction` | raw route | voice по overlap window, text по `createdAt` | средний/высокий: алгоритм O(n^2) по voice overlap |
| `stats/sync` | пересчёт aggregate + 30D tops | raw tables + `BotSettings.timezone` | write path | timezone-aware | критичный: конфликтует с UTC paths |
| `historical-sync` | импорт raw messages + message aggregates | `StatMessage`, `StatHourly`, `StatDaily` | write path | UTC | критичный: конфликтует с timezone-aware sync |

## Фактические данные с локальной БД

Основная guild для измерений: `1374115841855197184` (`Штормград`)

### Объёмы таблиц

- `StatMessage`: `156,340`
- `StatVoiceState`: `571`
- `StatDaily`: `311`
- `StatHourly`: `2,355`
- `StatTopMember`: `532`
- `StatTopChannel`: `372`
- `StatInteraction`: `1,509`
- `StatActivity`: `61,583`
- `StatMemberCount`: `2,109`

### Объёмы по периодам для основной guild

| Период | Messages | Voice by `joinedAt` | Voice by overlap | Daily rows | Hourly rows | Interactions |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `24h` | 135 | 91 | 97 | 1 | 21 | 43 |
| `7d` | 3,943 | 464 | 464 | 21 | 172 | 1,256 |
| `30d` | 34,668 | 506 | 506 | 90 | 723 | 1,377 |
| `90d` | 123,876 | 506 | 506 | 270 | 2,113 | 1,377 |

### Доказательство смешанных daily buckets

За последние 30 дней `StatDaily` содержит `90` строк, а распределение по UTC-часу такое:

- `00`: 31 строка
- `21`: 29 строк
- `22`: 30 строк

Примеры последних строк:

- `2026-03-12T00:00:00.000Z`
- `2026-03-10T22:00:00.000Z`
- `2026-03-10T21:00:00.000Z`
- `2026-03-10T00:00:00.000Z`

Это подтверждает coexistence UTC и timezone-aware бакетов в одних и тех же aggregate tables.

## Практические baseline-замеры

### Query / read-path timings

| Операция | Ряды | Время |
| --- | ---: | ---: |
| `StatMessage.findMany` за 90d | 123,865 | `1703.89 ms` |
| `StatMessage.groupBy(authorId)` за 90d | 139 groups | `115.12 ms` |
| `StatVoiceState.findMany` overlap 90d | 506 | `6.49 ms` |
| `StatDaily.findMany` 90d | 269 | `3.62 ms` |
| `StatInteraction.findMany` 30d | 1,377 | `20.07 ms` |

### Route-like computations

| Путь | Объём | Время | Доп. память |
| --- | --- | ---: | ---: |
| users list logic 90d | `123,876` messages + `507` voice | `1435.85 ms` | `87.05 MB heap` |
| channels list logic 90d | `123,876` messages + `507` voice | `1453.52 ms` | `40.73 MB heap` |
| contacts voice+text 30d | `507` sessions, `1,377` interactions | `37.42 ms` total | `34,386` pair comparisons |

### Query plan notes

- `COUNT(DISTINCT channelId)` по `StatMessage` использует индекс `StatMessage_guildId_createdAt_idx`, но всё равно строит temp B-tree для `DISTINCT`
- raw `StatVoiceState` overlap query использует только `StatVoiceState_guildId_joinedAt_idx`, а часть условия по `leftAt` остаётся менее селективной

## Findings

### 1. Критичный: aggregate tables уже содержат несовместимые timezone buckets

Сейчас есть минимум три независимых модели бакетизации:

- UTC в `StatsService.writeMetrics()`  
  Ссылка: [bot/src/services/StatsService.ts](/d:/discord_bot/Dev/bot/src/services/StatsService.ts#L172)
- timezone-aware truncation в `/stats/sync`  
  Ссылка: [dashboard/src/app/api/guilds/[guildId]/stats/sync/route.ts](/d:/discord_bot/Dev/dashboard/src/app/api/guilds/[guildId]/stats/sync/route.ts#L59)
- UTC message-only recalculation после historical sync  
  Ссылка: [bot/src/services/HistoricalSyncService.ts](/d:/discord_bot/Dev/bot/src/services/HistoricalSyncService.ts#L206)

`stats/route.ts` знает об этой проблеме и просто группирует строки по отформатированной дате вместо устранения причины.  
Ссылка: [dashboard/src/app/api/guilds/[guildId]/stats/route.ts](/d:/discord_bot/Dev/dashboard/src/app/api/guilds/[guildId]/stats/route.ts#L200)

Риск:

- totals и trends зависят от того, какой путь последним писал aggregate tables
- timezone change не переагрегирует старые UTC buckets в единую модель
- charts визуально маскируют corruption, а не исправляют его

### 2. Критичный: голос имеет разные временные правила в разных путях

Временная семантика голоса сейчас несовместима:

- live aggregate в `StatsService` инкрементирует buffer в момент flush, без привязки к реальному start/end бакету  
  Ссылка: [bot/src/services/StatsService.ts](/d:/discord_bot/Dev/bot/src/services/StatsService.ts#L56)
- rollup топов считает голос по `joinedAt`  
  Ссылка: [bot/src/services/RollupService.ts](/d:/discord_bot/Dev/bot/src/services/RollupService.ts#L131)
- `/stats/sync` кладёт весь duration в бакет `leftAt || now`  
  Ссылка: [dashboard/src/app/api/guilds/[guildId]/stats/sync/route.ts](/d:/discord_bot/Dev/dashboard/src/app/api/guilds/[guildId]/stats/sync/route.ts#L168)
- raw drilldowns `users/channels` строят графики по `joinedAt`  
  Ссылки: [dashboard/src/app/api/guilds/[guildId]/stats/users/route.ts](/d:/discord_bot/Dev/dashboard/src/app/api/guilds/[guildId]/stats/users/route.ts#L252), [dashboard/src/app/api/guilds/[guildId]/stats/channels/route.ts](/d:/discord_bot/Dev/dashboard/src/app/api/guilds/[guildId]/stats/channels/route.ts#L243)

Риск:

- сессия через полночь попадает в разные дни в зависимости от экрана
- 24h/30d tops, area chart, drilldown и contacts могут расходиться при тех же raw rows

### 3. Высокий: `users` и `channels` routes не масштабируются, потому что грузят весь raw period в память

И `users`, и `channels` list/drilldown routes делают полный `findMany()` по сообщениям за период и потом считают агрегации в JS.  
Ссылки: [dashboard/src/app/api/guilds/[guildId]/stats/users/route.ts](/d:/discord_bot/Dev/dashboard/src/app/api/guilds/[guildId]/stats/users/route.ts#L77), [dashboard/src/app/api/guilds/[guildId]/stats/channels/route.ts](/d:/discord_bot/Dev/dashboard/src/app/api/guilds/[guildId]/stats/channels/route.ts#L76)

Практический baseline на текущей БД:

- users list logic 90d: `1435.85 ms`, `87.05 MB heap`
- channels list logic 90d: `1453.52 ms`, `40.73 MB heap`
- при этом один `groupBy(authorId)` на том же окне занял `115.12 ms`

Риск:

- деградация latency при росте `StatMessage`
- высокий memory churn на каждый запрос списка и drilldown
- повторение одной и той же тяжёлой логики в нескольких endpoints

### 4. Высокий: часть stats API не защищена auth/access checks

В `contacts`, `overview`, `bot-settings` есть access checks, но базовый `stats`, `users`, `channels`, `sync` и `historical-sync` routes их не делают.

Примеры:

- [dashboard/src/app/api/guilds/[guildId]/stats/route.ts](/d:/discord_bot/Dev/dashboard/src/app/api/guilds/[guildId]/stats/route.ts#L127)
- [dashboard/src/app/api/guilds/[guildId]/stats/users/route.ts](/d:/discord_bot/Dev/dashboard/src/app/api/guilds/[guildId]/stats/users/route.ts#L50)
- [dashboard/src/app/api/guilds/[guildId]/stats/channels/route.ts](/d:/discord_bot/Dev/dashboard/src/app/api/guilds/[guildId]/stats/channels/route.ts#L50)
- [dashboard/src/app/api/guilds/[guildId]/stats/sync/route.ts](/d:/discord_bot/Dev/dashboard/src/app/api/guilds/[guildId]/stats/sync/route.ts#L6)
- [dashboard/src/app/api/guilds/[guildId]/stats/historical-sync/route.ts](/d:/discord_bot/Dev/dashboard/src/app/api/guilds/[guildId]/stats/historical-sync/route.ts#L5)

Middleware тоже не покрывает `/api`, только `/dashboard` и `/login`.  
Ссылка: [dashboard/src/middleware.ts](/d:/discord_bot/Dev/dashboard/src/middleware.ts#L25)

Риск:

- read endpoints доступны без guild-level authorization
- write endpoints sync/historical-sync можно вызывать вне dashboard UI

### 5. Средний: pie charts по каналам не могут корректно показать `Others`

`getTotalValue()` всегда возвращает `totalChannels: 0`, а `StatsTopWidget` строит `Others` только если `totalValue > 0`.

- источник: [dashboard/src/app/api/guilds/[guildId]/stats/route.ts](/d:/discord_bot/Dev/dashboard/src/app/api/guilds/[guildId]/stats/route.ts#L76)
- потребитель: [dashboard/src/components/stats/StatsTopWidget.tsx](/d:/discord_bot/Dev/dashboard/src/components/stats/StatsTopWidget.tsx#L57)

Риск:

- channel pie widgets показывают неполную долю без серого сегмента `Other`
- визуализация и percentages в channel pies занижают общую картину

### 6. Средний: локаль dashboard имеет отдельный источник истины и уже частично битая

Проблемы локализации на текущем коде:

- `useGuildLocale()` читает только `localStorage`, а не `BotSettings.locale`  
  Ссылка: [dashboard/src/lib/i18n.ts](/d:/discord_bot/Dev/dashboard/src/lib/i18n.ts#L27)
- timezone при этом читается из `bot-settings`, то есть locale и timezone живут в разных источниках истины  
  Ссылка: [dashboard/src/lib/i18n.ts](/d:/discord_bot/Dev/dashboard/src/lib/i18n.ts#L49)
- русские строки в stats pages уже в mojibake  
  Примеры: [dashboard/src/app/dashboard/[guildId]/stats/messages/page.tsx](/d:/discord_bot/Dev/dashboard/src/app/dashboard/[guildId]/stats/messages/page.tsx#L58), [dashboard/src/app/dashboard/[guildId]/stats/voice/page.tsx](/d:/discord_bot/Dev/dashboard/src/app/dashboard/[guildId]/stats/voice/page.tsx#L53)
- `formatYAxis()` для английского миллиона возвращает `kk`, а не `M`; русские suffixes тоже уже повреждены  
  Ссылка: [dashboard/src/lib/utils.ts](/d:/discord_bot/Dev/dashboard/src/lib/utils.ts#L34)
- многие карточки используют `toLocaleString()` без передачи выбранной locale  
  Примеры: [dashboard/src/app/dashboard/[guildId]/stats/messages/page.tsx](/d:/discord_bot/Dev/dashboard/src/app/dashboard/[guildId]/stats/messages/page.tsx#L192), [dashboard/src/app/dashboard/[guildId]/stats/voice/page.tsx](/d:/discord_bot/Dev/dashboard/src/app/dashboard/[guildId]/stats/voice/page.tsx#L217)

Риск:

- пользователь может видеть RU/EN интерфейс не в соответствии с guild settings
- одинаковые числа форматируются по browser locale, а не по dashboard locale
- damaged strings уже портят UI и делают ревью локализации не теоретическим, а фактическим дефектом

### 7. Средний: `contacts` voice graph имеет квадратичную сложность по числу сессий в канале

`computeVoiceEdges()` делает pairwise overlap check для каждой пары сессий в одном канале.  
Ссылка: [dashboard/src/app/api/guilds/[guildId]/stats/contacts/route.ts](/d:/discord_bot/Dev/dashboard/src/app/api/guilds/[guildId]/stats/contacts/route.ts#L31)

Практический baseline на текущей БД ещё небольшой:

- `507` сессий
- `19` каналов
- `34,386` pair comparisons

Но рост здесь квадратичный, и при активных voice guilds это станет самым дорогим read-path статистики.

## Аудит публичных контрактов

Проверенные контракты:

- таблицы: `StatMessage`, `StatVoiceState`, `StatHourly`, `StatDaily`, `StatTopMember`, `StatTopChannel`, `StatInteraction`, `StatActivity`, `StatMemberCount`
- dashboard endpoints: `/stats`, `/stats/users`, `/stats/channels`, `/stats/contacts`, `/stats/sync`, `/stats/rollup`, `/stats/historical-sync`, `/bot-settings`
- bot local API: `/api/enrich`, `/api/search`, `/api/stats/historical-sync`

Ключевые замечания по контрактам:

- нет одного canonical правила для time bucketing
- нет одного canonical source of truth для locale
- write-path и read-path по-разному трактуют голос
- precomputed tops и raw drilldowns не гарантируют одинаковую семантику окна

## Рекомендованный backlog

### P0. Correctness / timezone

1. Выбрать единственную модель времени для aggregates:
- либо всё хранить в UTC buckets и конвертировать только на чтении
- либо всё хранить в explicit timezone buckets с обязательным full reaggregation при смене timezone

2. Очистить и переагрегировать `StatHourly` и `StatDaily` в одну модель:
- на копии БД проверить миграционный сценарий
- запретить coexistence UTC и timezone-aware writers

3. Зафиксировать одну семантику для голоса:
- либо атрибуция по `joinedAt`
- либо по `leftAt`
- либо сплит duration по бакетам

### P1. Read-path consistency

4. Убрать строковую маскировку проблем в `stats/route.ts`:
- charts должны читать уже корректные агрегаты
- не склеивать broken rows по `dd.mm.yyyy`

5. Сделать один shared server-side слой расчёта периода/окна:
- общий helper для `24h/3d/7d/14d/30d/90d/365d/all`
- единые правила для `messages`, `voice`, `users`, `channels`, `contacts`

6. Починить `Others` для channel pies:
- возвращать реальный `totalChannels`
- либо упростить контракт, если pie должен быть top-only

### P1. Security

7. Привести все stats endpoints к одной auth модели:
- `getAuthToken`
- `allowedGuilds`/`canAccessGuild`
- одинаковая защита для read и write routes

### P2. Performance

8. Убрать full raw scans из `users` и `channels` list paths:
- использовать `groupBy`/raw SQL aggregates
- возвращать только drilldown-детали через targeted raw reads

9. Ограничить стоимость `contacts`:
- предварительная агрегация edges
- sweep-line / interval indexing вместо pairwise nested loops
- hard caps и деградация режима при large datasets

10. Для тяжёлых read-paths зафиксировать benchmark target:
- list pages < `300 ms` на текущем объёме
- no request with `>25 MB` transient heap on current dataset

### P2. Localization

11. Перевести dashboard locale на guild-aware источник истины:
- читать `BotSettings.locale`
- хранить local override только как явное пользовательское предпочтение, если это нужно продукту

12. Исправить damaged encoding и форматирование:
- перевести mojibake files в корректный UTF-8
- заменить `kk` на корректный suffix
- передавать выбранную locale в форматтеры чисел и дат

## Что стоит проверить после исправлений

- одна и та же guild и период: overview/messages/voice/users/channels должны быть арифметически совместимы
- after timezone change: totals сохраняются, а бакеты меняются детерминированно
- voice session через полночь даёт одинаковую интерпретацию во всех экранах
- raw totals совпадают с top totals + `Others`
- RU и EN интерфейс отображают одинаковые данные с разным, но корректным formatting
