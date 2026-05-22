import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorizeGuildApiRequest, isGuildApiAuthFailure } from '@/lib/guildApiAuth';
import { readAppealSettings } from '@/lib/appealsConfig';

type TicketFormInput = {
    label: string;
    type: string;
    required: boolean;
    placeholder: string | null;
};

type TicketItemInput = {
    type: string;
    label: string;
    description: string | null;
    emoji: string | null;
    replyContent: string | null;
    agentRoles: string | null;
    requiredRoles: string | null;
};

type TicketCategoryUpdateBody = {
    name: string;
    channelId: string | null;
    saveHistory: boolean;
    mentionAgents: boolean;
    allowUserClose: boolean;
    splitLogs: boolean;
    enableRating: boolean;
    agentRoles: string;
    messageText: string | null;
    messageEmbeds: string;
    buttonText: string;
    buttonEmoji: string | null;
    buttonStyle: string;
    forms?: TicketFormInput[];
    items?: TicketItemInput[];
};

function getErrorMessage(error: unknown, fallback: string) {
    return error instanceof Error ? error.message : fallback;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ guildId: string, categoryId: string }> }) {
    try {
        const { guildId, categoryId } = await params;
        const auth = await authorizeGuildApiRequest(request, guildId);
        if (isGuildApiAuthFailure(auth)) {
            return auth.response;
        }

        if (categoryId === '-1') {
            const appealSettings = await readAppealSettings(guildId);
            if (!appealSettings.sharedPlacement.enabled) {
                return NextResponse.json({ error: 'Category not found' }, { status: 404 });
            }

            return NextResponse.json({
                category: {
                    id: -1,
                    guildId,
                    name: appealSettings.sharedPlacement.label,
                    channelId: appealSettings.sharedPlacement.channelId || null,
                    saveHistory: true,
                    mentionAgents: false,
                    allowUserClose: false,
                    splitLogs: false,
                    enableRating: false,
                    agentRoles: JSON.stringify([]),
                    messageText: appealSettings.sharedPlacement.description,
                    messageEmbeds: JSON.stringify([]),
                    buttonText: appealSettings.sharedPlacement.label,
                    buttonEmoji: appealSettings.sharedPlacement.emoji,
                    buttonStyle: 'PRIMARY',
                    forms: [],
                    items: [],
                    systemManagedBy: 'appeals',
                    systemCategoryKind: 'punishment_appeal',
                },
            });
        }

        // @ts-expect-error Legacy Prisma client in this workspace is behind the live DB schema.
        const category = await prisma.ticketCategory.findUnique({
            where: { id: parseInt(categoryId) },
            include: { forms: true, items: true }
        });

        if (!category || category.guildId !== guildId) {
            return NextResponse.json({ error: 'Category not found' }, { status: 404 });
        }

        return NextResponse.json({ category });
    } catch (error: unknown) {
        return NextResponse.json({ error: getErrorMessage(error, 'Failed to load category') }, { status: 500 });
    }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ guildId: string, categoryId: string }> }) {
    try {
        const { guildId, categoryId } = await params;
        const auth = await authorizeGuildApiRequest(request, guildId, { live: true });
        if (isGuildApiAuthFailure(auth)) {
            return auth.response;
        }

        if (categoryId === '-1') {
            return NextResponse.json(
                { error: 'System appeal category is managed from Moderation -> Appeals.' },
                { status: 409 },
            );
        }

        const body = await request.json() as TicketCategoryUpdateBody;
        const id = parseInt(categoryId);

        // Update basic fields
        // @ts-expect-error Legacy Prisma client in this workspace is behind the live DB schema.
        await prisma.ticketCategory.update({
            where: { id },
            data: {
                name: body.name,
                channelId: body.channelId,
                saveHistory: body.saveHistory,
                mentionAgents: body.mentionAgents,
                allowUserClose: body.allowUserClose,
                splitLogs: body.splitLogs,
                enableRating: body.enableRating,
                agentRoles: body.agentRoles, // JSON string
                messageText: body.messageText,
                messageEmbeds: body.messageEmbeds, // JSON string
                buttonText: body.buttonText,
                buttonEmoji: body.buttonEmoji,
                buttonStyle: body.buttonStyle,
            }
        });

        // Update Forms
        if (Array.isArray(body.forms)) {
            // Transactional update: delete all and recreate? Or smart update?
            // For simplicity, delete and recreate is safer for order handling
            await prisma.$transaction([
                // @ts-expect-error Legacy Prisma client in this workspace is behind the live DB schema.
                prisma.ticketFormQuestion.deleteMany({ where: { categoryId: id } }),
                // @ts-expect-error Legacy Prisma client in this workspace is behind the live DB schema.
                prisma.ticketFormQuestion.createMany({
                    data: body.forms.map((f, index: number) => ({
                        categoryId: id,
                        label: f.label,
                        type: f.type,
                        required: f.required,
                        placeholder: f.placeholder,
                        order: index
                    }))
                })
            ]);
        }

        // Update Items (Quick Replies / Departments)
        if (Array.isArray(body.items)) {
            await prisma.$transaction([
                // @ts-expect-error Legacy Prisma client in this workspace is behind the live DB schema.
                prisma.ticketItem.deleteMany({ where: { categoryId: id } }),
                // @ts-expect-error Legacy Prisma client in this workspace is behind the live DB schema.
                prisma.ticketItem.createMany({
                    data: body.items.map((i) => ({
                        categoryId: id,
                        type: i.type,
                        label: i.label,
                        description: i.description,
                        emoji: i.emoji,
                        replyContent: i.replyContent,
                        agentRoles: i.agentRoles,
                        requiredRoles: i.requiredRoles
                    }))
                })
            ]);
        }

        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        return NextResponse.json({ error: getErrorMessage(error, 'Failed to update category') }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ guildId: string, categoryId: string }> }) {
    try {
        const { guildId, categoryId } = await params;
        const auth = await authorizeGuildApiRequest(request, guildId, { live: true });
        if (isGuildApiAuthFailure(auth)) {
            return auth.response;
        }

        if (categoryId === '-1') {
            return NextResponse.json(
                { error: 'System appeal category is managed from Moderation -> Appeals.' },
                { status: 409 },
            );
        }

        const id = parseInt(categoryId);

        // @ts-expect-error Legacy Prisma client in this workspace is behind the live DB schema.
        await prisma.ticketCategory.delete({
            where: { id }
        });

        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        return NextResponse.json({ error: getErrorMessage(error, 'Failed to delete category') }, { status: 500 });
    }
}
