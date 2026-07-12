import '@/lib/bigintJson';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorizeGuildApiRequest, isGuildApiAuthFailure } from '@/lib/guildApiAuth';
import type { ShopItem } from '@/lib/economy/types';
import { mapShopItem } from '../route';

export const dynamic = 'force-dynamic';

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ guildId: string; itemId: string }> }
) {
    try {
        const { guildId, itemId } = await params;
        const id = parseInt(itemId);
        if (isNaN(id)) return NextResponse.json({ error: 'Invalid item ID' }, { status: 400 });

        const auth = await authorizeGuildApiRequest(request, guildId, { live: true });
        if (isGuildApiAuthFailure(auth)) return auth.response;

        const body = (await request.json()) as Partial<ShopItem>;

        const data: Record<string, unknown> = {};
        if (body.name !== undefined) data.name = body.name;
        if (body.description !== undefined) data.description = body.description;
        if (body.emoji !== undefined) data.emoji = body.emoji;
        if (body.type !== undefined) data.type = body.type;
        if (body.price !== undefined) data.price = BigInt(body.price);
        if (body.roleId !== undefined) data.roleId = body.roleId;
        if (body.tempRoleHours !== undefined) data.tempRoleHours = body.tempRoleHours;
        if (body.useEffect !== undefined) data.useEffect = body.useEffect;
        if (body.stock !== undefined) data.stock = body.stock;
        if (body.maxPerUser !== undefined) data.maxPerUser = body.maxPerUser;
        if (body.requiredRoleIds !== undefined) data.requiredRoleIds = JSON.stringify(body.requiredRoleIds);
        if (body.deniedRoleIds !== undefined) data.deniedRoleIds = JSON.stringify(body.deniedRoleIds);
        if (body.resellable !== undefined) data.resellable = body.resellable;
        if (body.rentUpkeepAmount !== undefined) data.rentUpkeepAmount = body.rentUpkeepAmount != null ? BigInt(body.rentUpkeepAmount) : null;
        if (body.rentUpkeepIntervalHours !== undefined) data.rentUpkeepIntervalHours = body.rentUpkeepIntervalHours;
        if (body.enabled !== undefined) data.enabled = body.enabled;
        if (body.sortOrder !== undefined) data.sortOrder = body.sortOrder;

        const updated = await prisma.economyShopItem.updateMany({ where: { id, guildId }, data });
        if (updated.count === 0) {
            return NextResponse.json({ error: 'Item not found' }, { status: 404 });
        }

        const row = await prisma.economyShopItem.findUnique({ where: { id } });
        if (!row) return NextResponse.json({ error: 'Item not found' }, { status: 404 });
        return NextResponse.json(mapShopItem(row));
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to update shop item';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ guildId: string; itemId: string }> }
) {
    try {
        const { guildId, itemId } = await params;
        const id = parseInt(itemId);
        if (isNaN(id)) return NextResponse.json({ error: 'Invalid item ID' }, { status: 400 });

        const auth = await authorizeGuildApiRequest(request, guildId, { live: true });
        if (isGuildApiAuthFailure(auth)) return auth.response;

        // Soft delete: inventory rows FK-reference with onDelete Restrict.
        const updated = await prisma.economyShopItem.updateMany({
            where: { id, guildId },
            data: { enabled: false },
        });
        if (updated.count === 0) {
            return NextResponse.json({ error: 'Item not found' }, { status: 404 });
        }

        return NextResponse.json({ ok: true });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to delete shop item';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
