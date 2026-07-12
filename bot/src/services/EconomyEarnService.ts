import { Client, Message } from 'discord.js';
import { prisma } from '../utils/database';
import logger from '../utils/logger';
import { EconomyService } from './EconomyService';
import { EconomyQuestService } from './EconomyQuestService';
import {
    DEFAULT_MESSAGES_SETTINGS,
    DEFAULT_VOICE_SETTINGS,
    MessagesEarnSettings,
    VoiceEarnSettings,
} from '../types/economy';

const SETTINGS_CACHE_TTL_MS = 60_000;
const FLUSH_INTERVAL_MS = 60_000;
const WINDOW_MS = 3_600_000;

interface SettingsCacheEntry<T> {
    settings: T;
    fetchedAt: number;
}

/**
 * EconomyEarnService — Phase 1 earning engine for the Economy module.
 *
 * Handles the MESSAGES and VOICE earn sources only. Message earnings are
 * buffered in memory and flushed to the ledger on a fixed interval; voice
 * earnings are computed and credited once per tick by scanning live voice
 * states.
 */
export class EconomyEarnService {
    private static messageBuffer: Map<string, bigint> = new Map();
    private static messageCooldowns: Map<string, number> = new Map();
    // Rolling-hour window counter for diminishing returns. Phase 1 keeps this in-memory
    // only — it does NOT persist to EconomyMember.msgWindowStart/msgWindowCount, which
    // are reserved for a future cross-restart-persistence enhancement.
    private static messageWindow: Map<string, { windowStart: number; count: number }> = new Map();
    private static voiceDailyMinutes: Map<string, { date: string; minutes: number }> = new Map();
    private static intervalHandle: NodeJS.Timeout | null = null;

    private static messagesSettingsCache: Map<string, SettingsCacheEntry<MessagesEarnSettings>> = new Map();
    private static voiceSettingsCache: Map<string, SettingsCacheEntry<VoiceEarnSettings>> = new Map();

    static init(client: Client): void {
        if (this.intervalHandle) return;

        this.intervalHandle = setInterval(() => {
            this.tick(client).catch((err) => logger.error('[EconomyEarnService] tick failed', err));
        }, FLUSH_INTERVAL_MS);
    }

    static shutdown(): void {
        if (this.intervalHandle) clearInterval(this.intervalHandle);
        this.intervalHandle = null;
        // Fire-and-forget final flush of whatever's already buffered from messages.
        // Don't attempt one more voice tick on shutdown — guild/voice state may be torn down.
        this.flushMessageBuffer().catch(() => {});
    }

    static async handleMessage(message: Message): Promise<void> {
        const guildId = message.guild!.id;
        const channelId = message.channelId;
        const userId = message.author.id;

        if (!(await EconomyService.isSourceEnabled(guildId, 'MESSAGES'))) return;

        const settings = await this.getMessagesSettings(guildId);

        const key = `${guildId}:${userId}`;
        const last = this.messageCooldowns.get(key) ?? 0;
        if (Date.now() - last < settings.cooldownSeconds * 1000) return;

        if (message.content.length < settings.minMessageLength) return;
        if (!settings.countThreads && message.channel.isThread()) return;
        if (settings.excludedChannelIds.includes(channelId)) return;

        let windowEntry = this.messageWindow.get(key);
        if (!windowEntry || Date.now() - windowEntry.windowStart > WINDOW_MS) {
            windowEntry = { windowStart: Date.now(), count: 1 };
        } else {
            windowEntry.count += 1;
        }
        this.messageWindow.set(key, windowEntry);

        const diminishingMultiplier = this.resolveDiminishingMultiplier(settings, windowEntry.count);

        const base =
            settings.minAmount +
            Math.floor(Math.random() * (settings.maxAmount - settings.minAmount + 1));

        const roleChannelMult = await EconomyService.resolveMultiplier(guildId, userId, {
            channelId,
            member: message.member ?? undefined,
        });

        const finalAmount = BigInt(Math.max(1, Math.round(base * diminishingMultiplier * roleChannelMult)));

        this.messageBuffer.set(key, (this.messageBuffer.get(key) ?? 0n) + finalAmount);
        this.messageCooldowns.set(key, Date.now());
    }

    private static resolveDiminishingMultiplier(settings: MessagesEarnSettings, count: number): number {
        const steps = [...settings.diminishingSteps].sort((a, b) => a.afterCount - b.afterCount);
        let multiplier = 1.0;
        for (const step of steps) {
            if (step.afterCount <= count) {
                multiplier = step.multiplier;
            }
        }
        return multiplier;
    }

    private static async getMessagesSettings(guildId: string): Promise<MessagesEarnSettings> {
        const cached = this.messagesSettingsCache.get(guildId);
        if (cached && Date.now() - cached.fetchedAt < SETTINGS_CACHE_TTL_MS) {
            return cached.settings;
        }

        let settings: MessagesEarnSettings = DEFAULT_MESSAGES_SETTINGS;
        try {
            const row = await prisma.economyEarnSource.findUnique({
                where: { guildId_source: { guildId, source: 'MESSAGES' } },
            });
            settings = row?.settings
                ? { ...DEFAULT_MESSAGES_SETTINGS, ...JSON.parse(row.settings) }
                : DEFAULT_MESSAGES_SETTINGS;
        } catch (err) {
            logger.error('[EconomyEarnService] Failed to parse MESSAGES settings', err);
            settings = DEFAULT_MESSAGES_SETTINGS;
        }

        this.messagesSettingsCache.set(guildId, { settings, fetchedAt: Date.now() });
        return settings;
    }

    private static async getVoiceSettings(guildId: string): Promise<VoiceEarnSettings> {
        const cached = this.voiceSettingsCache.get(guildId);
        if (cached && Date.now() - cached.fetchedAt < SETTINGS_CACHE_TTL_MS) {
            return cached.settings;
        }

        let settings: VoiceEarnSettings = DEFAULT_VOICE_SETTINGS;
        try {
            const row = await prisma.economyEarnSource.findUnique({
                where: { guildId_source: { guildId, source: 'VOICE' } },
            });
            settings = row?.settings
                ? { ...DEFAULT_VOICE_SETTINGS, ...JSON.parse(row.settings) }
                : DEFAULT_VOICE_SETTINGS;
        } catch (err) {
            logger.error('[EconomyEarnService] Failed to parse VOICE settings', err);
            settings = DEFAULT_VOICE_SETTINGS;
        }

        this.voiceSettingsCache.set(guildId, { settings, fetchedAt: Date.now() });
        return settings;
    }

    private static async flushMessageBuffer(): Promise<void> {
        if (this.messageBuffer.size === 0) return;

        const snapshot = new Map(this.messageBuffer);
        this.messageBuffer.clear();

        for (const [key, amount] of snapshot.entries()) {
            const separatorIndex = key.indexOf(':');
            const guildId = key.slice(0, separatorIndex);
            const userId = key.slice(separatorIndex + 1);

            try {
                await EconomyService.credit({
                    guildId,
                    userId,
                    account: 'WALLET',
                    amount,
                    type: 'MESSAGE_EARN',
                });
            } catch (err) {
                logger.error(`[EconomyEarnService] Failed to flush message earnings for ${key}`, err);
            }
        }
    }

    private static async tick(client: Client): Promise<void> {
        await this.flushMessageBuffer();

        for (const guild of client.guilds.cache.values()) {
            if (!(await EconomyService.isSourceEnabled(guild.id, 'VOICE'))) continue;

            const settings = await this.getVoiceSettings(guild.id);

            const channelGroups = new Map<string, { memberId: string; selfMute: boolean; selfDeaf: boolean }[]>();
            for (const voiceState of guild.voiceStates.cache.values()) {
                const member = voiceState.member;
                if (!member || member.user.bot) continue;
                const channelId = voiceState.channelId;
                if (!channelId) continue;

                if (!channelGroups.has(channelId)) channelGroups.set(channelId, []);
                channelGroups.get(channelId)!.push({
                    memberId: member.id,
                    selfMute: voiceState.selfMute ?? false,
                    selfDeaf: voiceState.selfDeaf ?? false,
                });
            }

            for (const [channelId, members] of channelGroups.entries()) {
                if (members.length < settings.minMembersInChannel) continue;
                if (settings.excludeAfkChannel && channelId === guild.afkChannelId) continue;
                if (settings.excludedChannelIds.includes(channelId)) continue;

                for (const voiceMember of members) {
                    // Phase-1 simplification: pause immediately on any self-mute+deaf tick
                    // rather than tracking a graduated per-minute threshold.
                    if (
                        settings.pauseAfterSelfMuteDeafMinutes != null &&
                        voiceMember.selfMute &&
                        voiceMember.selfDeaf
                    ) {
                        continue;
                    }

                    const today = new Date().toISOString().slice(0, 10);
                    const dailyKey = `${guild.id}:${voiceMember.memberId}`;
                    let dailyEntry = this.voiceDailyMinutes.get(dailyKey);
                    if (!dailyEntry || dailyEntry.date !== today) {
                        dailyEntry = { date: today, minutes: 0 };
                    }

                    if (settings.dailyCapMinutes != null && dailyEntry.minutes >= settings.dailyCapMinutes) {
                        this.voiceDailyMinutes.set(dailyKey, dailyEntry);
                        continue;
                    }

                    dailyEntry.minutes += 1;
                    this.voiceDailyMinutes.set(dailyKey, dailyEntry);

                    try {
                        await EconomyService.credit({
                            guildId: guild.id,
                            userId: voiceMember.memberId,
                            account: 'WALLET',
                            amount: BigInt(settings.amountPerMinute),
                            type: 'VOICE_EARN',
                        });
                        EconomyQuestService.incrementMetric(guild.id, voiceMember.memberId, 'VOICE_MINUTES', 1).catch(
                            (questErr: unknown) =>
                                logger.error('[EconomyEarnService] Failed to increment VOICE_MINUTES quest metric', questErr)
                        );
                    } catch (err) {
                        logger.error(
                            `[EconomyEarnService] Failed to credit voice earnings for ${dailyKey}`,
                            err
                        );
                    }
                }
            }
        }
    }
}
