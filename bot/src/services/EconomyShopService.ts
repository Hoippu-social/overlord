import { GuildMember } from 'discord.js';
import { Prisma, EconomyShopItem, EconomyInventoryItem, EconomyMarketListing } from '@prisma/client';
import { prisma } from '../utils/database';
import logger from '../utils/logger';
import { EconomyService } from './EconomyService';
import { EconomyQuestService } from './EconomyQuestService';

class OutOfStockError extends Error {
    constructor() {
        super('OUT_OF_STOCK');
    }
}

export type PurchaseResult =
    | { ok: true; inventoryItemId: number }
    | {
          ok: false;
          reason:
              | 'NOT_FOUND'
              | 'DISABLED'
              | 'OUT_OF_STOCK'
              | 'MAX_PER_USER'
              | 'ROLE_REQUIRED'
              | 'ROLE_DENIED'
              | 'INSUFFICIENT_FUNDS'
              | 'BLACKLISTED';
      };

export type UseResult =
    | { ok: true; effect: string | null }
    | { ok: false; reason: 'NOT_FOUND' | 'NOT_USABLE' | 'ALREADY_USED' };

export type ListResult =
    | { ok: true; listingId: number }
    | { ok: false; reason: 'NOT_FOUND' | 'NOT_RESELLABLE' | 'ALREADY_LISTED' };

export type BuyResult =
    | { ok: true }
    | { ok: false; reason: 'NOT_FOUND' | 'ALREADY_SOLD' | 'INSUFFICIENT_FUNDS' | 'SELF_PURCHASE' };

// EconomyMarketListing has no Prisma relation to EconomyInventoryItem (plain inventoryItemId
// FK, no back-reference in schema.prisma) — this shape is built with a manual join in
// listMarket() below rather than a Prisma `include`.
export interface EconomyMarketListingWithItem extends EconomyMarketListing {
    inventoryItem: (EconomyInventoryItem & { shopItem: EconomyShopItem }) | null;
}

export class EconomyShopService {
    static async createShopItem(
        guildId: string,
        data: Omit<Prisma.EconomyShopItemCreateInput, 'guildId'>
    ): Promise<EconomyShopItem> {
        return prisma.economyShopItem.create({ data: { guildId, ...data } });
    }

    static async updateShopItem(
        guildId: string,
        itemId: number,
        data: Partial<Omit<Prisma.EconomyShopItemUpdateInput, 'guildId'>>
    ): Promise<EconomyShopItem> {
        await prisma.economyShopItem.updateMany({ where: { id: itemId, guildId }, data });
        return prisma.economyShopItem.findUniqueOrThrow({ where: { id: itemId } });
    }

    static async deleteShopItem(guildId: string, itemId: number): Promise<void> {
        await prisma.economyShopItem.updateMany({ where: { id: itemId, guildId }, data: { enabled: false } });
    }

    static async listShopItems(guildId: string, opts?: { onlyEnabled?: boolean }): Promise<EconomyShopItem[]> {
        return prisma.economyShopItem.findMany({
            where: { guildId, ...(opts?.onlyEnabled ? { enabled: true } : {}) },
            orderBy: { sortOrder: 'asc' },
        });
    }

    static async purchase(params: {
        guildId: string;
        userId: string;
        itemId: number;
        member?: GuildMember;
    }): Promise<PurchaseResult> {
        const { guildId, userId, itemId, member } = params;

        const item = await prisma.economyShopItem.findFirst({ where: { id: itemId, guildId } });
        if (!item) {
            return { ok: false, reason: 'NOT_FOUND' };
        }
        if (!item.enabled) {
            return { ok: false, reason: 'DISABLED' };
        }

        if (member) {
            if (item.requiredRoleIds) {
                try {
                    const requiredRoleIds: string[] = JSON.parse(item.requiredRoleIds);
                    if (requiredRoleIds.length > 0 && !requiredRoleIds.some((r) => member.roles.cache.has(r))) {
                        return { ok: false, reason: 'ROLE_REQUIRED' };
                    }
                } catch {
                    // malformed JSON — skip the check rather than fail closed
                }
            }
            if (item.deniedRoleIds) {
                try {
                    const deniedRoleIds: string[] = JSON.parse(item.deniedRoleIds);
                    if (deniedRoleIds.some((r) => member.roles.cache.has(r))) {
                        return { ok: false, reason: 'ROLE_DENIED' };
                    }
                } catch {
                    // malformed JSON — skip the check rather than fail closed
                }
            }
        }

        if (item.maxPerUser != null) {
            const owned = await prisma.economyInventoryItem.count({
                where: { guildId, userId, shopItemId: itemId, status: { not: 'EXPIRED' } },
            });
            if (owned >= item.maxPerUser) {
                return { ok: false, reason: 'MAX_PER_USER' };
            }
        }

        let effectivePrice = item.price;
        if (member && member.roles.cache.size > 0) {
            const roleIds = [...member.roles.cache.keys()];
            const rules = await prisma.economyRoleRule.findMany({
                where: { guildId, roleId: { in: roleIds } },
            });
            let discountBps = 0;
            for (const rule of rules) {
                if (rule.shopDiscountBps > discountBps) discountBps = rule.shopDiscountBps;
            }
            if (discountBps > 0) {
                effectivePrice = item.price - (item.price * BigInt(discountBps)) / 10000n;
            }
        }

        try {
            await prisma.$transaction(async (tx) => {
                if (item.stock != null) {
                    const res = await tx.economyShopItem.updateMany({
                        where: { id: itemId, guildId, stock: { gte: 1 } },
                        data: { stock: { decrement: 1 } },
                    });
                    if (res.count === 0) {
                        throw new OutOfStockError();
                    }
                }
            });
        } catch (error) {
            if (error instanceof OutOfStockError) {
                return { ok: false, reason: 'OUT_OF_STOCK' };
            }
            throw error;
        }

        const debitResult = await EconomyService.debit({
            guildId,
            userId,
            account: 'WALLET',
            amount: effectivePrice,
            type: 'SHOP_PURCHASE',
            sourceRef: `shopItem:${itemId}`,
        });

        if (!debitResult.ok) {
            if (item.stock != null) {
                await prisma.economyShopItem
                    .update({ where: { id: itemId }, data: { stock: { increment: 1 } } })
                    .catch((err) => logger.error(`Failed to restore stock for shop item ${itemId}: ${err}`));
            }
            if (debitResult.reason === 'BLACKLISTED') {
                return { ok: false, reason: 'BLACKLISTED' };
            }
            return { ok: false, reason: 'INSUFFICIENT_FUNDS' };
        }

        const inventoryItem = await prisma.economyInventoryItem.create({
            data: {
                guildId,
                userId,
                shopItemId: itemId,
                paidPrice: effectivePrice,
                roleExpiresAt:
                    item.type === 'TEMP_ROLE' && item.tempRoleHours
                        ? new Date(Date.now() + item.tempRoleHours * 3600 * 1000)
                        : null,
                nextUpkeepAt: item.rentUpkeepIntervalHours
                    ? new Date(Date.now() + item.rentUpkeepIntervalHours * 3600 * 1000)
                    : null,
            },
        });

        if ((item.type === 'ROLE' || item.type === 'TEMP_ROLE') && item.roleId && member) {
            await member.roles.add(item.roleId).catch((err) => {
                logger.error(`Failed to grant role ${item.roleId} to ${userId} in guild ${guildId}: ${err}`);
                return null;
            });
        }

        EconomyQuestService.incrementMetric(guildId, userId, 'ITEMS_BOUGHT', 1).catch((err: unknown) =>
            logger.error('[EconomyShopService] Failed to increment ITEMS_BOUGHT quest metric', err)
        );

        return { ok: true, inventoryItemId: inventoryItem.id };
    }

    static async useItem(params: {
        guildId: string;
        userId: string;
        inventoryItemId: number;
    }): Promise<UseResult> {
        const { guildId, userId, inventoryItemId } = params;

        const inventoryItem = await prisma.economyInventoryItem.findFirst({
            where: { id: inventoryItemId, guildId, userId },
            include: { shopItem: true },
        });
        if (!inventoryItem) {
            return { ok: false, reason: 'NOT_FOUND' };
        }
        if (inventoryItem.shopItem.type !== 'USABLE') {
            return { ok: false, reason: 'NOT_USABLE' };
        }
        if (inventoryItem.status !== 'OWNED') {
            return { ok: false, reason: 'ALREADY_USED' };
        }

        let parsedEffect: { effect?: string; durationHours?: number } | null = null;
        if (inventoryItem.shopItem.useEffect) {
            try {
                parsedEffect = JSON.parse(inventoryItem.shopItem.useEffect);
            } catch {
                parsedEffect = null;
            }
        }

        if (parsedEffect?.durationHours) {
            // Generic-reuse convention: for USABLE items, roleExpiresAt is repurposed as
            // "this item's active effect expires at" rather than an actual role expiry.
            await prisma.economyInventoryItem.update({
                where: { id: inventoryItemId },
                data: {
                    status: 'USED',
                    usedAt: new Date(),
                    roleExpiresAt: new Date(Date.now() + parsedEffect.durationHours * 3600 * 1000),
                },
            });
        } else {
            await prisma.economyInventoryItem.update({
                where: { id: inventoryItemId },
                data: { status: 'USED', usedAt: new Date() },
            });
        }

        return { ok: true, effect: parsedEffect?.effect ?? null };
    }

    static async listInventory(guildId: string, userId: string): Promise<EconomyInventoryItem[]> {
        return prisma.economyInventoryItem.findMany({
            where: { guildId, userId, status: { in: ['OWNED', 'LISTED'] } },
            include: { shopItem: true },
            orderBy: { createdAt: 'desc' },
        });
    }

    static async listMarket(
        guildId: string,
        opts?: { itemType?: string }
    ): Promise<EconomyMarketListingWithItem[]> {
        const listings = await prisma.economyMarketListing.findMany({
            where: { guildId, status: 'ACTIVE' },
        });
        if (listings.length === 0) return [];

        const inventoryItems = await prisma.economyInventoryItem.findMany({
            where: { id: { in: listings.map((l) => l.inventoryItemId) } },
            include: { shopItem: true },
        });
        const inventoryById = new Map(inventoryItems.map((inv) => [inv.id, inv]));

        const enriched: EconomyMarketListingWithItem[] = listings.map((listing) => ({
            ...listing,
            inventoryItem: inventoryById.get(listing.inventoryItemId) ?? null,
        }));

        if (!opts?.itemType) return enriched;
        return enriched.filter((l) => l.inventoryItem?.shopItem.type === opts.itemType);
    }

    static async listOnMarket(params: {
        guildId: string;
        userId: string;
        inventoryItemId: number;
        price: bigint;
    }): Promise<ListResult> {
        const { guildId, userId, inventoryItemId, price } = params;

        const inventoryItem = await prisma.economyInventoryItem.findFirst({
            where: { id: inventoryItemId, guildId, userId },
            include: { shopItem: true },
        });
        if (!inventoryItem) {
            return { ok: false, reason: 'NOT_FOUND' };
        }
        if (!inventoryItem.shopItem.resellable) {
            return { ok: false, reason: 'NOT_RESELLABLE' };
        }
        if (inventoryItem.status !== 'OWNED') {
            return { ok: false, reason: 'ALREADY_LISTED' };
        }

        let listingId!: number;
        try {
            await prisma.$transaction(async (tx) => {
                const res = await tx.economyInventoryItem.updateMany({
                    where: { id: inventoryItemId, userId, guildId, status: 'OWNED' },
                    data: { status: 'LISTED' },
                });
                if (res.count === 0) {
                    throw new Error('ALREADY_LISTED');
                }

                const listing = await tx.economyMarketListing.create({
                    data: { guildId, inventoryItemId, sellerId: userId, price },
                });
                listingId = listing.id;
            });
        } catch (error) {
            if (error instanceof Error && error.message === 'ALREADY_LISTED') {
                return { ok: false, reason: 'ALREADY_LISTED' };
            }
            throw error;
        }

        return { ok: true, listingId };
    }

    static async buyFromMarket(params: {
        guildId: string;
        buyerId: string;
        listingId: number;
    }): Promise<BuyResult> {
        const { guildId, buyerId, listingId } = params;

        const listing = await prisma.economyMarketListing.findFirst({ where: { id: listingId, guildId } });
        if (!listing) {
            return { ok: false, reason: 'NOT_FOUND' };
        }
        if (listing.status !== 'ACTIVE') {
            return { ok: false, reason: 'ALREADY_SOLD' };
        }
        if (listing.sellerId === buyerId) {
            return { ok: false, reason: 'SELF_PURCHASE' };
        }

        const config = await EconomyService.getConfig(guildId);
        const tax = (listing.price * BigInt(config.marketTaxBps)) / 10000n;
        const sellerProceeds = listing.price - tax;

        const debitResult = await EconomyService.debit({
            guildId,
            userId: buyerId,
            account: 'WALLET',
            amount: listing.price,
            type: 'MARKET_PURCHASE',
            sourceRef: `listing:${listingId}`,
        });
        if (!debitResult.ok) {
            return { ok: false, reason: 'INSUFFICIENT_FUNDS' };
        }

        try {
            await prisma.$transaction(async (tx) => {
                const res = await tx.economyMarketListing.updateMany({
                    where: { id: listingId, status: 'ACTIVE' },
                    data: { status: 'SOLD', buyerId, soldAt: new Date() },
                });
                if (res.count === 0) {
                    throw new Error('ALREADY_SOLD');
                }

                await tx.economyInventoryItem.update({
                    where: { id: listing.inventoryItemId },
                    data: { userId: buyerId, status: 'OWNED' },
                });
            });
        } catch (error) {
            if (error instanceof Error && error.message === 'ALREADY_SOLD') {
                await EconomyService.credit({
                    guildId,
                    userId: buyerId,
                    account: 'WALLET',
                    amount: listing.price,
                    type: 'MARKET_PURCHASE',
                    sourceRef: `listing:${listingId}:refund`,
                });
                return { ok: false, reason: 'ALREADY_SOLD' };
            }
            throw error;
        }

        await EconomyService.credit({
            guildId,
            userId: listing.sellerId,
            account: 'WALLET',
            amount: sellerProceeds,
            type: 'MARKET_SALE',
            sourceRef: `listing:${listingId}`,
        });

        return { ok: true };
    }
}
