import {
    ChannelType,
    Client,
    MessageCreateOptions,
    MessageEditOptions,
    TextChannel,
} from 'discord.js';
import { prisma } from '../utils/database';
import logger from '../utils/logger';
import { buildTicketPanelPayload } from './TicketPanelMessageDesign';
import type { TicketPanelItem } from './TicketPanelMessageDesign';

function isTextChannel(channel: unknown): channel is TextChannel {
    return (
        channel !== null &&
        typeof channel === 'object' &&
        'type' in channel &&
        (channel as { type?: ChannelType }).type === ChannelType.GuildText
    );
}

type Category = {
    id: number;
    guildId: string;
    name: string;
    channelId: string | null;
    panelMessageId: string | null;
    messageDesignJson?: string | null;
    messageText: string | null;
    messageEmbeds: string | null;
    buttonText: string;
    buttonEmoji: string | null;
    buttonStyle: string;
    items?: TicketPanelItem[];
};

function panelPayloadForEdit(payload: MessageCreateOptions): MessageEditOptions {
    if (payload.flags) {
        return {
            content: null,
            embeds: [],
            components: payload.components,
            flags: payload.flags,
        } as MessageEditOptions;
    }

    return {
        content: typeof payload.content === 'string' ? payload.content : null,
        embeds: payload.embeds ?? [],
        components: payload.components,
    } as MessageEditOptions;
}

async function syncCategoryPanel(
    client: Client,
    category: Category,
): Promise<{ categoryId: number; state: 'created' | 'updated' | 'cleared' | 'skipped' | 'error'; error?: string }> {
    if (!category.channelId) {
        return { categoryId: category.id, state: 'skipped' };
    }

    const guild = client.guilds.cache.get(category.guildId) ?? await client.guilds.fetch(category.guildId).catch(() => null);
    if (!guild) {
        return { categoryId: category.id, state: 'error', error: 'Guild not found' };
    }

    const channel = await guild.channels.fetch(category.channelId).catch(() => null);
    if (!channel || !isTextChannel(channel)) {
        await prisma.ticketCategory.update({ where: { id: category.id }, data: { panelMessageId: null } });
        return { categoryId: category.id, state: 'error', error: 'Panel channel not found or is not a text channel' };
    }

    const payload = buildTicketPanelPayload(category);

    if (category.panelMessageId) {
        const existing = await channel.messages.fetch(category.panelMessageId).catch(() => null);
        if (existing && existing.author.id === client.user?.id) {
            await existing.edit(panelPayloadForEdit(payload));
            return { categoryId: category.id, state: 'updated' };
        }
    }

    const sent = await channel.send(payload);
    await prisma.ticketCategory.update({
        where: { id: category.id },
        data: { panelMessageId: sent.id },
    });

    return { categoryId: category.id, state: 'created' };
}

export async function syncTicketPanel(
    client: Client,
    guildId: string,
    categoryId: number,
): Promise<{ categoryId: number; state: 'created' | 'updated' | 'cleared' | 'skipped' | 'error'; error?: string }> {
    const category = await prisma.ticketCategory.findFirst({ where: { id: categoryId, guildId }, include: { items: true } }) as unknown as Category | null;
    if (!category) {
        return { categoryId, state: 'error', error: 'Category not found' };
    }
    return syncCategoryPanel(client, category);
}

export async function sendTicketPanelPreview(
    client: Client,
    guildId: string,
    categoryId: number,
    overrideDesign: unknown,
    channelId?: string | null,
    ttlMs = 60_000,
): Promise<{ categoryId: number; messageId: string; channelId: string }> {
    const category = await prisma.ticketCategory.findFirst({ where: { id: categoryId, guildId }, include: { items: true } }) as unknown as Category | null;
    if (!category) {
        throw new Error('Category not found');
    }

    const targetChannelId = channelId || category.channelId;
    if (!targetChannelId) {
        throw new Error('Panel channel is not configured');
    }

    const guild = client.guilds.cache.get(guildId) ?? await client.guilds.fetch(guildId).catch(() => null);
    if (!guild) {
        throw new Error('Guild not found');
    }

    const channel = await guild.channels.fetch(targetChannelId).catch(() => null);
    if (!channel || !isTextChannel(channel)) {
        throw new Error('Preview channel not found or is not a text channel');
    }

    const payload = buildTicketPanelPayload(category, overrideDesign);
    const sent = await channel.send(payload);
    const timeout = setTimeout(() => {
        sent.delete().catch(() => undefined);
    }, ttlMs);
    timeout.unref?.();

    return { categoryId: category.id, messageId: sent.id, channelId: channel.id };
}

export async function syncAllTicketPanels(client: Client, guildId?: string): Promise<void> {
    const where = guildId ? { guildId } : {};
    const configs = await prisma.ticketConfig.findMany({
        where: { enabled: true, ...(guildId ? { guildId } : {}) },
        select: { guildId: true },
    });

    const enabledGuildIds = new Set(configs.map((c) => c.guildId));
    const categories = await prisma.ticketCategory.findMany({
        where: {
            ...where,
            channelId: { not: null },
        },
        include: { items: true },
    }) as unknown as Category[];

    for (const category of categories) {
        if (!enabledGuildIds.has(category.guildId)) continue;
        try {
            await syncCategoryPanel(client, category);
        } catch (error) {
            logger.warn(`[TicketPanelService] Failed to sync panel for category ${category.id}:`, error);
        }
    }
}
