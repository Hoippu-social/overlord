import '@/lib/bigintJson';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorizeGuildApiRequest, isGuildApiAuthFailure } from '@/lib/guildApiAuth';
import type { ShopItem, ShopItemType } from '@/lib/economy/types';

export const dynamic = 'force-dynamic';

function parseJsonArray(value: string | null): string[] {
    if (!value) return [];
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
        return [];
    }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapShopItem(row: any): ShopItem {
    return {
        id: row.id,
        name: row.name,
        description: row.description,
        emoji: row.emoji,
        type: row.type as ShopItemType,
        price: String(row.price),
        roleId: row.roleId,
        tempRoleHours: row.tempRoleHours,
        useEffect: row.useEffect,
        stock: row.stock,
        maxPerUser: row.maxPerUser,
        requiredRoleIds: parseJsonArray(row.requiredRoleIds),
        deniedRoleIds: parseJsonArray(row.deniedRoleIds),
        resellable: row.resellable,
        rentUpkeepAmount: row.rentUpkeepAmount != null ? String(row.rentUpkeepAmount) : null,
        rentUpkeepIntervalHours: row.rentUpkeepIntervalHours,
        enabled: row.enabled,
        sortOrder: row.sortOrder,
    };
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ guildId: string }> }) {
    try {
        const { guildId } = await params;
        const auth = await authorizeGuildApiRequest(request, guildId, { live: true });
        if (isGuildApiAuthFailure(auth)) return auth.response;

        const body = (await request.json()) as Partial<ShopItem>;

        const created = await prisma.economyShopItem.create({
            data: {
                guildId,
                name: body.name ?? 'Unnamed item',
                description: body.description ?? null,
                emoji: body.emoji ?? null,
                type: body.type ?? 'CUSTOM',
                price: BigInt(body.price ?? '0'),
                roleId: body.roleId ?? null,
                tempRoleHours: body.tempRoleHours ?? null,
                useEffect: body.useEffect ?? null,
                stock: body.stock ?? null,
                maxPerUser: body.maxPerUser ?? null,
                requiredRoleIds: JSON.stringify(body.requiredRoleIds ?? []),
                deniedRoleIds: JSON.stringify(body.deniedRoleIds ?? []),
                resellable: body.resellable ?? false,
                rentUpkeepAmount: body.rentUpkeepAmount != null ? BigInt(body.rentUpkeepAmount) : null,
                rentUpkeepIntervalHours: body.rentUpkeepIntervalHours ?? null,
                enabled: body.enabled ?? true,
                sortOrder: body.sortOrder ?? 0,
            },
        });

        return NextResponse.json(mapShopItem(created));
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to create shop item';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
