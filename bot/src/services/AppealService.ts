import { Client, Guild, GuildTextBasedChannel, MessageCreateOptions } from 'discord.js';
import { logAuditEvent } from '../utils/auditLog';
import { prisma } from '../utils/database';
import {
    ensureModerationConfig,
    getCaseByNumber,
    isMissingModerationTableError,
    resolveModerationCase,
} from './ModerationService';

type AppealDecision = 'IN_REVIEW' | 'ACCEPTED' | 'REJECTED' | 'PARDONED';

function getReversalAuditEvent(actionType: string) {
    switch (actionType) {
        case 'TIMEOUT':
            return 'untimeout';
        case 'MUTE':
            return 'unmute';
        case 'BAN':
        case 'TEMPBAN':
            return 'unban';
        default:
            return 'unwarn';
    }
}

function formatReviewerLabel(value: string) {
    return /^\d{16,20}$/.test(value) ? `<@${value}>` : value;
}

function isTextSendableChannel(channel: unknown): channel is GuildTextBasedChannel & { send: (payload: string | MessageCreateOptions) => Promise<unknown> } {
    return Boolean(channel && typeof channel === 'object' && 'isTextBased' in channel && typeof (channel as { isTextBased?: () => boolean }).isTextBased === 'function' && (channel as { isTextBased: () => boolean }).isTextBased() && 'send' in channel);
}

export async function ensureAppealConfig(guildId: string) {
    return prisma.appealConfig.upsert({
        where: { guildId },
        update: {},
        create: { guildId },
    });
}

async function sendToConfiguredChannel(client: Client, guildId: string, channelId: string | null | undefined, payload: string | MessageCreateOptions) {
    if (!channelId) return;
    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel || !isTextSendableChannel(channel)) return;
    await channel.send(payload).catch(() => null);
}

export async function createAppealTicket(options: {
    guild: Guild;
    userId: string;
    caseNumber: number;
    message: string;
    client: Client;
    appealType?: 'APPEAL' | 'PARDON';
}) {
    const config = await ensureAppealConfig(options.guild.id);
    if (!config.enabled) {
        throw new Error('Appeals are not enabled for this server.');
    }
    if (options.appealType === 'PARDON' && !config.allowDirectPardon) {
        throw new Error('Direct pardon workflow is disabled for this server.');
    }
    if (options.appealType !== 'PARDON' && !config.allowUserAppeals) {
        throw new Error('User appeals are disabled for this server.');
    }

    const moderationCase = await getCaseByNumber(options.guild.id, options.caseNumber);
    if (!moderationCase) {
        throw new Error('Moderation case not found.');
    }

    if (options.appealType !== 'PARDON' && moderationCase.targetUserId !== options.userId) {
        throw new Error('You can only appeal your own moderation cases.');
    }

    const ticket = await prisma.appealTicket.create({
        data: {
            guildId: options.guild.id,
            caseId: moderationCase.id,
            caseNumber: moderationCase.caseNumber,
            userId: options.userId,
            appealType: options.appealType ?? 'APPEAL',
            message: options.message,
        },
    });

    await sendToConfiguredChannel(options.client, options.guild.id, config.appealChannelId, {
        content: [
            `New ${ticket.appealType.toLowerCase()} ticket #${ticket.id}`,
            `Case: #${moderationCase.caseNumber} (${moderationCase.actionType})`,
            `User: <@${ticket.userId}>`,
            `Reason: ${ticket.message}`,
        ].join('\n'),
    });

    await logAuditEvent(options.client, {
        guildId: options.guild.id,
        tag: 'appeals',
        actorId: options.userId,
        targetId: moderationCase.targetUserId,
        payload: {
            event: ticket.appealType === 'PARDON' ? 'pardon_ticket_create' : 'appeal_ticket_create',
            ticketId: ticket.id,
            caseNumber: moderationCase.caseNumber,
            reason: ticket.message,
        },
        severity: 'INFO',
    });

    return ticket;
}

async function reverseCase(guild: Guild, moderationCase: Awaited<ReturnType<typeof getCaseByNumber>>, reviewerId: string, note: string | null | undefined, source: 'appeal_review' | 'pardon') {
    if (!moderationCase) {
        throw new Error('Moderation case not found.');
    }
    if (moderationCase.status !== 'ACTIVE') {
        throw new Error(`Case #${moderationCase.caseNumber} is already ${moderationCase.status.toLowerCase()}.`);
    }

    const reason = note ?? `${source === 'pardon' ? 'Pardon' : 'Appeal accepted'} for case #${moderationCase.caseNumber}`;

    switch (moderationCase.actionType) {
        case 'WARN': {
            return resolveModerationCase({
                moderationCase,
                nextStatus: 'CLEARED',
                resolutionType: source,
                actorUserId: reviewerId,
                reason,
            });
        }
        case 'TIMEOUT': {
            const member = await guild.members.fetch(moderationCase.targetUserId).catch(() => null);
            if (!member) throw new Error('Target member is no longer in the server.');
            await member.timeout(null, reason);
            return resolveModerationCase({
                moderationCase,
                nextStatus: 'CLEARED',
                resolutionType: source,
                actorUserId: reviewerId,
                reason,
            });
        }
        case 'MUTE': {
            const member = await guild.members.fetch(moderationCase.targetUserId).catch(() => null);
            if (!member) throw new Error('Target member is no longer in the server.');
            const config = await ensureModerationConfig(guild.id);
            if (!config.config.muteRoleId) throw new Error('Mute role is not configured.');
            const muteRole = guild.roles.cache.get(config.config.muteRoleId);
            if (!muteRole) throw new Error('Configured mute role does not exist.');
            await member.roles.remove(muteRole, reason);
            return resolveModerationCase({
                moderationCase,
                nextStatus: 'CLEARED',
                resolutionType: source,
                actorUserId: reviewerId,
                reason,
            });
        }
        case 'BAN':
        case 'TEMPBAN': {
            await guild.bans.remove(moderationCase.targetUserId, reason);
            return resolveModerationCase({
                moderationCase,
                nextStatus: 'CLEARED',
                resolutionType: source,
                actorUserId: reviewerId,
                reason,
            });
        }
        default:
            throw new Error(`Case action ${moderationCase.actionType} is not reversible through appeals yet.`);
    }
}

export async function reviewAppealTicket(options: {
    guild: Guild;
    ticketId: number;
    reviewerId: string;
    decision: AppealDecision;
    note?: string | null;
    client: Client;
}) {
    const ticket = await prisma.appealTicket.findUnique({
        where: { id: options.ticketId },
        include: { moderationCase: true },
    });

    if (!ticket || ticket.guildId !== options.guild.id) {
        throw new Error('Appeal ticket not found.');
    }
    if (!['OPEN', 'IN_REVIEW'].includes(ticket.status)) {
        throw new Error(`Appeal ticket is already resolved as ${ticket.status}.`);
    }

    let reversalCaseNumber: number | null = null;
    if (options.decision === 'ACCEPTED' || options.decision === 'PARDONED') {
        const reversal = await reverseCase(
            options.guild,
            await getCaseByNumber(options.guild.id, ticket.caseNumber),
            options.reviewerId,
            options.note,
            options.decision === 'PARDONED' ? 'pardon' : 'appeal_review'
        );
        reversalCaseNumber = reversal.caseNumber;
    }

    const updated = await prisma.appealTicket.update({
        where: { id: ticket.id },
        data: {
            status: options.decision,
            resolutionNote: options.note ?? null,
            reviewerId: options.reviewerId,
            reviewedAt: ['ACCEPTED', 'REJECTED', 'PARDONED'].includes(options.decision) ? new Date() : ticket.reviewedAt,
        },
        include: { moderationCase: true },
    });

    const config = await ensureAppealConfig(options.guild.id);
    const logChannelId = config.pardonLogChannelId ?? config.appealChannelId;
    await sendToConfiguredChannel(options.client, options.guild.id, logChannelId, {
        content: [
            `Appeal ticket #${updated.id} -> ${updated.status}`,
            `Case: #${updated.caseNumber} (${updated.moderationCase.actionType})`,
            `User: <@${updated.userId}>`,
            `Reviewer: ${formatReviewerLabel(options.reviewerId)}`,
            options.note ? `Note: ${options.note}` : null,
            reversalCaseNumber ? `Resolved case: #${reversalCaseNumber}` : null,
        ].filter(Boolean).join('\n'),
    });

    await logAuditEvent(options.client, {
        guildId: options.guild.id,
        tag: 'appeals',
        actorId: options.reviewerId,
        targetId: updated.userId,
        payload: {
            event: updated.appealType === 'PARDON' ? 'pardon_review' : 'appeal_review',
            ticketId: updated.id,
            caseNumber: updated.caseNumber,
            decision: updated.status,
            reason: options.note,
            reversalCaseNumber,
        },
        severity: options.decision === 'REJECTED' ? 'INFO' : 'WARN',
    });

    if (reversalCaseNumber) {
        await logAuditEvent(options.client, {
            guildId: options.guild.id,
            tag: 'moderation',
            actorId: options.reviewerId,
            targetId: updated.userId,
            payload: {
                event: getReversalAuditEvent(updated.moderationCase.actionType),
                caseNumber: updated.caseNumber,
                reason: options.note ?? `${updated.appealType === 'PARDON' ? 'Pardon approved' : 'Appeal accepted'} for case #${updated.caseNumber}`,
            },
            severity: 'INFO',
        });
    }

    return updated;
}

export async function listAppealTickets(guildId: string, options?: { status?: string | null; userId?: string | null; limit?: number }) {
    return prisma.appealTicket.findMany({
        where: {
            guildId,
            ...(options?.status ? { status: options.status } : {}),
            ...(options?.userId ? { userId: options.userId } : {}),
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: options?.limit ?? 25,
        include: {
            moderationCase: {
                select: {
                    id: true,
                    caseNumber: true,
                    actionType: true,
                    status: true,
                    targetUserId: true,
                },
            },
        },
    });
}

export async function safeEnsureAppealConfig(guildId: string) {
    try {
        return await ensureAppealConfig(guildId);
    } catch (error) {
        if (isMissingModerationTableError(error)) return null;
        throw error;
    }
}
