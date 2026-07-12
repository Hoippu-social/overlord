import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonInteraction,
    ButtonStyle,
    Client,
    EmbedBuilder,
    GuildMember,
    Interaction,
    LabelBuilder,
    ModalBuilder,
    ModalSubmitInteraction,
    StringSelectMenuBuilder,
    StringSelectMenuInteraction,
    StringSelectMenuOptionBuilder,
    TextInputBuilder,
    TextInputStyle,
} from 'discord.js';
import { prisma } from '../utils/database';
import logger from '../utils/logger';
import {
    checkCreateAllowed,
    claimTicket,
    closeTicket,
    createTicket,
    findTicketByThread,
    isStaff,
    reopenTicket,
    resumeTicket,
    setTicketOnHold,
    submitRating,
    unclaimTicket,
    type FormAnswer,
} from './TicketService';
import { applyTransferThreadAccess, resolveTransferRequest } from './TicketSaasService';
import { parseEntryItemConfig, parseGhostReply } from './TicketPanelMessageDesign';

// ─── Custom-id helpers ────────────────────────────────────────────────────────

const TK_PREFIXES = new Set([
    'tk_open', 'tk_dept', 'tk_entry', 'tk_ghost', 'tk_modal',
    'tk_close', 'tk_close_confirm', 'tk_close_reason',
    'tk_claim', 'tk_hold', 'tk_hold_confirm',
    'tk_reopen', 'tk_rate',
    'tk_transfer_accept', 'tk_transfer_decline',
]);

export function isTicketInteraction(interaction: Interaction): boolean {
    let id: string | null = null;

    if (interaction.isButton()) id = interaction.customId;
    else if (interaction.isStringSelectMenu()) id = interaction.customId;
    else if (interaction.isModalSubmit()) id = interaction.customId;
    else return false;

    const prefix = id.split(':')[0];
    return TK_PREFIXES.has(prefix);
}

function parseId(customId: string): { action: string; parts: string[] } {
    const [action, ...parts] = customId.split(':');
    return { action, parts };
}

// ─── Permission guard ─────────────────────────────────────────────────────────

async function resolveStaff(member: GuildMember, categoryId: number): Promise<boolean> {
    const category = await prisma.ticketCategory.findUnique({ where: { id: categoryId } });
    if (!category) return false;
    let agentRoles: string[] = [];
    try { agentRoles = category.agentRoles ? JSON.parse(category.agentRoles) : []; } catch { /* noop */ }
    return isStaff(member, agentRoles);
}

// ─── Ephemeral reply helper ────────────────────────────────────────────────────

async function ephemeral(interaction: ButtonInteraction | StringSelectMenuInteraction | ModalSubmitInteraction, content: string): Promise<void> {
    if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content, ephemeral: true }).catch(() => null);
    } else {
        await interaction.reply({ content, ephemeral: true }).catch(() => null);
    }
}

// ─── Open ticket flow ─────────────────────────────────────────────────────────

async function handleOpen(interaction: ButtonInteraction, categoryId: number): Promise<void> {
    if (!interaction.guild || !interaction.member) {
        await ephemeral(interaction, 'This must be used in a server.');
        return;
    }
    const member = interaction.member as GuildMember;

    const allowed = await checkCreateAllowed(interaction.guild.id, member.id, categoryId);
    if (!allowed.ok) {
        const messages: Record<string, string> = {
            disabled: 'Ticket system is currently disabled.',
            blacklisted: 'You are not allowed to create tickets.',
            limitReached: 'You already have an open ticket.',
        };
        const msg = allowed.reason.startsWith('cooldown:')
            ? `Please wait ${allowed.reason.split(':')[1]} seconds before opening another ticket.`
            : (messages[allowed.reason] ?? 'You cannot open a ticket right now.');
        await ephemeral(interaction, msg);
        return;
    }

    const category = await prisma.ticketCategory.findFirst({
        where: { id: categoryId, guildId: interaction.guild.id },
        include: { items: true, forms: { orderBy: { order: 'asc' } } },
    });
    if (!category) {
        await ephemeral(interaction, 'Category not found.');
        return;
    }

    // Check requiredRoles (item-level or category-level)
    const departments = category.items.filter((i) => i.type === 'DEPARTMENT');

    if (departments.length > 0) {
        // Show department select
        const options = departments.map((item) =>
            new StringSelectMenuOptionBuilder()
                .setValue(String(item.id))
                .setLabel(item.label.slice(0, 100))
                .setDescription((item.description ?? '').slice(0, 100) || undefined as never)
                .setEmoji(item.emoji?.trim() ? item.emoji.trim() : undefined as never),
        );

        const select = new StringSelectMenuBuilder()
            .setCustomId(`tk_dept:${categoryId}`)
            .setPlaceholder('Select a department...')
            .addOptions(options);

        await interaction.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor(0x5865f2)
                    .setTitle('Select Department')
                    .setDescription('Choose the department that best fits your issue.'),
            ],
            components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select)],
            ephemeral: true,
        });
        return;
    }

    // No departments — skip straight to modal or create immediately
    if (category.forms.length > 0) {
        await showIntakeModal(interaction, category, null);
    } else {
        await interaction.deferReply({ ephemeral: true });
        await doCreateTicket(interaction, interaction.client, interaction.guild, member.id, categoryId, null, []);
    }
}

async function handleDeptSelect(interaction: StringSelectMenuInteraction, categoryId: number): Promise<void> {
    if (!interaction.guild || !interaction.member) {
        await ephemeral(interaction, 'This must be used in a server.');
        return;
    }
    const member = interaction.member as GuildMember;
    const itemId = parseInt(interaction.values[0]);
    if (isNaN(itemId)) {
        await ephemeral(interaction, 'Invalid selection.');
        return;
    }

    const category = await prisma.ticketCategory.findFirst({
        where: { id: categoryId, guildId: interaction.guild.id },
        include: { items: true, forms: { orderBy: { order: 'asc' } } },
    });
    if (!category) {
        await ephemeral(interaction, 'Category not found.');
        return;
    }

    const item = category.items.find((i) => i.id === itemId);
    if (!item) {
        await ephemeral(interaction, 'Department not found.');
        return;
    }

    // Check requiredRoles on this item
    if (item.requiredRoles) {
        try {
            const required: string[] = JSON.parse(item.requiredRoles);
            if (required.length > 0 && !required.some((id) => member.roles.cache.has(id))) {
                await ephemeral(interaction, 'You do not have the required role to use this department.');
                return;
            }
        } catch { /* noop */ }
    }

    if (category.forms.length > 0) {
        await showIntakeModal(interaction, category, itemId);
    } else {
        await interaction.deferUpdate();
        await doCreateTicket(interaction, interaction.client, interaction.guild, member.id, categoryId, itemId, []);
    }
}

type ModalParent = ButtonInteraction | StringSelectMenuInteraction;

type ModalQuestion = {
    label: string;
    type: string;
    required: boolean;
    placeholder: string | null;
    order: number;
    options?: string[];
};

function configuredQuestions(item: { type: string; replyContent: string | null } | null | undefined, fallback: ModalQuestion[]): ModalQuestion[] {
    const config = item ? parseEntryItemConfig(item) : null;
    if (!config?.fields.length) return fallback;
    return config.fields.map((field, index) => ({
        label: field.label,
        type: field.type === 'paragraph' ? 'PARAGRAPH' : field.type.toUpperCase(),
        required: field.required,
        placeholder: null,
        order: index,
        options: field.type === 'select' ? field.options : undefined,
    }));
}

async function openConfiguredEntry(interaction: ButtonInteraction | StringSelectMenuInteraction, categoryId: number, itemId: number): Promise<void> {
    if (!interaction.guild || !interaction.member) { await ephemeral(interaction, 'This must be used in a server.'); return; }
    const member = interaction.member as GuildMember;
    const allowed = await checkCreateAllowed(interaction.guild.id, member.id, categoryId);
    if (!allowed.ok) {
        const messages: Record<string, string> = { disabled: 'Ticket system is currently disabled.', blacklisted: 'You are not allowed to create tickets.', limitReached: 'You already have an open ticket.' };
        const message = allowed.reason.startsWith('cooldown:') ? `Please wait ${allowed.reason.split(':')[1]} seconds before opening another ticket.` : (messages[allowed.reason] ?? 'You cannot open a ticket right now.');
        await ephemeral(interaction, message);
        return;
    }
    const category = await prisma.ticketCategory.findFirst({
        where: { id: categoryId, guildId: interaction.guild.id },
        include: { items: true, forms: { orderBy: { order: 'asc' } } },
    });
    const item = category?.items.find((entry) => entry.id === itemId);
    if (!category || !item || !parseEntryItemConfig(item)) { await ephemeral(interaction, 'Ticket option not found.'); return; }
    const questions = configuredQuestions(item, category.forms);
    if (questions.length) {
        await showIntakeModal(interaction, { id: category.id, name: item.label || category.name, forms: questions }, item.id);
        return;
    }
    if (interaction.isButton()) await interaction.deferReply({ ephemeral: true });
    else await interaction.deferUpdate();
    await doCreateTicket(interaction, interaction.client, interaction.guild, member.id, categoryId, item.id, []);
}

async function handleGhostReply(interaction: StringSelectMenuInteraction, categoryId: number): Promise<void> {
    const itemId = Number.parseInt(interaction.values[0] ?? '', 10);
    if (!interaction.guild || !Number.isInteger(itemId)) { await ephemeral(interaction, 'Quick answer not found.'); return; }
    const item = await prisma.ticketItem.findFirst({ where: { id: itemId, categoryId, category: { guildId: interaction.guild.id } } });
    const response = item ? parseGhostReply(item) : null;
    if (!item || response === null) { await ephemeral(interaction, 'Quick answer not found.'); return; }
    const embed = new EmbedBuilder().setColor(0x8f5eff).setTitle(item.label.slice(0, 256)).setDescription((response || item.description || 'No answer has been configured yet.').slice(0, 4096));
    if (item.description && response) embed.setFooter({ text: item.description.slice(0, 2048) });
    await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function showIntakeModal(
    interaction: ModalParent,
    category: { id: number; name: string; forms: ModalQuestion[] },
    itemId: number | null,
): Promise<void> {
    const modal = new ModalBuilder()
        .setCustomId(`tk_modal:${category.id}:${itemId ?? 0}`)
        .setTitle(`${category.name.slice(0, 40)} Ticket`);

    for (const q of category.forms.slice(0, 5)) {
        if (q.type === 'SELECT' && q.options?.length) {
            const select = new StringSelectMenuBuilder()
                .setCustomId(`field_${q.order}`)
                .setPlaceholder(q.placeholder?.slice(0, 150) || 'Выберите вариант')
                .setMinValues(q.required ? 1 : 0)
                .setMaxValues(1)
                .addOptions(q.options.slice(0, 25).map((option, optionIndex) => (
                    new StringSelectMenuOptionBuilder()
                        .setLabel(option.slice(0, 100))
                        .setValue(`${optionIndex}:${option}`.slice(0, 100))
                )));
            modal.addLabelComponents(
                new LabelBuilder()
                    .setLabel(q.label.slice(0, 45))
                    .setStringSelectMenuComponent(select),
            );
            continue;
        }

        const input = new TextInputBuilder()
            .setCustomId(`field_${q.order}`)
            .setLabel(q.label.slice(0, 45))
            .setStyle(q.type === 'PARAGRAPH' ? TextInputStyle.Paragraph : TextInputStyle.Short)
            .setRequired(q.required)
            .setMaxLength(1024);
        if (q.placeholder) input.setPlaceholder(q.placeholder.slice(0, 100));
        modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
    }

    await interaction.showModal(modal);
}

async function handleModalSubmit(interaction: ModalSubmitInteraction, categoryId: number, itemId: number): Promise<void> {
    if (!interaction.guild || !interaction.member) {
        await ephemeral(interaction, 'This must be used in a server.');
        return;
    }
    const member = interaction.member as GuildMember;

    const category = await prisma.ticketCategory.findFirst({
        where: { id: categoryId, guildId: interaction.guild.id },
        include: { forms: { orderBy: { order: 'asc' } }, items: true },
    });
    if (!category) {
        await ephemeral(interaction, 'Category not found.');
        return;
    }

    const item = itemId ? category.items.find((entry) => entry.id === itemId) : null;
    const questions = configuredQuestions(item, category.forms);
    const answers: FormAnswer[] = questions.slice(0, 5).map((q) => ({
        label: q.label,
        answer: q.type === 'SELECT'
            ? (interaction.fields.getStringSelectValues(`field_${q.order}`)[0]?.replace(/^\d+:/, '') ?? '')
            : (interaction.fields.getTextInputValue(`field_${q.order}`) ?? ''),
    }));

    await interaction.deferReply({ ephemeral: true });
    await doCreateTicket(interaction, interaction.client, interaction.guild, member.id, categoryId, itemId || null, answers);
}

async function doCreateTicket(
    interaction: { followUp: (opts: { content: string; ephemeral?: boolean }) => Promise<unknown>; editReply?: (opts: { content: string }) => Promise<unknown> },
    client: Client,
    guild: NonNullable<ButtonInteraction['guild']>,
    authorId: string,
    categoryId: number,
    itemId: number | null,
    formAnswers: FormAnswer[],
): Promise<void> {
    try {
        const { ticket, thread } = await createTicket({
            client,
            guild,
            authorId,
            categoryId,
            itemId,
            formAnswers,
        });

        await interaction.followUp({
            content: `Ticket #${ticket.number} created! <#${thread.id}>`,
            ephemeral: true,
        });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        const friendly: Record<string, string> = {
            creationInProgress: 'Your ticket is already being created.',
            categoryNotFound: 'Ticket category not found.',
            panelChannelNotFound: 'The panel channel could not be found.',
        };
        await interaction.followUp({
            content: friendly[msg] ?? 'Failed to create ticket. Please try again.',
            ephemeral: true,
        });
    }
}

// ─── Close flow ────────────────────────────────────────────────────────────────

async function handleCloseButton(interaction: ButtonInteraction, ticketId: number): Promise<void> {
    if (!interaction.guild || !interaction.member) return;
    const member = interaction.member as GuildMember;
    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket || ticket.guildId !== interaction.guild.id) {
        await ephemeral(interaction, 'Ticket not found.');
        return;
    }
    if (ticket.status === 'CLOSED') {
        await ephemeral(interaction, 'This ticket is already closed.');
        return;
    }

    const isAuthor = ticket.authorId === member.id;
    const staff = await resolveStaff(member, ticket.categoryId);
    const category = await prisma.ticketCategory.findUnique({ where: { id: ticket.categoryId } });

    if (!staff && !(isAuthor && category?.allowUserClose)) {
        await ephemeral(interaction, 'You do not have permission to close this ticket.');
        return;
    }

    // Confirmation
    await interaction.reply({
        embeds: [
            new EmbedBuilder()
                .setColor(0xed4245)
                .setTitle('Close Ticket?')
                .setDescription('Are you sure you want to close this ticket?'),
        ],
        components: [
            new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                    .setCustomId(`tk_close_confirm:${ticketId}`)
                    .setLabel('Yes, close it')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId(`tk_close_reason:${ticketId}`)
                    .setLabel('Close with reason')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('tk_cancel')
                    .setLabel('Cancel')
                    .setStyle(ButtonStyle.Secondary),
            ),
        ],
        ephemeral: true,
    });
}

async function handleCloseConfirm(interaction: ButtonInteraction, ticketId: number, reason?: string): Promise<void> {
    if (!interaction.guild || !interaction.member) return;
    await interaction.deferUpdate();

    try {
        await closeTicket({
            client: interaction.client,
            guild: interaction.guild,
            ticketId,
            actorId: interaction.member.user.id,
            reason: reason ?? null,
        });

        if (!interaction.replied) {
            await interaction.editReply({ content: 'Ticket closed.', embeds: [], components: [] }).catch(() => null);
        }
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'error';
        const friendly: Record<string, string> = {
            ticketNotFound: 'Ticket not found.',
            alreadyClosed: 'This ticket is already closed.',
        };
        await interaction.followUp({ content: friendly[msg] ?? 'Failed to close ticket.', ephemeral: true }).catch(() => null);
    }
}

async function handleCloseReason(interaction: ButtonInteraction, ticketId: number): Promise<void> {
    const modal = new ModalBuilder()
        .setCustomId(`tk_close_reason:${ticketId}`)
        .setTitle('Close with Reason');

    modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
                .setCustomId('reason')
                .setLabel('Reason')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(false)
                .setMaxLength(512),
        ),
    );

    await interaction.showModal(modal);
}

async function handleCloseReasonModal(interaction: ModalSubmitInteraction, ticketId: number): Promise<void> {
    if (!interaction.guild || !interaction.member) return;
    const reason = interaction.fields.getTextInputValue('reason') || undefined;
    await interaction.deferReply({ ephemeral: true });

    try {
        await closeTicket({
            client: interaction.client,
            guild: interaction.guild,
            ticketId,
            actorId: interaction.member.user.id,
            reason: reason ?? null,
        });
        await interaction.editReply({ content: 'Ticket closed.' }).catch(() => null);
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'error';
        await interaction.followUp({ content: msg === 'alreadyClosed' ? 'Already closed.' : 'Failed to close ticket.', ephemeral: true }).catch(() => null);
    }
}

// ─── Claim / Unclaim ──────────────────────────────────────────────────────────

async function handleClaim(interaction: ButtonInteraction, ticketId: number): Promise<void> {
    if (!interaction.guild || !interaction.member) return;
    const member = interaction.member as GuildMember;

    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) { await ephemeral(interaction, 'Ticket not found.'); return; }

    if (!(await resolveStaff(member, ticket.categoryId))) {
        await ephemeral(interaction, 'Only staff can claim tickets.');
        return;
    }

    await interaction.deferUpdate();
    try {
        const updated = ticket.claimedBy === member.id
            ? await unclaimTicket({ client: interaction.client, guild: interaction.guild, ticketId, actorId: member.id })
            : await claimTicket({ client: interaction.client, guild: interaction.guild, ticketId, actorId: member.id });

        await interaction.followUp({
            content: updated.claimedBy ? `Claimed by <@${updated.claimedBy}>` : 'Unclaimed.',
            ephemeral: true,
        }).catch(() => null);
    } catch { /* noop */ }
}

// ─── Hold ─────────────────────────────────────────────────────────────────────

async function handleHold(interaction: ButtonInteraction, ticketId: number): Promise<void> {
    if (!interaction.guild || !interaction.member) return;
    const member = interaction.member as GuildMember;

    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) { await ephemeral(interaction, 'Ticket not found.'); return; }

    if (!(await resolveStaff(member, ticket.categoryId))) {
        await ephemeral(interaction, 'Only staff can put tickets on hold.');
        return;
    }

    await interaction.deferUpdate();
    try {
        if (ticket.status === 'ON_HOLD') {
            await resumeTicket({ client: interaction.client, guild: interaction.guild, ticketId, actorId: member.id });
            await interaction.followUp({ content: 'Ticket resumed.', ephemeral: true }).catch(() => null);
        } else {
            await setTicketOnHold({ client: interaction.client, guild: interaction.guild, ticketId, actorId: member.id });
            await interaction.followUp({ content: 'Ticket put on hold.', ephemeral: true }).catch(() => null);
        }
    } catch { /* noop */ }
}

// ─── Reopen (from log channel button) ────────────────────────────────────────

async function handleReopen(interaction: ButtonInteraction, ticketId: number): Promise<void> {
    if (!interaction.guild || !interaction.member) return;
    const member = interaction.member as GuildMember;

    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) { await ephemeral(interaction, 'Ticket not found.'); return; }

    if (!(await resolveStaff(member, ticket.categoryId))) {
        await ephemeral(interaction, 'Only staff can reopen tickets.');
        return;
    }

    await interaction.deferUpdate();
    try {
        await reopenTicket({ client: interaction.client, guild: interaction.guild, ticketId, actorId: member.id });
        await interaction.followUp({ content: 'Ticket reopened.', ephemeral: true }).catch(() => null);
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : '';
        await interaction.followUp({
            content: msg === 'notClosed' ? 'Ticket is not closed.' : 'Failed to reopen ticket.',
            ephemeral: true,
        }).catch(() => null);
    }
}

// ─── Rating ───────────────────────────────────────────────────────────────────

async function handleRate(interaction: ButtonInteraction, ticketId: number, rating: number): Promise<void> {
    if (!interaction.member) return;

    try {
        await submitRating({ ticketId, userId: interaction.member.user.id, rating });
        await interaction.update({
            content: `Thanks for your feedback! You rated this ticket ${rating}/5.`,
            embeds: [],
            components: [],
        });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : '';
        const friendly: Record<string, string> = {
            ticketNotFound: 'Ticket not found.',
            notAuthor: 'Only the ticket author can rate.',
            alreadyRated: 'You have already rated this ticket.',
            notClosed: 'You can only rate closed tickets.',
        };
        await ephemeral(interaction, friendly[msg] ?? 'Failed to submit rating.');
    }
}

// ─── Main router ──────────────────────────────────────────────────────────────

async function handleTransferResolve(interaction: ButtonInteraction, ticketId: number, requestId: number, accept: boolean): Promise<void> {
    if (!interaction.guild || !interaction.member) return;
    const member = interaction.member as GuildMember;
    const request = await prisma.ticketTransferRequest.findFirst({
        where: { id: requestId, ticketId, guildId: interaction.guild.id },
    });
    if (!request) {
        await ephemeral(interaction, 'Transfer request not found.');
        return;
    }
    if (request.toUserId !== member.id) {
        await ephemeral(interaction, 'Only the requested recipient can resolve this transfer.');
        return;
    }

    await interaction.deferUpdate();
    try {
        await resolveTransferRequest({
            guildId: interaction.guild.id,
            ticketId,
            requestId,
            actorId: member.id,
            accept,
        });
        if (accept) {
            await applyTransferThreadAccess(interaction.guild, ticketId, request.fromUserId, request.toUserId);
        }
        await interaction.followUp({
            content: accept ? 'Transfer accepted.' : 'Transfer declined.',
            ephemeral: true,
        }).catch(() => null);
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to resolve transfer.';
        await interaction.followUp({ content: msg, ephemeral: true }).catch(() => null);
    }
}

export async function handleTicketInteraction(interaction: Interaction, _client: Client): Promise<void> {
    if (interaction.isButton()) {
        const { action, parts } = parseId(interaction.customId);

        switch (action) {
            case 'tk_open': {
                const catId = parseInt(parts[0]);
                if (!isNaN(catId)) await handleOpen(interaction, catId);
                break;
            }
            case 'tk_entry': {
                const catId = parseInt(parts[0]);
                const itemId = parseInt(parts[1]);
                if (!isNaN(catId) && !isNaN(itemId)) await openConfiguredEntry(interaction, catId, itemId);
                break;
            }
            case 'tk_close': {
                const id = parseInt(parts[0]);
                if (!isNaN(id)) await handleCloseButton(interaction, id);
                break;
            }
            case 'tk_close_confirm': {
                const id = parseInt(parts[0]);
                if (!isNaN(id)) await handleCloseConfirm(interaction, id);
                break;
            }
            case 'tk_close_reason': {
                const id = parseInt(parts[0]);
                if (!isNaN(id)) await handleCloseReason(interaction, id);
                break;
            }
            case 'tk_claim': {
                const id = parseInt(parts[0]);
                if (!isNaN(id)) await handleClaim(interaction, id);
                break;
            }
            case 'tk_hold': {
                const id = parseInt(parts[0]);
                if (!isNaN(id)) await handleHold(interaction, id);
                break;
            }
            case 'tk_reopen': {
                const id = parseInt(parts[0]);
                if (!isNaN(id)) await handleReopen(interaction, id);
                break;
            }
            case 'tk_rate': {
                const id = parseInt(parts[0]);
                const stars = parseInt(parts[1]);
                if (!isNaN(id) && stars >= 1 && stars <= 5) await handleRate(interaction, id, stars);
                break;
            }
            case 'tk_transfer_accept':
            case 'tk_transfer_decline': {
                const id = parseInt(parts[0]);
                const requestId = parseInt(parts[1]);
                if (!isNaN(id) && !isNaN(requestId)) {
                    await handleTransferResolve(interaction, id, requestId, action === 'tk_transfer_accept');
                }
                break;
            }
            case 'tk_cancel': {
                await interaction.update({ content: 'Cancelled.', embeds: [], components: [] }).catch(() => null);
                break;
            }
            default:
                break;
        }
        return;
    }

    if (interaction.isStringSelectMenu()) {
        const { action, parts } = parseId(interaction.customId);
        if (action === 'tk_dept') {
            const catId = parseInt(parts[0]);
            if (!isNaN(catId)) await handleDeptSelect(interaction, catId);
        }
        if (action === 'tk_entry') {
            const catId = parseInt(parts[0]);
            const itemId = parseInt(interaction.values[0] ?? '', 10);
            if (!isNaN(catId) && !isNaN(itemId)) await openConfiguredEntry(interaction, catId, itemId);
        }
        if (action === 'tk_ghost') {
            const catId = parseInt(parts[0]);
            if (!isNaN(catId)) await handleGhostReply(interaction, catId);
        }
        return;
    }

    if (interaction.isModalSubmit()) {
        const { action, parts } = parseId(interaction.customId);

        if (action === 'tk_modal') {
            const catId = parseInt(parts[0]);
            const itemId = parseInt(parts[1] ?? '0');
            if (!isNaN(catId)) await handleModalSubmit(interaction, catId, isNaN(itemId) ? 0 : itemId);
        }

        if (action === 'tk_close_reason') {
            const id = parseInt(parts[0]);
            if (!isNaN(id)) await handleCloseReasonModal(interaction, id);
        }
        return;
    }
}

// ─── lastActivityAt bump on messageCreate ────────────────────────────────────

export async function bumpTicketActivity(threadId: string): Promise<void> {
    const ticket = await findTicketByThread(threadId);
    if (!ticket || ticket.status === 'CLOSED') return;
    await prisma.ticket.update({
        where: { id: ticket.id },
        data: { lastActivityAt: new Date() },
    }).catch(() => null);
}
