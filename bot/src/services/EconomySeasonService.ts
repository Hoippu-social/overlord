import { Client } from 'discord.js';
import { EconomySeason } from '@prisma/client';
import { prisma } from '../utils/database';
import logger from '../utils/logger';
import { EconomyService } from './EconomyService';

interface SeasonRewardBand {
    rankFrom: number;
    rankTo: number;
    amount: number;
    roleId?: string;
}

export type EndSeasonResult =
    | { ok: true; seasonId: number; resultCount: number }
    | { ok: false; reason: 'NO_ACTIVE_SEASON' };

export class EconomySeasonService {
    static async getActiveSeason(guildId: string): Promise<EconomySeason | null> {
        return prisma.economySeason.findFirst({
            where: { guildId, status: 'ACTIVE' },
            orderBy: { number: 'desc' },
        });
    }

    static async startSeason(
        guildId: string,
        opts?: { name?: string; rewardsConfig?: unknown }
    ): Promise<EconomySeason> {
        const last = await prisma.economySeason.findFirst({
            where: { guildId },
            orderBy: { number: 'desc' },
        });

        return prisma.economySeason.create({
            data: {
                guildId,
                number: (last?.number ?? 0) + 1,
                name: opts?.name,
                rewardsConfig: opts?.rewardsConfig ? JSON.stringify(opts.rewardsConfig) : null,
                status: 'ACTIVE',
            },
        });
    }

    /**
     * Ranks members by totalEarned, snapshots results, pays out rewardsConfig bands,
     * optionally resets balances, archives the season, and opens the next one.
     */
    static async endSeason(
        guildId: string,
        opts?: { resetBalances?: boolean; client?: Client }
    ): Promise<EndSeasonResult> {
        const season = await this.getActiveSeason(guildId);
        if (!season) {
            return { ok: false, reason: 'NO_ACTIVE_SEASON' };
        }

        const ranked = await prisma.economyMember.findMany({
            where: { guildId },
            orderBy: { totalEarned: 'desc' },
            take: 500,
        });

        if (ranked.length > 0) {
            await prisma.economySeasonResult.createMany({
                data: ranked.map((m, i) => ({
                    seasonId: season.id,
                    guildId,
                    userId: m.userId,
                    rank: i + 1,
                    finalWallet: m.wallet,
                    finalBank: m.bank,
                    totalEarned: m.totalEarned,
                })),
            });
        }

        let bands: SeasonRewardBand[] = [];
        if (season.rewardsConfig) {
            try {
                const parsed = JSON.parse(season.rewardsConfig);
                if (Array.isArray(parsed)) bands = parsed as SeasonRewardBand[];
            } catch {
                bands = [];
            }
        }

        if (bands.length > 0) {
            for (let i = 0; i < ranked.length; i++) {
                const rank = i + 1;
                const member = ranked[i];
                const band = bands.find((b) => rank >= b.rankFrom && rank <= b.rankTo);
                if (!band || !Number.isFinite(band.amount) || band.amount <= 0) continue;

                // Role grants from band.roleId are not yet applied — that requires a live
                // GuildMember fetch per winner, which is out of scope for this pass.
                await EconomyService.credit(
                    {
                        guildId,
                        userId: member.userId,
                        account: 'WALLET',
                        amount: BigInt(Math.trunc(band.amount)),
                        type: 'SEASON_REWARD',
                        sourceRef: `season:${season.id}`,
                    },
                    opts?.client
                );
            }
        }

        if (opts?.resetBalances) {
            // totalEarned resets alongside wallet/bank — it's this method's own ranking
            // metric (see the `orderBy: { totalEarned: 'desc' }` query above), so leaving
            // it untouched would make every future season's leaderboard identical to a
            // lifetime-earnings leaderboard, defeating the point of a seasonal reset.
            const resetResult = await prisma.economyMember.updateMany({
                where: { guildId },
                data: { wallet: 0n, bank: 0n, totalEarned: 0n },
            });

            // Bulk reset — writing one ledger row per member would be expensive at scale,
            // so this is a single synthetic system-level ledger entry (userId: 'SYSTEM',
            // not tied to a real Discord user) summarizing the reset, unlike every other
            // ledger row so far which is per-user.
            await prisma.economyTransaction.create({
                data: {
                    guildId,
                    userId: 'SYSTEM',
                    type: 'SEASON_RESET',
                    account: 'WALLET',
                    amount: 0n,
                    balanceAfter: 0n,
                    sourceRef: `season:${season.id}`,
                    metadata: JSON.stringify({ membersReset: resetResult.count }),
                },
            });
        }

        await prisma.economySeason.update({
            where: { id: season.id },
            data: { status: 'ARCHIVED', endsAt: new Date() },
        });

        await this.startSeason(guildId).catch((err) => {
            logger.error('[EconomySeasonService] Failed to auto-start next season', err);
        });

        return { ok: true, seasonId: season.id, resultCount: ranked.length };
    }

    static async getHallOfFame(guildId: string, seasonNumber?: number) {
        let seasonId: number | null = null;

        if (seasonNumber != null) {
            const season = await prisma.economySeason.findUnique({
                where: { guildId_number: { guildId, number: seasonNumber } },
            });
            seasonId = season?.id ?? null;
        } else {
            const season = await prisma.economySeason.findFirst({
                where: { guildId, status: 'ARCHIVED' },
                orderBy: { number: 'desc' },
            });
            seasonId = season?.id ?? null;
        }

        if (seasonId === null) return [];

        return prisma.economySeasonResult.findMany({
            where: { seasonId },
            orderBy: { rank: 'asc' },
            take: 100,
        });
    }
}
