import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorizeTicketRequest, isTicketAuthFailure } from '@/lib/ticketAccess';

export const dynamic = 'force-dynamic';

type NotificationRuleInput = {
    categoryId?: number | null;
    priorityId?: number | null;
    assignedRoleId?: string | null;
    assignedTemplateId?: number | null;
    eventType: string;
    targetRoleIds?: string[] | string | null;
    targetChannelId?: string | null;
    cooldownSeconds?: number;
    enabled?: boolean;
};

function normalizeJsonArray(value: unknown) {
    if (Array.isArray(value)) return JSON.stringify(value.filter((item) => typeof item === 'string'));
    if (typeof value === 'string') {
        try {
            const parsed = JSON.parse(value);
            return JSON.stringify(Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : []);
        } catch {
            return JSON.stringify(value.split(',').map((item) => item.trim()).filter(Boolean));
        }
    }
    return JSON.stringify([]);
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ guildId: string }> }) {
    try {
        const { guildId } = await params;
        const auth = await authorizeTicketRequest(request, guildId, 'tickets.config');
        if (isTicketAuthFailure(auth)) return auth.response;

        const rules = await prisma.ticketNotificationRule.findMany({
            where: { guildId },
            orderBy: [{ id: 'asc' }],
        });
        return NextResponse.json({ rules });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to fetch ticket notification rules';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ guildId: string }> }) {
    try {
        const { guildId } = await params;
        const auth = await authorizeTicketRequest(request, guildId, 'tickets.config', { live: true });
        if (isTicketAuthFailure(auth)) return auth.response;

        const body = await request.json() as { rules?: NotificationRuleInput[] };
        const rules = Array.isArray(body.rules) ? body.rules : [];

        await prisma.ticketNotificationRule.deleteMany({ where: { guildId } });
        if (rules.length) {
            await prisma.ticketNotificationRule.createMany({
                data: rules.map((rule) => ({
                    guildId,
                    categoryId: rule.categoryId ?? null,
                    priorityId: rule.priorityId ?? null,
                    assignedRoleId: rule.assignedRoleId ?? null,
                    assignedTemplateId: rule.assignedTemplateId ?? null,
                    eventType: rule.eventType,
                    targetRoleIds: normalizeJsonArray(rule.targetRoleIds),
                    targetChannelId: rule.targetChannelId ?? null,
                    cooldownSeconds: rule.cooldownSeconds ?? 300,
                    enabled: rule.enabled ?? true,
                })),
            });
        }

        const saved = await prisma.ticketNotificationRule.findMany({
            where: { guildId },
            orderBy: [{ id: 'asc' }],
        });

        return NextResponse.json({ rules: saved });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to save ticket notification rules';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
