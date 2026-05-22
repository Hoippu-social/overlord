import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelType,
    Client,
    EmbedBuilder,
    Guild,
    GuildTextBasedChannel,
    MessageCreateOptions,
    TextChannel,
    ThreadAutoArchiveDuration,
    ThreadChannel,
} from 'discord.js';
import { logAuditEvent } from '../utils/auditLog';
import { prisma } from '../utils/database';
import {
    ensureModerationConfig,
    getCaseByNumber,
    isMissingModerationTableError,
    resolveModerationCase,
} from './ModerationService';
import { getAppealRuntimeSettings } from './AppealRuntimeConfig';

type AppealDecision = 'IN_REVIEW' | 'ACCEPTED' | 'REJECTED' | 'PARDONED';
type AppealTicketMetaRow = {
    threadChannelId?: string | null;
    threadMessageId?: string | null;
};

export type AppealEventRow = {
    id: number;
    ticketId: number;
    eventType: string;
    actorUserId: string | null;
    note: string | null;
    payload: string | null;
    createdAt: Date;
};

export type AppealableCase = {
    id: number;
    caseNumber: number;
    actionType: string;
    reason: string | null;
    createdAt: Date;
    status: string;
};

function isBanLikeAction(actionType: string) {
    return actionType === 'BAN' || actionType === 'TEMPBAN';
}

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

async function ensureAppealTicketMetaColumns() {
    await prisma.$executeRawUnsafe('ALTER TABLE "AppealTicket" ADD COLUMN "threadChannelId" TEXT').catch(() => null);
    await prisma.$executeRawUnsafe('ALTER TABLE "AppealTicket" ADD COLUMN "threadMessageId" TEXT').catch(() => null);
}

async function ensureAppealEventTable() {
    await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "AppealEvent" (
            "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
            "guildId" TEXT NOT NULL,
            "ticketId" INTEGER NOT NULL,
            "eventType" TEXT NOT NULL,
            "actorUserId" TEXT,
            "note" TEXT,
            "payload" TEXT,
            "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    `).catch(() => null);
    await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "AppealEvent_ticketId_createdAt_idx" ON "AppealEvent"("ticketId", "createdAt")').catch(() => null);
    await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "AppealEvent_guildId_createdAt_idx" ON "AppealEvent"("guildId", "createdAt")').catch(() => null);
}

async function readAppealTicketMeta(ticketId: number): Promise<AppealTicketMetaRow> {
    await ensureAppealTicketMetaColumns();
    const rows = await prisma.$queryRawUnsafe<AppealTicketMetaRow[]>(
        'SELECT "threadChannelId", "threadMessageId" FROM "AppealTicket" WHERE "id" = ? LIMIT 1',
        ticketId,
    );

    return rows[0] ?? {};
}

export async function getAppealTicketMeta(ticketId: number): Promise<AppealTicketMetaRow> {
    return readAppealTicketMeta(ticketId);
}

async function writeAppealTicketMeta(ticketId: number, meta: AppealTicketMetaRow) {
    await ensureAppealTicketMetaColumns();
    await prisma.$executeRawUnsafe(
        'UPDATE "AppealTicket" SET "threadChannelId" = ?, "threadMessageId" = ? WHERE "id" = ?',
        meta.threadChannelId ?? null,
        meta.threadMessageId ?? null,
        ticketId,
    );
}

async function appendAppealEvent(options: {
    guildId: string;
    ticketId: number;
    eventType: string;
    actorUserId?: string | null;
    note?: string | null;
    payload?: Record<string, unknown> | null;
}) {
    await ensureAppealEventTable();
    await prisma.$executeRawUnsafe(
        'INSERT INTO "AppealEvent" ("guildId", "ticketId", "eventType", "actorUserId", "note", "payload") VALUES (?, ?, ?, ?, ?, ?)',
        options.guildId,
        options.ticketId,
        options.eventType,
        options.actorUserId ?? null,
        options.note ?? null,
        options.payload ? JSON.stringify(options.payload) : null,
    );
}

export async function listAppealEvents(ticketId: number): Promise<AppealEventRow[]> {
    await ensureAppealEventTable();
    return prisma.$queryRawUnsafe<AppealEventRow[]>(
        'SELECT "id", "ticketId", "eventType", "actorUserId", "note", "payload", "createdAt" FROM "AppealEvent" WHERE "ticketId" = ? ORDER BY "createdAt" ASC, "id" ASC',
        ticketId,
    );
}

function buildAppealTimelineText(events: AppealEventRow[]) {
    if (!events.length) {
        return '\u041e\u0436\u0438\u0434\u0430\u0435\u0442 \u043f\u0435\u0440\u0432\u0438\u0447\u043d\u043e\u0433\u043e \u0440\u0430\u0437\u0431\u043e\u0440\u0430.';
    }

    return events.slice(-4).map((event) => {
        const timestamp = Math.floor(new Date(event.createdAt).getTime() / 1000);
        const actor = event.actorUserId ? ` • <@${event.actorUserId}>` : '';
        return `<t:${timestamp}:R> • ${event.eventType}${actor}`;
    }).join('\n');
}

function isTextChannel(channel: unknown): channel is TextChannel {
    return Boolean(channel && typeof channel === 'object' && 'type' in channel && (channel as { type?: ChannelType }).type === ChannelType.GuildText);
}

function formatAppealThreadName(ticketId: number, caseNumber: number, userLabel: string) {
    const normalizedUser = userLabel
        .toLowerCase()
        .replace(/[^a-z0-9а-яё_-]+/gi, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 40) || 'user';

    return `appeal-${ticketId}-case-${caseNumber}-${normalizedUser}`;
}

function resolveArchiveDuration(hours: number) {
    if (hours >= 24 * 7) return ThreadAutoArchiveDuration.OneWeek;
    if (hours >= 24 * 3) return ThreadAutoArchiveDuration.ThreeDays;
    if (hours >= 24) return ThreadAutoArchiveDuration.OneDay;
    return ThreadAutoArchiveDuration.OneHour;
}

function buildAppealStatusText(status: string) {
    switch (status) {
        case 'OPEN':
            return 'SUBMITTED';
        case 'IN_REVIEW':
            return 'IN_REVIEW';
        case 'ACCEPTED':
            return 'APPROVED';
        case 'PARDONED':
            return 'APPROVED';
        case 'REJECTED':
            return 'REJECTED';
        default:
            return status;
    }
}

function buildAppealThreadActionRows(ticketId: number, status: string) {
    if (!['OPEN', 'IN_REVIEW'].includes(status)) {
        return [];
    }

    return [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId(`appeal_staff_in_review:${ticketId}`)
                .setLabel('В работу')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(status === 'IN_REVIEW'),
            new ButtonBuilder()
                .setCustomId(`appeal_staff_accept:${ticketId}`)
                .setLabel('Одобрить')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId(`appeal_staff_reject:${ticketId}`)
                .setLabel('Отклонить')
                .setStyle(ButtonStyle.Danger),
        ),
    ];
}

function buildAppealEmbed(options: {
    ticketId: number;
    caseNumber: number;
    userId: string;
    message: string;
    actionType: string;
    caseReason: string | null | undefined;
    status: string;
    createdAt?: Date | null;
    resolutionNote?: string | null;
    reviewerId?: string | null;
    timelineText?: string;
    settingsTitle: string;
    settingsIntro: string;
    settingsFooter: string;
}) {
    const embed = new EmbedBuilder()
        .setColor(options.status === 'REJECTED' ? 0xef4444 : options.status === 'ACCEPTED' || options.status === 'PARDONED' ? 0x22c55e : 0x60a5fa)
        .setTitle(
            options.settingsTitle
                .replace('{appealId}', String(options.ticketId))
                .replace('{caseNumber}', String(options.caseNumber))
        )
        .setDescription(options.settingsIntro)
        .addFields(
            {
                name: '\u0421\u0442\u0430\u0442\u0443\u0441',
                value: buildAppealStatusText(options.status),
                inline: true,
            },
            {
                name: '\u041f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044c',
                value: `<@${options.userId}>`,
                inline: true,
            },
            {
                name: '\u041a\u0435\u0439\u0441',
                value: `#${options.caseNumber}`,
                inline: true,
            },
            {
                name: '\u041e\u0440\u0438\u0433\u0438\u043d\u0430\u043b\u044c\u043d\u043e\u0435 \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0435',
                value: options.actionType,
                inline: true,
            },
            {
                name: '\u041f\u0440\u0438\u0447\u0438\u043d\u0430 \u043d\u0430\u043a\u0430\u0437\u0430\u043d\u0438\u044f',
                value: options.caseReason?.trim() || '\u041d\u0435 \u0443\u043a\u0430\u0437\u0430\u043d\u0430',
                inline: true,
            },
            {
                name: '\u041f\u043e\u0434\u0430\u043d\u043e',
                value: options.createdAt ? `<t:${Math.floor(options.createdAt.getTime() / 1000)}:F>` : '\u041d\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043d\u043e',
                inline: true,
            },
            {
                name: '\u041f\u043e\u0437\u0438\u0446\u0438\u044f \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044f',
                value: options.message.length > 1024 ? `${options.message.slice(0, 1021)}...` : options.message,
            },
        )
        .setFooter({ text: options.settingsFooter });

    if (options.reviewerId) {
        embed.addFields({
            name: '\u041e\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0435\u043d\u043d\u044b\u0439',
            value: `<@${options.reviewerId}>`,
            inline: true,
        });
    }

    if (options.resolutionNote?.trim()) {
        embed.addFields({
            name: '\u0420\u0435\u0448\u0435\u043d\u0438\u0435 / \u0437\u0430\u043c\u0435\u0442\u043a\u0430',
            value: options.resolutionNote.slice(0, 1024),
        });
    }

    if (options.timelineText?.trim()) {
        embed.addFields({
            name: '\u0422\u0430\u0439\u043c\u043b\u0430\u0439\u043d',
            value: options.timelineText.slice(0, 1024),
        });
    }

    return embed;
}

async function createAppealThread(options: {
    guild: Guild;
    client: Client;
    ticketId: number;
    caseNumber: number;
    userId: string;
    message: string;
    moderationCase: Awaited<ReturnType<typeof getCaseByNumber>>;
}) {
    const settings = await getAppealRuntimeSettings(options.guild.id);
    const threadChannelId = settings.threadChannelId;
    const parentChannel = threadChannelId
        ? await options.guild.channels.fetch(threadChannelId).catch(() => null)
        : null;

    if (!parentChannel || !isTextChannel(parentChannel)) {
        return null;
    }

    const user = await options.client.users.fetch(options.userId).catch(() => null);
    const thread = await parentChannel.threads.create({
        name: formatAppealThreadName(options.ticketId, options.caseNumber, user?.username ?? options.userId),
        type: ChannelType.PrivateThread,
        autoArchiveDuration: resolveArchiveDuration(settings.autoCloseHours),
        invitable: false,
        reason: `Appeal ticket #${options.ticketId} for moderation case #${options.caseNumber}`,
    });

    const member = await options.guild.members.fetch(options.userId).catch(() => null);
    if (member) {
        await thread.members.add(member.id).catch(() => null);
    }

    const mentionLine = settings.mentionRoleIds.length
        ? settings.mentionRoleIds.map((roleId) => `<@&${roleId}>`).join(' ')
        : settings.reviewerRoleIds.length
            ? settings.reviewerRoleIds.map((roleId) => `<@&${roleId}>`).join(' ')
            : '';
    const timelineText = buildAppealTimelineText(await listAppealEvents(options.ticketId));

    const message = await thread.send({
        content: mentionLine || undefined,
        embeds: [
            buildAppealEmbed({
                ticketId: options.ticketId,
                caseNumber: options.caseNumber,
                userId: options.userId,
                message: options.message,
                actionType: options.moderationCase?.actionType ?? 'UNKNOWN',
                caseReason: options.moderationCase?.reason,
                status: 'OPEN',
                createdAt: new Date(),
                timelineText,
                settingsTitle: settings.firstEmbed.title,
                settingsIntro: settings.firstEmbed.intro,
                settingsFooter: settings.firstEmbed.footer,
            }),
        ],
        components: buildAppealThreadActionRows(options.ticketId, 'OPEN'),
    });

    await message.pin().catch(() => null);
    await writeAppealTicketMeta(options.ticketId, {
        threadChannelId: thread.id,
        threadMessageId: message.id,
    });

    return thread;
}

async function syncAppealThread(ticketId: number, guild: Guild, update: {
    caseNumber: number;
    userId: string;
    message: string;
    actionType: string;
    caseReason: string | null | undefined;
    status: string;
    resolutionNote?: string | null;
    reviewerId?: string | null;
    createdAt?: Date | null;
}) {
    const meta = await readAppealTicketMeta(ticketId);
    if (!meta.threadChannelId) {
        return;
    }

    const channel = await guild.channels.fetch(meta.threadChannelId).catch(() => null);
    if (!channel || !('isThread' in channel) || !channel.isThread()) {
        return;
    }

    const thread = channel as ThreadChannel;
    const settings = await getAppealRuntimeSettings(guild.id);
    const timelineText = buildAppealTimelineText(await listAppealEvents(ticketId));
    const embed = buildAppealEmbed({
        ticketId,
        caseNumber: update.caseNumber,
        userId: update.userId,
        message: update.message,
        actionType: update.actionType,
        caseReason: update.caseReason,
        status: update.status,
        resolutionNote: update.resolutionNote,
        reviewerId: update.reviewerId,
        createdAt: update.createdAt,
        timelineText,
        settingsTitle: settings.firstEmbed.title,
        settingsIntro: settings.firstEmbed.intro,
        settingsFooter: settings.firstEmbed.footer,
    });

    if (meta.threadMessageId) {
        const rootMessage = await thread.messages.fetch(meta.threadMessageId).catch(() => null);
        if (rootMessage) {
            await rootMessage.edit({
                embeds: [embed],
                components: buildAppealThreadActionRows(ticketId, update.status),
            }).catch(() => null);
        }
    }

    await thread.send({
        embeds: [
            new EmbedBuilder()
                .setColor(update.status === 'REJECTED' ? 0xef4444 : update.status === 'ACCEPTED' || update.status === 'PARDONED' ? 0x22c55e : 0x60a5fa)
                .setTitle(`Статус апелляции #${ticketId}: ${buildAppealStatusText(update.status)}`)
                .setDescription(
                    update.resolutionNote?.trim()
                        ? update.resolutionNote
                        : update.status === 'IN_REVIEW'
                            ? 'Апелляция взята в работу.'
                            : 'Статус апелляции обновлён.'
                ),
        ],
    }).catch(() => null);
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

async function notifyAppealUserDm(client: Client, userId: string, content: string) {
    const user = await client.users.fetch(userId).catch(() => null);
    if (!user) return;
    await user.send({ content }).catch(() => null);
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
    const settings = await getAppealRuntimeSettings(options.guild.id);
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

    if (settings.allowedActionTypes.length && !settings.allowedActionTypes.includes(moderationCase.actionType)) {
        throw new Error(`Cases with action ${moderationCase.actionType} cannot be appealed on this server.`);
    }

    if (options.appealType !== 'PARDON' && moderationCase.targetUserId !== options.userId) {
        throw new Error('You can only appeal your own moderation cases.');
    }

    if (options.appealType !== 'PARDON') {
        const appealAgeMs = Date.now() - moderationCase.createdAt.getTime();
        const maxAgeMs = settings.appealWindowDays * 24 * 60 * 60 * 1000;
        if (appealAgeMs > maxAgeMs) {
            throw new Error(`This case is older than the ${settings.appealWindowDays}-day appeal window.`);
        }
    }

    if (settings.oneOpenAppealPerCase) {
        const existingOpenTicket = await prisma.appealTicket.findFirst({
            where: {
                guildId: options.guild.id,
                caseId: moderationCase.id,
                appealType: options.appealType ?? 'APPEAL',
                status: { in: ['OPEN', 'IN_REVIEW'] },
            },
            orderBy: { createdAt: 'desc' },
        });

        if (existingOpenTicket) {
            throw new Error(`Appeal ticket #${existingOpenTicket.id} is already open for this case.`);
        }
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

    await appendAppealEvent({
        guildId: options.guild.id,
        ticketId: ticket.id,
        eventType: 'SUBMITTED',
        actorUserId: options.userId,
        note: options.message,
        payload: {
            caseNumber: moderationCase.caseNumber,
            actionType: moderationCase.actionType,
            appealType: ticket.appealType,
        },
    });

    const thread = await createAppealThread({
        guild: options.guild,
        client: options.client,
        ticketId: ticket.id,
        caseNumber: moderationCase.caseNumber,
        userId: options.userId,
        message: options.message,
        moderationCase,
    });

    if (thread) {
        await appendAppealEvent({
            guildId: options.guild.id,
            ticketId: ticket.id,
            eventType: 'THREAD_CREATED',
            actorUserId: options.userId,
            payload: {
                threadId: thread.id,
                threadName: thread.name,
            },
        });

        await syncAppealThread(ticket.id, options.guild, {
            caseNumber: ticket.caseNumber,
            userId: ticket.userId,
            message: ticket.message,
            actionType: moderationCase.actionType,
            caseReason: moderationCase.reason,
            status: ticket.status,
            createdAt: ticket.createdAt,
        });
    }

    await sendToConfiguredChannel(options.client, options.guild.id, config.appealChannelId, {
        content: [
            `New ${ticket.appealType.toLowerCase()} ticket #${ticket.id}`,
            `Case: #${moderationCase.caseNumber} (${moderationCase.actionType})`,
            `User: <@${ticket.userId}>`,
            `Reason: ${ticket.message}`,
            thread ? `Thread: <#${thread.id}>` : null,
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
            threadChannelId: thread?.id ?? null,
        },
        severity: 'INFO',
    });

    if (isBanLikeAction(moderationCase.actionType)) {
        await notifyAppealUserDm(
            options.client,
            ticket.userId,
            [
                `\u0410\u043f\u0435\u043b\u043b\u044f\u0446\u0438\u044f #${ticket.id} \u0441\u043e\u0437\u0434\u0430\u043d\u0430 \u043f\u043e \u043a\u0435\u0439\u0441\u0443 #${moderationCase.caseNumber}.`,
                thread ? `\u041e\u0431\u0440\u0430\u0431\u043e\u0442\u043a\u0430 \u0438\u0434\u0451\u0442 \u0432 server thread: ${thread.name}` : '\u041e\u0431\u0440\u0430\u0449\u0435\u043d\u0438\u0435 \u0441\u043e\u0437\u0434\u0430\u043d\u043e, \u043d\u043e thread \u043d\u0430 \u0441\u0435\u0440\u0432\u0435\u0440\u0435 \u043d\u0435 \u0431\u044b\u043b \u0441\u043e\u0437\u0434\u0430\u043d.',
                '\u041c\u044b \u0431\u0443\u0434\u0435\u043c \u0437\u0435\u0440\u043a\u0430\u043b\u0438\u0442\u044c \u0437\u0434\u0435\u0441\u044c \u0441\u0442\u0430\u0442\u0443\u0441\u044b \u0438 \u0444\u0438\u043d\u0430\u043b\u044c\u043d\u043e\u0435 \u0440\u0435\u0448\u0435\u043d\u0438\u0435.',
            ].join('\n'),
        );
    }

    return ticket;
}

export async function listAppealableCases(guildId: string, userId: string, limit = 25): Promise<AppealableCase[]> {
    const settings = await getAppealRuntimeSettings(guildId);
    const since = new Date(Date.now() - settings.appealWindowDays * 24 * 60 * 60 * 1000);

    const cases = await prisma.moderationCase.findMany({
        where: {
            guildId,
            targetUserId: userId,
            status: 'ACTIVE',
            createdAt: { gte: since },
            ...(settings.allowedActionTypes.length
                ? { actionType: { in: settings.allowedActionTypes } }
                : {}),
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: Math.max(1, Math.min(limit, 25)),
        select: {
            id: true,
            caseNumber: true,
            actionType: true,
            reason: true,
            createdAt: true,
            status: true,
        },
    });

    if (!settings.oneOpenAppealPerCase || cases.length === 0) {
        return cases;
    }

    const openCaseIds = new Set(
        (await prisma.appealTicket.findMany({
            where: {
                guildId,
                caseId: { in: cases.map((entry) => entry.id) },
                status: { in: ['OPEN', 'IN_REVIEW'] },
            },
            select: { caseId: true },
        })).map((entry) => entry.caseId),
    );

    return cases.filter((entry) => !openCaseIds.has(entry.id));
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

    await appendAppealEvent({
        guildId: options.guild.id,
        ticketId: updated.id,
        eventType: updated.status,
        actorUserId: options.reviewerId,
        note: options.note ?? null,
        payload: {
            decision: updated.status,
            reversalCaseNumber,
            reviewerId: options.reviewerId,
        },
    });

    await syncAppealThread(updated.id, options.guild, {
        caseNumber: updated.caseNumber,
        userId: updated.userId,
        message: updated.message,
        actionType: updated.moderationCase.actionType,
        caseReason: updated.moderationCase.reason,
        status: updated.status,
        resolutionNote: updated.resolutionNote,
        reviewerId: updated.reviewerId,
        createdAt: updated.createdAt,
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

    if (isBanLikeAction(updated.moderationCase.actionType)) {
        await notifyAppealUserDm(
            options.client,
            updated.userId,
            [
                `\u0421\u0442\u0430\u0442\u0443\u0441 \u0430\u043f\u0435\u043b\u043b\u044f\u0446\u0438\u0438 #${updated.id}: ${updated.status}.`,
                options.note?.trim() ? `\u0417\u0430\u043c\u0435\u0442\u043a\u0430: ${options.note.trim()}` : null,
                reversalCaseNumber ? '\u0418\u0441\u0445\u043e\u0434\u043d\u043e\u0435 \u043d\u0430\u043a\u0430\u0437\u0430\u043d\u0438\u0435 \u043e\u0442\u043a\u0430\u0447\u0435\u043d\u043e.' : null,
            ].filter(Boolean).join('\n'),
        );
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

