import '@/lib/bigintJson';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorizeGuildApiRequest, isGuildApiAuthFailure } from '@/lib/guildApiAuth';
import type { Achievement } from '@/lib/economy/types';

export const dynamic = 'force-dynamic';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ guildId: string }> }) {
    try {
        const { guildId } = await params;
        const auth = await authorizeGuildApiRequest(request, guildId, { live: true });
        if (isGuildApiAuthFailure(auth)) return auth.response;

        const body = (await request.json()) as { achievements: Achievement[] };
        const achievements = Array.isArray(body.achievements) ? body.achievements : [];

        // id > 0 = existing; id <= 0 = new row to create.
        const keptIds = achievements.filter((a) => a.id > 0).map((a) => a.id);

        await prisma.$transaction([
            prisma.economyAchievementUnlock.deleteMany({
                where: { guildId, achievement: { id: { notIn: keptIds.length ? keptIds : [-1] } } },
            }),
            prisma.economyAchievement.deleteMany({
                where: { guildId, id: { notIn: keptIds.length ? keptIds : [-1] } },
            }),
            ...achievements.map((a) => {
                const data = {
                    key: a.key,
                    name: a.name,
                    description: a.description,
                    metric: a.metric,
                    threshold: a.threshold,
                    reward: BigInt(a.reward),
                    badgeEmoji: a.badgeEmoji,
                    enabled: a.enabled,
                };
                if (a.id > 0) {
                    return prisma.economyAchievement.update({ where: { id: a.id }, data });
                }
                return prisma.economyAchievement.create({ data: { guildId, ...data } });
            }),
        ]);

        return NextResponse.json({ ok: true });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to save achievements';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
