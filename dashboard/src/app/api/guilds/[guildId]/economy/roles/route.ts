import '@/lib/bigintJson';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorizeGuildApiRequest, isGuildApiAuthFailure } from '@/lib/guildApiAuth';
import type { RoleRule, FineRule } from '@/lib/economy/types';
import { invalidateEconomyCache } from '../_shared';

export const dynamic = 'force-dynamic';

type Body = {
    roleRules: RoleRule[];
    fineRules: FineRule[];
    confiscateOnBan: boolean;
};

export async function PUT(request: NextRequest, { params }: { params: Promise<{ guildId: string }> }) {
    try {
        const { guildId } = await params;
        const auth = await authorizeGuildApiRequest(request, guildId, { live: true });
        if (isGuildApiAuthFailure(auth)) return auth.response;

        const body = (await request.json()) as Body;
        const roleRules = Array.isArray(body.roleRules) ? body.roleRules : [];
        const fineRules = Array.isArray(body.fineRules) ? body.fineRules : [];

        const keptRoleIds = roleRules.map((r) => r.roleId).filter(Boolean);

        await prisma.$transaction([
            // Drop role rules no longer present (replace-all semantics).
            prisma.economyRoleRule.deleteMany({
                where: { guildId, roleId: { notIn: keptRoleIds.length ? keptRoleIds : ['__none__'] } },
            }),
            ...roleRules
                .filter((r) => r.roleId)
                .map((r) => {
                    const data = {
                        earnMultiplier: r.earnMultiplier,
                        salaryAmount: r.salaryAmount != null ? BigInt(r.salaryAmount) : null,
                        salaryIntervalHours: r.salaryIntervalHours,
                        taxAmount: r.taxAmount != null ? BigInt(r.taxAmount) : null,
                        taxBps: r.taxBps,
                        taxIntervalHours: r.taxIntervalHours,
                        shopDiscountBps: r.shopDiscountBps,
                        shopAccessOnly: r.shopAccessOnly,
                        robProtectionBps: r.robProtectionBps,
                    };
                    return prisma.economyRoleRule.upsert({
                        where: { guildId_roleId: { guildId, roleId: r.roleId } },
                        update: data,
                        create: { guildId, roleId: r.roleId, ...data },
                    });
                }),
            ...fineRules.map((f) => {
                const data = {
                    amount: f.amount != null ? BigInt(f.amount) : null,
                    percentBps: f.percentBps,
                    enabled: f.enabled,
                };
                return prisma.economyFineRule.upsert({
                    where: { guildId_actionType: { guildId, actionType: f.actionType } },
                    update: data,
                    create: { guildId, actionType: f.actionType, ...data },
                });
            }),
            prisma.economyConfig.upsert({
                where: { guildId },
                update: { confiscateOnBan: !!body.confiscateOnBan },
                create: { guildId, confiscateOnBan: !!body.confiscateOnBan },
            }),
        ]);

        await invalidateEconomyCache(guildId);
        return NextResponse.json({ ok: true });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to save role rules';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
