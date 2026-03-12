import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthToken } from '@/lib/auth';
import { canAccessGuild } from '@/lib/discordAccess';

const REVERSAL_ACTIONS = new Set(['UNWARN', 'UNTIMEOUT', 'UNMUTE', 'UNBAN', 'NOTE_CLEAR']);

function average(values: number[]) {
    if (!values.length) return null;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ guildId: string }> }) {
    try {
        const token = await getAuthToken(request);
        const accessToken = typeof token?.accessToken === 'string' ? token.accessToken : null;
        if (!accessToken) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { guildId } = await params;
        const allowedGuilds = Array.isArray(token?.allowedGuilds) ? token.allowedGuilds : null;
        const hasAccess = allowedGuilds ? allowedGuilds.includes(guildId) : await canAccessGuild(accessToken, guildId);
        if (!hasAccess) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const windowDays = Math.min(Math.max(Number(request.nextUrl.searchParams.get('windowDays') ?? 30) || 30, 1), 365);
        const fromDate = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

        const [cases, incidents, appeals] = await Promise.all([
            prisma.moderationCase.findMany({
                where: {
                    guildId,
                    createdAt: { gte: fromDate },
                    actorUserId: { not: null },
                },
                select: {
                    actorUserId: true,
                    actionType: true,
                    status: true,
                    source: true,
                    createdAt: true,
                },
            }),
            prisma.aiModerationIncident.findMany({
                where: {
                    guildId,
                    reviewedAt: { not: null, gte: fromDate },
                    reviewerId: { not: null },
                },
                select: {
                    reviewerId: true,
                    status: true,
                    createdAt: true,
                    reviewedAt: true,
                },
            }),
            prisma.appealTicket.findMany({
                where: {
                    guildId,
                    reviewerId: { not: null },
                    createdAt: { gte: fromDate },
                },
                select: {
                    reviewerId: true,
                    status: true,
                    createdAt: true,
                    reviewedAt: true,
                },
            }),
        ]);

        const actorMap = new Map<string, {
            moderatorId: string;
            totalActions: number;
            warns: number;
            timeouts: number;
            bans: number;
            mutes: number;
            kicks: number;
            reversals: number;
            aiReviews: number;
            falsePositives: number;
            appealsReviewed: number;
            acceptedAppeals: number;
            rejectedAppeals: number;
            avgAiReviewMinutes: number | null;
            avgAppealReviewHours: number | null;
            aiReviewDurations: number[];
            appealReviewDurations: number[];
        }>();

        const getBucket = (moderatorId: string) => {
            const existing = actorMap.get(moderatorId);
            if (existing) return existing;
            const created = {
                moderatorId,
                totalActions: 0,
                warns: 0,
                timeouts: 0,
                bans: 0,
                mutes: 0,
                kicks: 0,
                reversals: 0,
                aiReviews: 0,
                falsePositives: 0,
                appealsReviewed: 0,
                acceptedAppeals: 0,
                rejectedAppeals: 0,
                avgAiReviewMinutes: null,
                avgAppealReviewHours: null,
                aiReviewDurations: [] as number[],
                appealReviewDurations: [] as number[],
            };
            actorMap.set(moderatorId, created);
            return created;
        };

        for (const moderationCase of cases) {
            if (!moderationCase.actorUserId) continue;
            const bucket = getBucket(moderationCase.actorUserId);
            bucket.totalActions += 1;

            switch (moderationCase.actionType) {
                case 'WARN':
                    bucket.warns += 1;
                    break;
                case 'TIMEOUT':
                    bucket.timeouts += 1;
                    break;
                case 'BAN':
                case 'TEMPBAN':
                    bucket.bans += 1;
                    break;
                case 'MUTE':
                    bucket.mutes += 1;
                    break;
                case 'KICK':
                    bucket.kicks += 1;
                    break;
                default:
                    break;
            }

            if (REVERSAL_ACTIONS.has(moderationCase.actionType) || moderationCase.status === 'REVERTED') {
                bucket.reversals += 1;
            }
        }

        for (const incident of incidents) {
            if (!incident.reviewerId) continue;
            const bucket = getBucket(incident.reviewerId);
            bucket.aiReviews += 1;
            if (incident.status === 'FALSE_POSITIVE') {
                bucket.falsePositives += 1;
            }
            if (incident.reviewedAt) {
                bucket.aiReviewDurations.push((incident.reviewedAt.getTime() - incident.createdAt.getTime()) / 60000);
            }
        }

        for (const appeal of appeals) {
            if (!appeal.reviewerId) continue;
            const bucket = getBucket(appeal.reviewerId);
            bucket.appealsReviewed += 1;
            if (appeal.status === 'ACCEPTED' || appeal.status === 'PARDONED') {
                bucket.acceptedAppeals += 1;
            }
            if (appeal.status === 'REJECTED') {
                bucket.rejectedAppeals += 1;
            }
            if (appeal.reviewedAt) {
                bucket.appealReviewDurations.push((appeal.reviewedAt.getTime() - appeal.createdAt.getTime()) / 3600000);
            }
        }

        const moderators = Array.from(actorMap.values())
            .map((bucket) => ({
                moderatorId: bucket.moderatorId,
                totalActions: bucket.totalActions,
                warns: bucket.warns,
                timeouts: bucket.timeouts,
                bans: bucket.bans,
                mutes: bucket.mutes,
                kicks: bucket.kicks,
                reversals: bucket.reversals,
                aiReviews: bucket.aiReviews,
                falsePositives: bucket.falsePositives,
                falsePositiveRate: bucket.aiReviews ? Math.round((bucket.falsePositives / bucket.aiReviews) * 100) : 0,
                appealsReviewed: bucket.appealsReviewed,
                acceptedAppeals: bucket.acceptedAppeals,
                rejectedAppeals: bucket.rejectedAppeals,
                avgAiReviewMinutes: average(bucket.aiReviewDurations),
                avgAppealReviewHours: average(bucket.appealReviewDurations),
            }))
            .sort((left, right) => right.totalActions - left.totalActions || right.aiReviews - left.aiReviews);

        return NextResponse.json({
            windowDays,
            summary: {
                totalModeratorActions: cases.length,
                totalAiReviews: incidents.length,
                totalAppealReviews: appeals.length,
                uniqueModerators: moderators.length,
            },
            moderators,
        });
    } catch (error) {
        console.error('Failed to load moderation analytics:', error);
        return NextResponse.json({ error: 'Failed to load moderation analytics.' }, { status: 500 });
    }
}
