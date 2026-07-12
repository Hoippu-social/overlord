import { Events, MessageReaction, PartialMessageReaction, User, PartialUser } from 'discord.js';
import { prisma } from '../utils/database';
import logger from '../utils/logger';
import { EconomyService } from '../services/EconomyService';
import { EconomyQuestService } from '../services/EconomyQuestService';
import { DEFAULT_REACTIONS_SETTINGS, ReactionsEarnSettings } from '../types/economy';

// Per-author-per-day trigger counter for the REACTIONS earn source. In-memory only —
// resets on restart, which is an accepted soft cap (same simplification as the daily
// voice-minute cap in EconomyEarnService).
const dailyTriggers = new Map<string, { date: string; count: number }>();

export default {
    name: Events.MessageReactionAdd,
    once: false,
    async execute(reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser) {
        if (user.bot) return;

        try {
            const message = reaction.message.partial ? await reaction.message.fetch() : reaction.message;
            if (!message.guild || !message.author || message.author.bot) return;

            const guildId = message.guild.id;
            const authorId = message.author.id;

            // Quest metric: count every reaction add regardless of the REACTIONS earn source toggle.
            EconomyQuestService.incrementMetric(guildId, user.id, 'REACTIONS', 1).catch((err: unknown) =>
                logger.error('[Economy] Failed to increment REACTIONS quest metric', err)
            );

            if (!(await EconomyService.isSourceEnabled(guildId, 'REACTIONS'))) return;
            if (authorId === user.id) return; // no self-reaction farming

            const row = await prisma.economyEarnSource.findUnique({
                where: { guildId_source: { guildId, source: 'REACTIONS' } },
            });
            let settings: ReactionsEarnSettings = DEFAULT_REACTIONS_SETTINGS;
            if (row?.settings) {
                try {
                    settings = { ...DEFAULT_REACTIONS_SETTINGS, ...JSON.parse(row.settings) };
                } catch {
                    settings = DEFAULT_REACTIONS_SETTINGS;
                }
            }

            const totalReactions = message.reactions.cache.reduce((sum, r) => sum + r.count, 0);
            if (totalReactions < settings.threshold) return;

            if (settings.dailyCapTriggers != null) {
                const today = new Date().toISOString().slice(0, 10);
                const key = `${guildId}:${authorId}`;
                const entry = dailyTriggers.get(key);
                const count = entry && entry.date === today ? entry.count : 0;
                if (count >= settings.dailyCapTriggers) return;
                dailyTriggers.set(key, { date: today, count: count + 1 });
            }

            // Idempotency key keyed on the message ensures the bonus fires exactly once per
            // message even if multiple reaction events race past the threshold concurrently.
            await EconomyService.credit({
                guildId,
                userId: authorId,
                account: 'WALLET',
                amount: BigInt(settings.amount),
                type: 'REACTION_EARN',
                sourceRef: `reactions:${message.id}`,
                idempotencyKey: `reaction_bonus:${guildId}:${message.id}`,
            });
        } catch (err) {
            logger.error('[Economy] Failed to process reaction for REACTIONS earn source', err);
        }
    },
};
