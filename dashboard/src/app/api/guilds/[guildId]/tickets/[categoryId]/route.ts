import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorizeGuildApiRequest, isGuildApiAuthFailure } from '@/lib/guildApiAuth';

export async function GET(request: NextRequest, { params }: { params: Promise<{ guildId: string, categoryId: string }> }) {
    try {
        const { guildId, categoryId } = await params;
        const auth = await authorizeGuildApiRequest(request, guildId);
        if (isGuildApiAuthFailure(auth)) {
            return auth.response;
        }

        // @ts-ignore
        const category = await prisma.ticketCategory.findUnique({
            where: { id: parseInt(categoryId) },
            include: { forms: true, items: true }
        });

        if (!category || category.guildId !== guildId) {
            return NextResponse.json({ error: 'Category not found' }, { status: 404 });
        }

        return NextResponse.json({ category });
    } catch (error: any) {
        return NextResponse.json({ error: error?.message || 'Failed to load category' }, { status: 500 });
    }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ guildId: string, categoryId: string }> }) {
    try {
        const { guildId, categoryId } = await params;
        const auth = await authorizeGuildApiRequest(request, guildId, { live: true });
        if (isGuildApiAuthFailure(auth)) {
            return auth.response;
        }

        const body = await request.json();
        const id = parseInt(categoryId);

        // Update basic fields
        // @ts-ignore
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
                // @ts-ignore
                prisma.ticketFormQuestion.deleteMany({ where: { categoryId: id } }),
                // @ts-ignore
                prisma.ticketFormQuestion.createMany({
                    data: body.forms.map((f: any, index: number) => ({
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
                // @ts-ignore
                prisma.ticketItem.deleteMany({ where: { categoryId: id } }),
                // @ts-ignore
                prisma.ticketItem.createMany({
                    data: body.items.map((i: any) => ({
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
    } catch (error: any) {
        return NextResponse.json({ error: error?.message || 'Failed to update category' }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ guildId: string, categoryId: string }> }) {
    try {
        const { guildId, categoryId } = await params;
        const auth = await authorizeGuildApiRequest(request, guildId, { live: true });
        if (isGuildApiAuthFailure(auth)) {
            return auth.response;
        }

        const id = parseInt(categoryId);

        // @ts-ignore
        await prisma.ticketCategory.delete({
            where: { id }
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error?.message || 'Failed to delete category' }, { status: 500 });
    }
}
