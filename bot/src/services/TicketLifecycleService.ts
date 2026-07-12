import { Client } from 'discord.js';
import { prisma } from '../utils/database';
import logger from '../utils/logger';

const SWEEP_INTERVAL_MS = 5 * 60 * 1000; // every 5 minutes

let sweepTimer: ReturnType<typeof setInterval> | null = null;

// ─── Auto-delete sweep ────────────────────────────────────────────────────────

async function sweepAutoDelete(client: Client): Promise<void> {
    const now = new Date();
    const due = await prisma.ticket.findMany({
        where: {
            status: 'CLOSED',
            deleteAfterAt: { not: null, lte: now },
        },
        select: { id: true, guildId: true, threadId: true },
    });

    for (const ticket of due) {
        try {
            const guild = client.guilds.cache.get(ticket.guildId) ?? await client.guilds.fetch(ticket.guildId).catch(() => null);
            if (guild) {
                const thread = await guild.channels.fetch(ticket.threadId).catch(() => null);
                if (thread) await thread.delete('Auto-delete after close').catch(() => null);
            }

            await prisma.ticket.update({
                where: { id: ticket.id },
                data: { deleteAfterAt: null },
            });
        } catch (err) {
            logger.warn(`[TicketLifecycle] Auto-delete failed for ticket ${ticket.id}:`, err);
        }
    }
}

// ─── Retention purge ──────────────────────────────────────────────────────────

async function sweepRetention(): Promise<void> {
    const configs = await prisma.ticketConfig.findMany({
        where: { transcriptRetentionDays: { gt: 0 } },
        select: { guildId: true, transcriptRetentionDays: true },
    });

    for (const config of configs) {
        const cutoff = new Date(Date.now() - config.transcriptRetentionDays * 24 * 60 * 60 * 1000);
        const { count } = await prisma.ticket.updateMany({
            where: {
                guildId: config.guildId,
                status: 'CLOSED',
                closedAt: { lte: cutoff },
                transcript: { not: null },
            },
            data: { transcript: null },
        });

        if (count > 0) {
            logger.info(`[TicketLifecycle] Purged transcripts for ${count} ticket(s) in guild ${config.guildId}`);
        }
    }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export const TicketLifecycleService = {
    init(client: Client) {
        if (sweepTimer) return;

        sweepTimer = setInterval(async () => {
            try {
                await sweepAutoDelete(client);
                await sweepRetention();
            } catch (err) {
                logger.warn('[TicketLifecycle] Sweep error:', err);
            }
        }, SWEEP_INTERVAL_MS);

        logger.info('[TicketLifecycle] Initialized (auto-delete + retention sweep every 5 min)');
    },

    stop() {
        if (sweepTimer) {
            clearInterval(sweepTimer);
            sweepTimer = null;
        }
    },
};
