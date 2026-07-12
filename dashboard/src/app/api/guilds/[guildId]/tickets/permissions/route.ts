import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorizeTicketRequest, isTicketAuthFailure } from '@/lib/ticketAccess';

export const dynamic = 'force-dynamic';

type AccessProfileInput = {
    id?: number;
    name: string;
    roleIds?: string[] | string | null;
    permissions?: string[] | string | null;
    dashboardHomeOnly?: boolean;
    enabled?: boolean;
    sortOrder?: number;
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

        const profiles = await prisma.ticketAccessProfile.findMany({
            where: { guildId },
            orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
        });
        return NextResponse.json({ profiles });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to fetch ticket permissions';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ guildId: string }> }) {
    try {
        const { guildId } = await params;
        const auth = await authorizeTicketRequest(request, guildId, 'tickets.config', { live: true });
        if (isTicketAuthFailure(auth)) return auth.response;

        const body = await request.json() as { profiles?: AccessProfileInput[] };
        const profiles = Array.isArray(body.profiles) ? body.profiles : [];
        const keepIds: number[] = [];

        for (const [index, profile] of profiles.entries()) {
            const data = {
                guildId,
                name: profile.name.trim(),
                roleIds: normalizeJsonArray(profile.roleIds),
                permissions: normalizeJsonArray(profile.permissions),
                dashboardHomeOnly: profile.dashboardHomeOnly ?? false,
                enabled: profile.enabled ?? true,
                sortOrder: profile.sortOrder ?? index * 10,
            };
            if (!data.name) {
                return NextResponse.json({ error: 'Profile name is required' }, { status: 400 });
            }

            const existing = profile.id
                ? await prisma.ticketAccessProfile.findFirst({ where: { id: profile.id, guildId }, select: { id: true } })
                : null;
            if (profile.id && !existing) {
                return NextResponse.json({ error: 'Access profile not found' }, { status: 404 });
            }

            const saved = existing
                ? await prisma.ticketAccessProfile.update({ where: { id: existing.id }, data })
                : await prisma.ticketAccessProfile.create({ data });
            keepIds.push(saved.id);
        }

        await prisma.ticketAccessProfile.deleteMany({
            where: { guildId, id: { notIn: keepIds.length ? keepIds : [-1] } },
        });

        const savedProfiles = await prisma.ticketAccessProfile.findMany({
            where: { guildId },
            orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
        });

        return NextResponse.json({ profiles: savedProfiles });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to save ticket permissions';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
