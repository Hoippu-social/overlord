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
    messageDesignJson?: string | null;
    buttonText: string;
    buttonEmoji: string | null;
    buttonStyle: string;
    closeAction?: string;
    autoDeleteHours?: number | null;
    nameTemplate?: string;
    assignedRoleId?: string | null;
    assignedTemplateId?: number | null;
    defaultPriorityId?: number | null;
    routingNotifyRoleIds?: string[] | string | null;
    forms?: TicketFormInput[];
    items?: TicketItemInput[];
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
                    messageDesignJson: null,
                    buttonText: appealSettings.sharedPlacement.label,
                    buttonEmoji: appealSettings.sharedPlacement.emoji,
                    buttonStyle: 'PRIMARY',
                    closeAction: 'ARCHIVE',
                    autoDeleteHours: null,
                    nameTemplate: 'ticket-{number}',
                    forms: [],
                    items: [],
                    systemManagedBy: 'appeals',
                    systemCategoryKind: 'punishment_appeal',
                },
            });
        }

        const category = await prisma.ticketCategory.findUnique({
            where: { id: parseInt(categoryId) },
            include: { forms: { orderBy: { order: 'asc' } }, items: true, routingRule: true }
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
        if (!Number.isInteger(id)) {
            return NextResponse.json({ error: 'Category not found' }, { status: 404 });
        }

        if (body.forms && body.forms.length > 5) {
            return NextResponse.json({ error: 'A category can have at most 5 form questions (Discord modal limit).' }, { status: 400 });
        }

        const categoryData = {
            name: body.name,
            channelId: body.channelId,
            saveHistory: body.saveHistory,
            mentionAgents: body.mentionAgents,
            allowUserClose: body.allowUserClose,
            splitLogs: body.splitLogs,
            enableRating: body.enableRating,
            agentRoles: body.agentRoles,
            messageText: body.messageText,
            messageEmbeds: body.messageEmbeds,
            messageDesignJson: body.messageDesignJson ?? null,
            buttonText: body.buttonText,
            buttonEmoji: body.buttonEmoji,
            buttonStyle: body.buttonStyle,
            ...(body.closeAction !== undefined && { closeAction: body.closeAction }),
            ...(body.autoDeleteHours !== undefined && { autoDeleteHours: body.autoDeleteHours }),
            ...(body.nameTemplate !== undefined && { nameTemplate: body.nameTemplate }),
            ...(body.assignedRoleId !== undefined && { assignedRoleId: body.assignedRoleId }),
            ...(body.assignedTemplateId !== undefined && { assignedTemplateId: body.assignedTemplateId }),
            ...(body.defaultPriorityId !== undefined && { defaultPriorityId: body.defaultPriorityId }),
        };
        const categoryUpdate = await prisma.ticketCategory.updateMany({
            where: { id, guildId },
            data: categoryData,
        });
        if (categoryUpdate.count === 0) {
            return NextResponse.json({ error: 'Category not found' }, { status: 404 });
        }

        if (Array.isArray(body.forms)) {
            await prisma.ticketFormQuestion.deleteMany({ where: { categoryId: id } });
            await Promise.all(body.forms.map((f, index) =>
                prisma.ticketFormQuestion.create({
                    data: { categoryId: id, label: f.label, type: f.type, required: f.required, placeholder: f.placeholder ?? undefined, order: index }
                })
            ));
        }

        if (Array.isArray(body.items)) {
            await prisma.ticketItem.deleteMany({ where: { categoryId: id } });
            await Promise.all(body.items.map((item) =>
                prisma.ticketItem.create({
                    data: { categoryId: id, type: item.type, label: item.label, description: item.description ?? undefined, emoji: item.emoji ?? undefined, replyContent: item.replyContent ?? undefined, agentRoles: item.agentRoles ?? undefined, requiredRoles: item.requiredRoles ?? undefined }
                })
            ));
        }

        if (
            body.assignedRoleId !== undefined
            || body.assignedTemplateId !== undefined
            || body.defaultPriorityId !== undefined
            || body.routingNotifyRoleIds !== undefined
        ) {
            await prisma.ticketCategoryRoutingRule.upsert({
                where: { categoryId: id },
                update: {
                    assignedRoleId: body.assignedRoleId ?? null,
                    assignedTemplateId: body.assignedTemplateId ?? null,
                    defaultPriorityId: body.defaultPriorityId ?? null,
                    notifyRoleIds: normalizeJsonArray(body.routingNotifyRoleIds),
                },
                create: {
                    guildId,
                    categoryId: id,
                    assignedRoleId: body.assignedRoleId ?? null,
                    assignedTemplateId: body.assignedTemplateId ?? null,
                    defaultPriorityId: body.defaultPriorityId ?? null,
                    notifyRoleIds: normalizeJsonArray(body.routingNotifyRoleIds),
                },
            });
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

        const category = await prisma.ticketCategory.findUnique({ where: { id } });
        if (!category || category.guildId !== guildId) {
            return NextResponse.json({ error: 'Category not found' }, { status: 404 });
        }

        await prisma.ticketCategory.delete({ where: { id } });

        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        return NextResponse.json({ error: getErrorMessage(error, 'Failed to delete category') }, { status: 500 });
    }
}
