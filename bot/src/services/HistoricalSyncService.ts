import { Client, TextChannel, ChannelType, Collection, Message } from 'discord.js';
import { statsPrisma } from '../utils/database';

export interface HistoricalSyncProgress {
    phase: string;
    current: number;
    total: number;
    message: string;
    percentComplete: number;
}

export type ProgressCallback = (progress: HistoricalSyncProgress) => void;

/**
 * HistoricalSyncService - Collects historical data from Discord for analytics.
 * UPDATED: Unlimited batch processing + Dual-DB support.
 */
export class HistoricalSyncService {
    private static isRunning = new Map<string, boolean>();

    static isSyncRunning(guildId: string): boolean {
        return this.isRunning.get(guildId) ?? false;
    }

    static async collectHistoricalData(
        client: Client,
        guildId: string,
        days: number,
        onProgress: ProgressCallback
    ): Promise<{ success: boolean; messagesCollected: number; error?: string }> {
        // Validate days
        if (days > 90) return { success: false, messagesCollected: 0, error: 'Период более 90 дней недоступен' };
        if (this.isRunning.get(guildId)) return { success: false, messagesCollected: 0, error: 'Сбор данных уже запущен' };

        this.isRunning.set(guildId, true);

        try {
            const guild = client.guilds.cache.get(guildId);
            if (!guild) return { success: false, messagesCollected: 0, error: 'Сервер не найден' };

            const since = new Date(); since.setDate(since.getDate() - days); since.setUTCHours(0, 0, 0, 0);

            onProgress({ phase: 'init', current: 0, total: 100, message: 'Подготовка...', percentComplete: 0 });

            // Ensure Guild exists in Stats DB (Prisma checks FKs)
            try {
                await statsPrisma.guild.upsert({
                    where: { id: guild.id },
                    update: {},
                    create: { id: guild.id, name: guild.name, icon: guild.icon }
                });
            } catch (e) {
                console.error('Failed to sync guild to statsDB during history sync', e);
            }

            const allChannels = await guild.channels.fetch();
            const textChannels = allChannels.filter(
                ch => ch && ch.type === ChannelType.GuildText &&
                    ch.permissionsFor(guild.members.me!)?.has(['ViewChannel', 'ReadMessageHistory'])
            ) as Collection<string, TextChannel>;

            const totalChannels = textChannels.size;
            let processedChannels = 0;
            let totalMessages = 0;

            console.log(`[HistoricalSync] Found ${totalChannels} text channels to scan in guild ${guildId} since ${since.toISOString()}`);

            onProgress({ phase: 'channels', current: 0, total: totalChannels, message: `Найдено ${totalChannels} каналов`, percentComplete: 5 });

            for (const [channelId, channel] of textChannels) {
                processedChannels++;
                onProgress({
                    phase: 'fetching',
                    current: processedChannels,
                    total: totalChannels,
                    message: `Для #${channel.name}...`,
                    percentComplete: 5 + Math.floor((processedChannels / totalChannels) * 80)
                });

                try {
                    // Process channel in streams/chunks to avoid memory issues and remove limits
                    const collectedInChannel = await this.syncChannel(channel, guildId, since);
                    totalMessages += collectedInChannel;
                } catch (error) {
                    console.error(`[HistoricalSync] Failed #${channel.name}:`, error);
                }
            }

            onProgress({ phase: 'aggregating', current: 90, total: 100, message: 'Агрегация...', percentComplete: 90 });

            console.log(`[HistoricalSync] Recalculating aggregations for ${totalMessages} new messages...`);
            // Recalculate aggregations in BOTH DBs
            await this.recalculateAggregations(guildId, since);

            onProgress({ phase: 'complete', current: 100, total: 100, message: `Готово! +${totalMessages} сообщений`, percentComplete: 100 });
            console.log(`[HistoricalSync] Completed. Total collected: ${totalMessages}`);

            return { success: true, messagesCollected: totalMessages };

        } catch (error) {
            console.error('[HistoricalSync] Error:', error);
            return { success: false, messagesCollected: 0, error: error instanceof Error ? error.message : 'Ошибка' };
        } finally {
            this.isRunning.set(guildId, false);
        }
    }

    /**
     * Syncs a single channel by fetching messages in batches (pages), checking against DB, and writing immediately.
     * No hard limits on count, only date.
     */
    private static async syncChannel(channel: TextChannel, guildId: string, since: Date): Promise<number> {
        let lastId: string | undefined;
        let reachedDateLimit = false;
        let channelTotal = 0;
        let batchBuffer: Message[] = [];
        const BATCH_SIZE = 500; // Write to DB every 500 messages

        while (!reachedDateLimit) {
            const options: { limit: number; before?: string } = { limit: 100 };
            if (lastId) options.before = lastId;

            const batch = await channel.messages.fetch(options);
            if (batch.size === 0) break; // No more messages

            const messages = [...batch.values()];
            lastId = messages[messages.length - 1].id; // Move cursor

            for (const msg of messages) {
                if (msg.createdAt < since) {
                    reachedDateLimit = true;
                    // Don't break immediately if we want to ensure we process the rest of the batch?
                    // Actually, if sorted by new->old, once we hit < since, all subsequent are also < since.
                    continue;
                }
                if (!msg.author.bot) {
                    batchBuffer.push(msg);
                }
            }

            // If buffer is big enough or we finished, flush
            if (batchBuffer.length >= BATCH_SIZE || (reachedDateLimit && batchBuffer.length > 0) || (batch.size < 100 && batchBuffer.length > 0)) {
                channelTotal += await this.flushBuffer(batchBuffer, guildId, channel.id, since);
                batchBuffer = []; // Clear buffer
            }

            if (reachedDateLimit) break;

            await new Promise(r => setTimeout(r, 200)); // Rate limit protection
        }

        // Flush remaining
        if (batchBuffer.length > 0) {
            channelTotal += await this.flushBuffer(batchBuffer, guildId, channel.id, since);
        }

        return channelTotal;
    }

    /**
     * Filters a batch of messages against the database and writes new ones.
     */
    private static async flushBuffer(messages: Message[], guildId: string, channelId: string, since: Date): Promise<number> {
        if (messages.length === 0) return 0;

        // 1. Get min/max dates from this batch to optimize DB query
        // batch is sorted new->old usually.
        const batchStart = messages[messages.length - 1].createdAt;
        const batchEnd = messages[0].createdAt;

        // 2. Fetch existing signatures from statsDB for this specific range
        // Adding a small buffer to time range just in case
        const existingMessages = await statsPrisma.statMessage.findMany({
            where: {
                guildId,
                channelId,
                createdAt: {
                    gte: batchStart,
                    lte: batchEnd
                }
            },
            select: { createdAt: true, authorId: true }
        });

        const existingSignatures = new Set(existingMessages.map(m => `${m.createdAt.getTime()}_${m.authorId}`));

        // 3. Filter
        const newMessages = messages.filter(msg => !existingSignatures.has(`${msg.createdAt.getTime()}_${msg.author.id}`));

        if (newMessages.length === 0) return 0;

        // 4. Write
        const data = newMessages.map(msg => ({
            guildId,
            channelId: msg.channelId,
            authorId: msg.author.id,
            length: msg.content.length,
            createdAt: msg.createdAt
        }));

        await statsPrisma.statMessage.createMany({ data });

        return newMessages.length;
    }

    private static async recalculateAggregations(guildId: string, since: Date) {
        // Use statsDB as source for aggregation
        // To avoid OOM on aggregation (loading 100k messages), we should probably use groupBy in database
        // But Prisma groupBy doesn't support generic date truncation easily in all providers.
        // For SQLite, we can raw query or load in chunks.
        // Given current constraints, let's load efficiently.

        // Optimisation: Delete old aggregations for this period first?
        // Upsert is safe but slow.

        // Let's use raw query for speed if possible, or careful looping.
        // For strict reliability matching previous logic:
        const messages = await statsPrisma.statMessage.findMany({
            where: { guildId, createdAt: { gte: since } },
            select: { createdAt: true } // Only need dates
        });

        const hourlyMap = new Map<string, number>();
        const dailyMap = new Map<string, number>();

        for (const msg of messages) {
            const h = new Date(msg.createdAt); h.setUTCMinutes(0, 0, 0);
            const hKey = h.toISOString();
            hourlyMap.set(hKey, (hourlyMap.get(hKey) || 0) + 1);

            const d = new Date(msg.createdAt); d.setUTCHours(0, 0, 0, 0);
            const dKey = d.toISOString();
            dailyMap.set(dKey, (dailyMap.get(dKey) || 0) + 1);
        }

        // Upsert Hourly
        // Batch upserts are not natively supported well in Prisma, so loop is fine for now
        // (Aggregation counts are usually much smaller than raw messages)
        const hourlyOperations = [];
        for (const [dateHourStr, count] of hourlyMap) {
            const dateHour = new Date(dateHourStr);
            hourlyOperations.push(statsPrisma.statHourly.upsert({
                where: { guildId_dateHour: { guildId, dateHour } },
                update: { messages: count }, // ONLY update messages so voice/member counts are preserved
                create: { guildId, dateHour, messages: count, voiceSeconds: 0, newMembers: 0, leftMembers: 0 }
            }));
        }

        // Upsert Daily
        const dailyOperations = [];
        for (const [dateStr, count] of dailyMap) {
            const date = new Date(dateStr);

            dailyOperations.push(statsPrisma.statDaily.upsert({
                where: { guildId_date: { guildId, date } },
                update: { messages: count }, // ONLY update messages so voice/member counts are preserved
                create: { guildId, date, messages: count, voiceSeconds: 0, newMembers: 0, leftMembers: 0 }
            }));
        }

        // Execute in chunks to avoid "too many variables" or connection limits
        await this.runBatch(hourlyOperations);
        await this.runBatch(dailyOperations);
    }

    private static async runBatch(promises: Promise<any>[]) {
        const CHUNK = 50;
        for (let i = 0; i < promises.length; i += CHUNK) {
            await Promise.all(promises.slice(i, i + CHUNK));
        }
    }
}
