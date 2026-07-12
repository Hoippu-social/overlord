import { Events, Message } from 'discord.js';
import { processMessageForAiModeration } from '../services/AiModerationService';
import { processCustomRulesForAutomod, processMessageForAutomod } from '../services/AutomodService';
import { EconomyEarnService } from '../services/EconomyEarnService';
import { EconomyQuestService } from '../services/EconomyQuestService';
import { StatsService } from '../services/StatsService';

export default {
    name: Events.MessageCreate,
    once: false,
    async execute(message: Message) {
        // Ignore direct messages and bot messages
        if (!message.guild || message.author.bot) return;

        const guildId = message.guild.id;
        const channelId = message.channel.id;
        const authorId = message.author.id;

        try {
            // 1. Track the message itself
            await StatsService.trackMessage(
                guildId,
                channelId,
                authorId,
                message.content.length,
                message.id,
                message.createdAt
            );

            await EconomyEarnService.handleMessage(message);
            EconomyQuestService.incrementMetric(guildId, authorId, 'MESSAGES', 1).catch((err: unknown) =>
                console.error('[Economy] Failed to increment MESSAGES quest metric', err)
            );

            // 2. Track REPLY — if this message is a reply to another message
            if (message.reference?.messageId) {
                try {
                    const referenced = await message.fetchReference();
                    // Only track if replying to a real user (not a bot, not themselves)
                    if (referenced.author && !referenced.author.bot && referenced.author.id !== authorId) {
                        await StatsService.trackInteraction(
                            guildId, channelId,
                            authorId, referenced.author.id,
                            'REPLY',
                            `${message.id}:reply:${referenced.author.id}`,
                            message.createdAt
                        );
                    }
                } catch {
                    // Reference might be deleted — silently ignore
                }
            }

            // 3. Track MENTIONS — @user pings in the message body
            const mentionedUsers = message.mentions.users;
            for (const [userId, user] of mentionedUsers) {
                // Ignore bots and self-mentions, and don't double-count the reply target
                if (user.bot) continue;
                if (userId === authorId) continue;
                // Skip if already tracked as a REPLY to the same person
                if (message.reference?.messageId) {
                    try {
                        const ref = message.mentions.repliedUser;
                        if (ref && ref.id === userId) continue;
                    } catch { /* ignore */ }
                }
                await StatsService.trackInteraction(
                    guildId, channelId,
                    authorId, userId,
                    'MENTION',
                    `${message.id}:mention:${userId}`,
                    message.createdAt
                );
            }

            await processMessageForAutomod(message);
            await processCustomRulesForAutomod(message);
            await processMessageForAiModeration(message, 'create');
        } catch (error) {
            console.error('[Event:MessageCreate] Error tracking stats:', error);
        }
    },
};
