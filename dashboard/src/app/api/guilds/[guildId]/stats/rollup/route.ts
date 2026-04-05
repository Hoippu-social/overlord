import { NextRequest, NextResponse } from 'next/server';
import { statsPrisma } from '@/lib/prisma';
import { requireGuildStatsAccess } from '@/lib/statsAccess';
import { buildVoiceWhereClause, getStatsPeriodKey, getStatsStartDate, normalizeStatsPeriod } from '@/lib/stats';
import { withStatsTelemetry } from '@/lib/statsTelemetry';

export const dynamic = 'force-dynamic';

const COOLDOWN_MS = 30 * 60 * 1000;
const isMissingTableError = (error: unknown) => {
    const err = error as { code?: string; message?: string };
    if (err?.code === 'P2021') return true;
    const message = err?.message || '';
    return message.includes('no such table') || message.includes('does not exist');
};

async function getTopRollupsFromReadModels(guildId: string, since: Date) {
    try {
        const [msgByChannel, msgByMember, voiceByChannel, voiceByMember] = await Promise.all([
            statsPrisma.statChannelDaily.groupBy({
                by: ['channelId'],
                where: { guildId, date: { gte: since } },
                _sum: { messages: true },
                orderBy: { _sum: { messages: 'desc' } },
                take: 20,
            }),
            statsPrisma.statMemberDaily.groupBy({
                by: ['userId'],
                where: { guildId, date: { gte: since } },
                _sum: { messages: true },
                orderBy: { _sum: { messages: 'desc' } },
                take: 20,
            }),
            statsPrisma.statChannelDaily.groupBy({
                by: ['channelId'],
                where: { guildId, date: { gte: since } },
                _sum: { voiceSeconds: true },
                orderBy: { _sum: { voiceSeconds: 'desc' } },
                take: 20,
            }),
            statsPrisma.statMemberDaily.groupBy({
                by: ['userId'],
                where: { guildId, date: { gte: since } },
                _sum: { voiceSeconds: true },
                orderBy: { _sum: { voiceSeconds: 'desc' } },
                take: 20,
            }),
        ]);

        return {
            msgByChannel: msgByChannel.map((row) => ({
                channelId: row.channelId,
                value: row._sum.messages || 0,
            })),
            msgByMember: msgByMember.map((row) => ({
                userId: row.userId,
                value: row._sum.messages || 0,
            })),
            voiceByChannel: voiceByChannel.map((row) => ({
                channelId: row.channelId,
                value: row._sum.voiceSeconds || 0,
            })),
            voiceByMember: voiceByMember.map((row) => ({
                userId: row.userId,
                value: row._sum.voiceSeconds || 0,
            })),
        };
    } catch (error) {
        if (isMissingTableError(error)) {
            return null;
        }
        throw error;
    }
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ guildId: string }> }
) {
    const { guildId } = await params;
    return withStatsTelemetry({ guildId, endpoint: 'rollup', method: 'POST' }, async () => {
        try {
        const access = await requireGuildStatsAccess(request, guildId, { live: true });
        if (!access.ok) {
            return access.response;
        }

        const body = await request.json();
        const period = normalizeStatsPeriod(body?.period || '7d');
        const periodKey = getStatsPeriodKey(period);

        const latestTop = await statsPrisma.statTopMember.findFirst({
            where: { guildId, period: periodKey },
            orderBy: { updatedAt: 'desc' },
            select: { updatedAt: true },
        });

        if (latestTop?.updatedAt) {
            const ageMs = Date.now() - latestTop.updatedAt.getTime();
            if (ageMs < COOLDOWN_MS) {
                const remainingMin = Math.ceil((COOLDOWN_MS - ageMs) / 60000);
                return NextResponse.json({
                    skipped: true,
                    reason: 'cache_fresh',
                    refreshInMinutes: remainingMin,
                    period: periodKey,
                });
            }
        }

        const since = getStatsStartDate(period, new Date());

        const readModelRollups = period !== '24h'
            ? await getTopRollupsFromReadModels(guildId, since)
            : null;

        const [msgByChannel, msgByMember, voiceByChannel, voiceByMember] = readModelRollups
            ? [
                readModelRollups.msgByChannel,
                readModelRollups.msgByMember,
                readModelRollups.voiceByChannel,
                readModelRollups.voiceByMember,
            ]
            : await Promise.all([
                statsPrisma.statMessage.groupBy({
                    by: ['channelId'],
                    where: { guildId, createdAt: { gte: since } },
                    _count: { id: true },
                    orderBy: { _count: { id: 'desc' } },
                    take: 20,
                }).then((rows) => rows.map((row) => ({
                    channelId: row.channelId,
                    value: row._count.id,
                }))),
                statsPrisma.statMessage.groupBy({
                    by: ['authorId'],
                    where: { guildId, createdAt: { gte: since } },
                    _count: { id: true },
                    orderBy: { _count: { id: 'desc' } },
                    take: 20,
                }).then((rows) => rows.map((row) => ({
                    userId: row.authorId,
                    value: row._count.id,
                }))),
                statsPrisma.statVoiceState.groupBy({
                    by: ['channelId'],
                    where: { guildId, ...buildVoiceWhereClause(since) },
                    _sum: { duration: true },
                    orderBy: { _sum: { duration: 'desc' } },
                    take: 20,
                }).then((rows) => rows.map((row) => ({
                    channelId: row.channelId,
                    value: row._sum.duration || 0,
                }))),
                statsPrisma.statVoiceState.groupBy({
                    by: ['userId'],
                    where: { guildId, ...buildVoiceWhereClause(since) },
                    _sum: { duration: true },
                    orderBy: { _sum: { duration: 'desc' } },
                    take: 20,
                }).then((rows) => rows.map((row) => ({
                    userId: row.userId,
                    value: row._sum.duration || 0,
                }))),
            ]);

        await Promise.all([
            statsPrisma.statTopChannel.deleteMany({ where: { guildId, period: periodKey } }),
            statsPrisma.statTopMember.deleteMany({ where: { guildId, period: periodKey } }),
        ]);

        const creates: Promise<unknown>[] = [];

        for (const channel of msgByChannel) {
            creates.push(
                statsPrisma.statTopChannel.create({
                    data: {
                        guildId,
                        channelId: channel.channelId,
                        period: periodKey,
                        category: 'MESSAGES',
                        value: channel.value,
                    },
                })
            );
        }

        for (const member of msgByMember) {
            creates.push(
                statsPrisma.statTopMember.create({
                    data: {
                        guildId,
                        userId: member.userId,
                        period: periodKey,
                        category: 'MESSAGES',
                        value: member.value,
                    },
                })
            );
        }

        for (const channel of voiceByChannel) {
            creates.push(
                statsPrisma.statTopChannel.create({
                    data: {
                        guildId,
                        channelId: channel.channelId,
                        period: periodKey,
                        category: 'VOICE',
                        value: channel.value,
                    },
                })
            );
        }

        for (const member of voiceByMember) {
            creates.push(
                statsPrisma.statTopMember.create({
                    data: {
                        guildId,
                        userId: member.userId,
                        period: periodKey,
                        category: 'VOICE',
                        value: member.value,
                    },
                })
            );
        }

        await Promise.all(creates);

        console.log(`[Rollup API] Recalculated tops: guild=${guildId} period=${periodKey}`);

            return NextResponse.json({
                success: true,
                period: periodKey,
                recalculated: true,
            });
        } catch (error) {
            console.error('[Rollup API] Error:', error);
            return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
        }
    });
}
