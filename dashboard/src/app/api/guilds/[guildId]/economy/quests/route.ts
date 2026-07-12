import '@/lib/bigintJson';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorizeGuildApiRequest, isGuildApiAuthFailure } from '@/lib/guildApiAuth';
import type { QuestTemplate } from '@/lib/economy/types';

export const dynamic = 'force-dynamic';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ guildId: string }> }) {
    try {
        const { guildId } = await params;
        const auth = await authorizeGuildApiRequest(request, guildId, { live: true });
        if (isGuildApiAuthFailure(auth)) return auth.response;

        const body = (await request.json()) as { quests: QuestTemplate[] };
        const quests = Array.isArray(body.quests) ? body.quests : [];

        // Rows with a positive id are existing; id <= 0 marks a new row to create.
        const keptIds = quests.filter((q) => q.id > 0).map((q) => q.id);

        await prisma.$transaction([
            prisma.economyQuestProgress.deleteMany({
                where: { guildId, template: { id: { notIn: keptIds.length ? keptIds : [-1] } } },
            }),
            prisma.economyQuestTemplate.deleteMany({
                where: { guildId, id: { notIn: keptIds.length ? keptIds : [-1] } },
            }),
            ...quests.map((q) => {
                const data = {
                    kind: q.kind,
                    metric: q.metric,
                    target: q.target,
                    reward: BigInt(q.reward),
                    name: q.name,
                    description: q.description,
                    enabled: q.enabled,
                    sortOrder: q.sortOrder,
                };
                if (q.id > 0) {
                    return prisma.economyQuestTemplate.update({ where: { id: q.id }, data });
                }
                return prisma.economyQuestTemplate.create({ data: { guildId, ...data } });
            }),
        ]);

        return NextResponse.json({ ok: true });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to save quests';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
