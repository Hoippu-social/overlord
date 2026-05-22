import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonInteraction,
    ButtonStyle,
    ChannelType,
    Client,
    EmbedBuilder,
    GuildMember,
    Interaction,
    MessageCreateOptions,
    ModalBuilder,
    ModalSubmitInteraction,
    StringSelectMenuBuilder,
    StringSelectMenuInteraction,
    TextChannel,
    TextInputBuilder,
    TextInputStyle,
} from 'discord.js';
import { createAppealTicket, ensureAppealConfig, getAppealTicketMeta, listAppealableCases, reviewAppealTicket } from './AppealService';
import {
    getAppealRuntimeSettings,
    readAppealPanelMeta,
    readAppealSharedPanelMeta,
    writeAppealPanelMeta,
    writeAppealSharedPanelMeta,
} from './AppealRuntimeConfig';

const APPEAL_PANEL_BUTTON_ID = 'appeal_panel_start';
const APPEAL_SHARED_PANEL_BUTTON_ID = 'appeal_shared_start';
const APPEAL_SHARED_CATEGORY_SELECT_PREFIX = 'appeal_shared_category';
const APPEAL_CASE_SELECT_PREFIX = 'appeal_case_select';
const APPEAL_INTAKE_MODAL_PREFIX = 'appeal_intake';
const APPEAL_STAFF_IN_REVIEW_PREFIX = 'appeal_staff_in_review';
const APPEAL_STAFF_ACCEPT_PREFIX = 'appeal_staff_accept';
const APPEAL_STAFF_REJECT_PREFIX = 'appeal_staff_reject';
const APPEAL_STAFF_NOTE_MODAL_PREFIX = 'appeal_staff_note';

function isTextChannel(channel: unknown): channel is TextChannel {
    return Boolean(channel && typeof channel === 'object' && 'type' in channel && (channel as { type?: ChannelType }).type === ChannelType.GuildText);
}

function truncate(value: string | null | undefined, maxLength: number) {
    const normalized = (value ?? '').trim();
    if (!normalized) return '';
    return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 3)}...` : normalized;
}

function buildDedicatedPanelPayload(settings: Awaited<ReturnType<typeof getAppealRuntimeSettings>>): MessageCreateOptions {
    const allowedActions = settings.allowedActionTypes.length
        ? settings.allowedActionTypes.join(', ')
        : '\u0412\u0441\u0435 \u043d\u0430\u043a\u0430\u0437\u0430\u043d\u0438\u044f';
    const button = new ButtonBuilder()
        .setCustomId(APPEAL_PANEL_BUTTON_ID)
        .setLabel(settings.dedicatedPanel.buttonLabel || '\u041f\u043e\u0434\u0430\u0442\u044c \u0430\u043f\u0435\u043b\u043b\u044f\u0446\u0438\u044e')
        .setStyle(ButtonStyle.Primary);

    if (settings.dedicatedPanel.buttonEmoji.trim().length) {
        button.setEmoji(settings.dedicatedPanel.buttonEmoji.trim());
    }

    return {
        embeds: [
            new EmbedBuilder()
                .setColor(0x5cba5c)
                .setTitle(settings.dedicatedPanel.title || '\u041e\u0431\u0436\u0430\u043b\u043e\u0432\u0430\u043d\u0438\u0435 \u043d\u0430\u043a\u0430\u0437\u0430\u043d\u0438\u044f')
                .setDescription(settings.dedicatedPanel.description || '\u041e\u0442\u043a\u0440\u043e\u0439\u0442\u0435 \u0430\u043f\u0435\u043b\u043b\u044f\u0446\u0438\u044e \u0438 \u0441\u043b\u0435\u0434\u0438\u0442\u0435 \u0437\u0430 \u0435\u0451 \u0445\u043e\u0434\u043e\u043c \u043f\u0440\u044f\u043c\u043e \u0432\u043d\u0443\u0442\u0440\u0438 Discord.')
                .addFields(
                    {
                        name: '\u0427\u0442\u043e \u043c\u043e\u0436\u043d\u043e \u043e\u0441\u043f\u043e\u0440\u0438\u0442\u044c',
                        value: allowedActions,
                        inline: true,
                    },
                    {
                        name: '\u041e\u043a\u043d\u043e \u043f\u043e\u0434\u0430\u0447\u0438',
                        value: `${settings.appealWindowDays} \u0434\u043d.`,
                        inline: true,
                    },
                    {
                        name: '\u041f\u043e\u0432\u0442\u043e\u0440\u043d\u0430\u044f \u043f\u043e\u0434\u0430\u0447\u0430',
                        value: settings.oneOpenAppealPerCase
                            ? '\u041e\u0434\u043d\u0430 \u0430\u043a\u0442\u0438\u0432\u043d\u0430\u044f \u0430\u043f\u0435\u043b\u043b\u044f\u0446\u0438\u044f \u043d\u0430 \u043a\u0435\u0439\u0441'
                            : '\u0420\u0430\u0437\u0440\u0435\u0448\u0435\u043d\u043e \u043d\u0435\u0441\u043a\u043e\u043b\u044c\u043a\u043e \u043e\u0431\u0440\u0430\u0449\u0435\u043d\u0438\u0439',
                        inline: true,
                    },
                ),
        ],
        components: [new ActionRowBuilder<ButtonBuilder>().addComponents(button)],
    };
}

function buildSharedPanelPayload(settings: Awaited<ReturnType<typeof getAppealRuntimeSettings>>): MessageCreateOptions {
    return {
        embeds: [
            new EmbedBuilder()
                .setColor(0x5cba5c)
                .setTitle('\u0415\u0441\u0442\u044c \u0447\u0442\u043e \u0441\u043a\u0430\u0437\u0430\u0442\u044c?')
                .setDescription([
                    settings.sharedPlacement.description || '\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u043a\u0430\u0442\u0435\u0433\u043e\u0440\u0438\u044e \u043e\u0431\u0440\u0430\u0449\u0435\u043d\u0438\u044f \u0438 \u043e\u0442\u043a\u0440\u043e\u0439\u0442\u0435 \u0435\u0433\u043e \u043f\u0440\u044f\u043c\u043e \u0432\u043d\u0443\u0442\u0440\u0438 Discord.',
                    '',
                    '\u041d\u0430\u0436\u043c\u0438\u0442\u0435 \u043a\u043d\u043e\u043f\u043a\u0443 \u043d\u0438\u0436\u0435, \u0447\u0442\u043e\u0431\u044b \u0432\u044b\u0431\u0440\u0430\u0442\u044c \u0440\u0430\u0437\u0434\u0435\u043b \u043e\u0431\u0440\u0430\u0449\u0435\u043d\u0438\u044f.',
                ].join('\n')),
        ],
        components: [
            new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                    .setCustomId(APPEAL_SHARED_PANEL_BUTTON_ID)
                    .setLabel('\u0421\u043e\u0437\u0434\u0430\u0442\u044c \u043e\u0431\u0440\u0430\u0449\u0435\u043d\u0438\u0435')
                    .setStyle(ButtonStyle.Primary),
            ),
        ],
    };
}

async function deletePanelMessage(client: Client, guildId: string, channelId: string | null, messageId: string | null) {
    if (!channelId || !messageId) return;
    const guild = client.guilds.cache.get(guildId) ?? await client.guilds.fetch(guildId).catch(() => null);
    if (!guild) return;
    const channel = await guild.channels.fetch(channelId).catch(() => null);
    if (!channel || !isTextChannel(channel)) return;
    const message = await channel.messages.fetch(messageId).catch(() => null);
    if (message && message.author.id === client.user?.id) {
        await message.delete().catch(() => null);
    }
}

async function syncPanelMessage(options: {
    client: Client;
    guildId: string;
    enabled: boolean;
    channelId: string;
    payload: MessageCreateOptions;
    meta: { channelId: string | null; messageId: string | null };
    writeMeta: (meta: { channelId: string | null; messageId: string | null }) => Promise<void>;
    missingChannelError: string;
}) {
    const guild = options.client.guilds.cache.get(options.guildId) ?? await options.client.guilds.fetch(options.guildId).catch(() => null);
    if (!guild) {
        throw new Error('Guild not found');
    }

    if (!options.enabled) {
        await deletePanelMessage(options.client, options.guildId, options.meta.channelId, options.meta.messageId);
        await options.writeMeta({ channelId: null, messageId: null });
        return { ok: true, state: 'cleared' as const };
    }

    const targetChannel = await guild.channels.fetch(options.channelId).catch(() => null);
    if (!targetChannel || !isTextChannel(targetChannel)) {
        throw new Error(options.missingChannelError);
    }

    const sameMessage =
        options.meta.channelId === targetChannel.id && options.meta.messageId
            ? await targetChannel.messages.fetch(options.meta.messageId).catch(() => null)
            : null;

    if (sameMessage && sameMessage.author.id === options.client.user?.id) {
        await sameMessage.edit({
            content: typeof options.payload.content === 'string' ? options.payload.content : undefined,
            embeds: options.payload.embeds,
            components: options.payload.components,
        });
        await options.writeMeta({ channelId: targetChannel.id, messageId: sameMessage.id });
        return { ok: true, state: 'updated' as const, channelId: targetChannel.id, messageId: sameMessage.id };
    }

    if (options.meta.channelId && options.meta.messageId) {
        await deletePanelMessage(options.client, options.guildId, options.meta.channelId, options.meta.messageId);
    }

    const created = await targetChannel.send(options.payload);
    await options.writeMeta({ channelId: targetChannel.id, messageId: created.id });
    return { ok: true, state: 'created' as const, channelId: targetChannel.id, messageId: created.id };
}

export async function syncAppealPanels(client: Client, guildId: string) {
    const settings = await getAppealRuntimeSettings(guildId);
    const config = await ensureAppealConfig(guildId);
    const dedicatedMeta = await readAppealPanelMeta(guildId);
    const sharedMeta = await readAppealSharedPanelMeta(guildId);

    const dedicatedResult = await syncPanelMessage({
        client,
        guildId,
        enabled: config.enabled && settings.dedicatedPanel.enabled && settings.dedicatedPanel.channelId.trim().length > 0,
        channelId: settings.dedicatedPanel.channelId,
        payload: buildDedicatedPanelPayload(settings),
        meta: { channelId: dedicatedMeta.panelChannelId, messageId: dedicatedMeta.panelMessageId },
        writeMeta: async (meta) => writeAppealPanelMeta(guildId, { panelChannelId: meta.channelId, panelMessageId: meta.messageId }),
        missingChannelError: 'Dedicated appeal panel channel must be a text channel.',
    });

    const sharedResult = await syncPanelMessage({
        client,
        guildId,
        enabled: config.enabled && settings.sharedPlacement.enabled && settings.sharedPlacement.channelId.trim().length > 0,
        channelId: settings.sharedPlacement.channelId,
        payload: buildSharedPanelPayload(settings),
        meta: { channelId: sharedMeta.sharedPanelChannelId, messageId: sharedMeta.sharedPanelMessageId },
        writeMeta: async (meta) => writeAppealSharedPanelMeta(guildId, { sharedPanelChannelId: meta.channelId, sharedPanelMessageId: meta.messageId }),
        missingChannelError: 'Shared appeal panel channel must be a text channel.',
    });

    return { ok: true, dedicated: dedicatedResult, shared: sharedResult };
}

export async function syncDedicatedAppealPanel(client: Client, guildId: string) {
    const result = await syncAppealPanels(client, guildId);
    return result.dedicated;
}

async function resolveMember(interaction: Interaction) {
    if (!interaction.guild || !interaction.guildId) {
        return null;
    }

    return interaction.member instanceof GuildMember
        ? interaction.member
        : await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
}

async function resolveAppealAccess(interaction: Interaction) {
    const member = await resolveMember(interaction);
    if (!member || !interaction.guildId) {
        return null;
    }

    const settings = await getAppealRuntimeSettings(interaction.guildId);
    const isAdmin = member.permissions.has('Administrator') || member.permissions.has('ManageGuild');
    const reviewerRoleIds = new Set(settings.reviewerRoleIds);
    const triageRoleIds = new Set(settings.triageRoleIds);

    const hasReviewerRole = member.roles.cache.some((role) => reviewerRoleIds.has(role.id));
    const hasTriageRole = member.roles.cache.some((role) => triageRoleIds.has(role.id));

    return {
        settings,
        member,
        canTriage: isAdmin || hasReviewerRole || hasTriageRole,
        canReview: isAdmin || hasReviewerRole,
    };
}

function formatAppealMessage(
    questions: Awaited<ReturnType<typeof getAppealRuntimeSettings>>['intakeQuestions'],
    interaction: ModalSubmitInteraction,
) {
    const sections = questions.map((question, index) => {
        const answer = interaction.fields.getTextInputValue(`appeal_q_${index}`).trim();
        return { question, answer };
    }).filter((entry) => entry.answer.length > 0);

    if (!sections.length) {
        throw new Error('\u0417\u0430\u043f\u043e\u043b\u043d\u0438\u0442\u0435 \u0445\u043e\u0442\u044f \u0431\u044b \u043e\u0434\u0438\u043d \u043e\u0442\u0432\u0435\u0442 \u0434\u043b\u044f \u0430\u043f\u0435\u043b\u043b\u044f\u0446\u0438\u0438.');
    }

    return sections.map((entry) => `**${entry.question.label}**\n${entry.answer}`).join('\n\n');
}

function getRuntimeQuestions(settings: Awaited<ReturnType<typeof getAppealRuntimeSettings>>) {
    const questions = settings.intakeQuestions.slice(0, 5);
    if (questions.length) {
        return questions;
    }

    return [
        {
            id: 'appeal_summary',
            label: '\u041f\u043e\u0447\u0435\u043c\u0443 \u0432\u044b \u043e\u0441\u043f\u0430\u0440\u0438\u0432\u0430\u0435\u0442\u0435 \u044d\u0442\u043e \u0440\u0435\u0448\u0435\u043d\u0438\u0435?',
            placeholder: '\u041a\u0440\u0430\u0442\u043a\u043e \u0438 \u043f\u043e \u0434\u0435\u043b\u0443 \u043e\u043f\u0438\u0448\u0438\u0442\u0435, \u043f\u043e\u0447\u0435\u043c\u0443 \u0440\u0435\u0448\u0435\u043d\u0438\u0435 \u043d\u0443\u0436\u043d\u043e \u043f\u0435\u0440\u0435\u0441\u043c\u043e\u0442\u0440\u0435\u0442\u044c.',
            required: true,
            long: true,
        },
    ];
}

async function showCaseSelect(interaction: ButtonInteraction | StringSelectMenuInteraction, guildId: string, userId: string) {
    const cases = await listAppealableCases(guildId, userId, 25);
    if (!cases.length) {
        const payload = {
            content: '\u0421\u0435\u0439\u0447\u0430\u0441 \u0443 \u0432\u0430\u0441 \u043d\u0435\u0442 \u0430\u043a\u0442\u0438\u0432\u043d\u044b\u0445 \u043d\u0430\u043a\u0430\u0437\u0430\u043d\u0438\u0439, \u043a\u043e\u0442\u043e\u0440\u044b\u0435 \u043c\u043e\u0436\u043d\u043e \u043e\u0431\u0436\u0430\u043b\u043e\u0432\u0430\u0442\u044c \u0447\u0435\u0440\u0435\u0437 \u044d\u0442\u0443 \u043f\u0430\u043d\u0435\u043b\u044c. \u0415\u0441\u043b\u0438 \u043a\u0435\u0439\u0441 \u043d\u0435 \u043e\u0442\u043e\u0431\u0440\u0430\u0436\u0430\u0435\u0442\u0441\u044f, \u0438\u0441\u043f\u043e\u043b\u044c\u0437\u0443\u0439\u0442\u0435 `/appeal submit` \u043a\u0430\u043a fallback.',
            components: [],
            ephemeral: true as const,
        };

        if (interaction.isStringSelectMenu()) {
            await interaction.update(payload);
        } else {
            await interaction.reply(payload);
        }
        return;
    }

    const select = new StringSelectMenuBuilder()
        .setCustomId(`${APPEAL_CASE_SELECT_PREFIX}:${userId}`)
        .setPlaceholder('\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u043a\u0435\u0439\u0441 \u0434\u043b\u044f \u043e\u0431\u0436\u0430\u043b\u043e\u0432\u0430\u043d\u0438\u044f')
        .addOptions(
            cases.slice(0, 25).map((entry) => ({
                label: `#${entry.caseNumber} • ${entry.actionType}`,
                value: String(entry.caseNumber),
                description: truncate(entry.reason || `\u0421\u043e\u0437\u0434\u0430\u043d ${entry.createdAt.toLocaleDateString('ru-RU')}`, 95)
                    || `\u0421\u043e\u0437\u0434\u0430\u043d ${entry.createdAt.toLocaleDateString('ru-RU')}`,
            })),
        );

    const payload = {
        content: '\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u043d\u0430\u043a\u0430\u0437\u0430\u043d\u0438\u0435, \u043a\u043e\u0442\u043e\u0440\u043e\u0435 \u0445\u043e\u0442\u0438\u0442\u0435 \u043e\u0441\u043f\u043e\u0440\u0438\u0442\u044c.',
        components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select)],
        ephemeral: true as const,
    };

    if (interaction.isStringSelectMenu()) {
        await interaction.update(payload);
        return;
    }

    await interaction.reply(payload);
}

async function handlePanelStart(interaction: ButtonInteraction) {
    if (!interaction.guildId) {
        await interaction.reply({ content: '\u0410\u043f\u0435\u043b\u043b\u044f\u0446\u0438\u0438 \u0447\u0435\u0440\u0435\u0437 \u043f\u0430\u043d\u0435\u043b\u044c \u0434\u043e\u0441\u0442\u0443\u043f\u043d\u044b \u0442\u043e\u043b\u044c\u043a\u043e \u043d\u0430 \u0441\u0435\u0440\u0432\u0435\u0440\u0435.', ephemeral: true });
        return;
    }

    const settings = await getAppealRuntimeSettings(interaction.guildId);
    const config = await ensureAppealConfig(interaction.guildId);
    if (!config.enabled || !settings.dedicatedPanel.enabled) {
        await interaction.reply({ content: '\u041f\u0430\u043d\u0435\u043b\u044c \u0430\u043f\u0435\u043b\u043b\u044f\u0446\u0438\u0439 \u0441\u0435\u0439\u0447\u0430\u0441 \u043e\u0442\u043a\u043b\u044e\u0447\u0435\u043d\u0430.', ephemeral: true });
        return;
    }

    await showCaseSelect(interaction, interaction.guildId, interaction.user.id);
}

async function handleSharedPanelStart(interaction: ButtonInteraction) {
    if (!interaction.guildId) {
        await interaction.reply({ content: '\u0412\u044b\u0431\u043e\u0440 \u043a\u0430\u0442\u0435\u0433\u043e\u0440\u0438\u0438 \u043e\u0431\u0440\u0430\u0449\u0435\u043d\u0438\u044f \u0434\u043e\u0441\u0442\u0443\u043f\u0435\u043d \u0442\u043e\u043b\u044c\u043a\u043e \u043d\u0430 \u0441\u0435\u0440\u0432\u0435\u0440\u0435.', ephemeral: true });
        return;
    }

    const settings = await getAppealRuntimeSettings(interaction.guildId);
    const config = await ensureAppealConfig(interaction.guildId);
    if (!config.enabled || !settings.sharedPlacement.enabled) {
        await interaction.reply({ content: '\u0421\u0438\u0441\u0442\u0435\u043c\u043d\u0430\u044f \u043a\u0430\u0442\u0435\u0433\u043e\u0440\u0438\u044f \u0430\u043f\u0435\u043b\u043b\u044f\u0446\u0438\u0439 \u0441\u0435\u0439\u0447\u0430\u0441 \u043e\u0442\u043a\u043b\u044e\u0447\u0435\u043d\u0430.', ephemeral: true });
        return;
    }

    const select = new StringSelectMenuBuilder()
        .setCustomId(`${APPEAL_SHARED_CATEGORY_SELECT_PREFIX}:${interaction.user.id}`)
        .setPlaceholder('\u0412\u044b\u0431\u0440\u0430\u0442\u044c \u043a\u0430\u0442\u0435\u0433\u043e\u0440\u0438\u044e \u043e\u0431\u0440\u0430\u0449\u0435\u043d\u0438\u044f')
        .addOptions([
            {
                label: settings.sharedPlacement.label || '\u0410\u043f\u0435\u043b\u043b\u044f\u0446\u0438\u044f \u043d\u0430 \u043d\u0430\u043a\u0430\u0437\u0430\u043d\u0438\u044f',
                value: 'punishment_appeal',
                emoji: settings.sharedPlacement.emoji.trim().length ? settings.sharedPlacement.emoji.trim() : undefined,
                description: truncate(
                    settings.sharedPlacement.description
                        || '\u041e\u0441\u043f\u043e\u0440\u0438\u0442\u044c \u043d\u0430\u043a\u0430\u0437\u0430\u043d\u0438\u0435 \u0438 \u043f\u0440\u0435\u0434\u043e\u0441\u0442\u0430\u0432\u0438\u0442\u044c \u0441\u0432\u043e\u0438 \u0430\u0440\u0433\u0443\u043c\u0435\u043d\u0442\u044b.',
                    95,
                ),
            },
        ]);

    await interaction.reply({
        content: '\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u043a\u0430\u0442\u0435\u0433\u043e\u0440\u0438\u044e \u043e\u0431\u0440\u0430\u0449\u0435\u043d\u0438\u044f.',
        components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select)],
        ephemeral: true,
    });
}

async function handleSharedCategorySelect(interaction: StringSelectMenuInteraction) {
    const [, ownerId] = interaction.customId.split(':');
    if (interaction.user.id !== ownerId) {
        await interaction.reply({ content: '\u042d\u0442\u043e \u043c\u0435\u043d\u044e \u043e\u0442\u043a\u0440\u044b\u0442\u043e \u043d\u0435 \u0434\u043b\u044f \u0432\u0430\u0441.', ephemeral: true });
        return;
    }

    if (!interaction.guildId) {
        await interaction.reply({ content: '\u041a\u0430\u0442\u0435\u0433\u043e\u0440\u0438\u044f \u043d\u0435\u0434\u043e\u0441\u0442\u0443\u043f\u043d\u0430 \u0432\u043d\u0435 \u0441\u0435\u0440\u0432\u0435\u0440\u0430.', ephemeral: true });
        return;
    }

    if (interaction.values[0] !== 'punishment_appeal') {
        await interaction.update({ content: '\u042d\u0442\u0430 \u043a\u0430\u0442\u0435\u0433\u043e\u0440\u0438\u044f \u0435\u0449\u0451 \u043d\u0435 \u043f\u043e\u0434\u043a\u043b\u044e\u0447\u0435\u043d\u0430.', components: [] });
        return;
    }

    await showCaseSelect(interaction, interaction.guildId, interaction.user.id);
}

async function handleCaseSelect(interaction: StringSelectMenuInteraction) {
    const [, ownerId] = interaction.customId.split(':');
    if (interaction.user.id !== ownerId) {
        await interaction.reply({ content: '\u042d\u0442\u043e \u043c\u0435\u043d\u044e \u043e\u0442\u043a\u0440\u044b\u0442\u043e \u043d\u0435 \u0434\u043b\u044f \u0432\u0430\u0441.', ephemeral: true });
        return;
    }

    const caseNumber = Number.parseInt(interaction.values[0] ?? '', 10);
    if (!Number.isInteger(caseNumber) || caseNumber < 1 || !interaction.guildId) {
        await interaction.reply({ content: '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u043e\u043f\u0440\u0435\u0434\u0435\u043b\u0438\u0442\u044c \u0432\u044b\u0431\u0440\u0430\u043d\u043d\u044b\u0439 \u043a\u0435\u0439\u0441.', ephemeral: true });
        return;
    }

    const settings = await getAppealRuntimeSettings(interaction.guildId);
    const questions = getRuntimeQuestions(settings);
    const modal = new ModalBuilder()
        .setCustomId(`${APPEAL_INTAKE_MODAL_PREFIX}:${caseNumber}`)
        .setTitle(`\u0410\u043f\u0435\u043b\u043b\u044f\u0446\u0438\u044f \u043d\u0430 \u043a\u0435\u0439\u0441 #${caseNumber}`);

    modal.addComponents(
        ...questions.map((question, index) => new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
                .setCustomId(`appeal_q_${index}`)
                .setLabel(question.label.slice(0, 45))
                .setPlaceholder(question.placeholder.slice(0, 100))
                .setRequired(question.required)
                .setStyle(question.long ? TextInputStyle.Paragraph : TextInputStyle.Short)
                .setMaxLength(question.long ? 2000 : 500),
        )),
    );

    await interaction.showModal(modal);
}

async function handleIntakeModal(interaction: ModalSubmitInteraction, client: Client) {
    const caseNumber = Number.parseInt(interaction.customId.split(':')[1] ?? '', 10);
    if (!interaction.guild || !interaction.guildId || !Number.isInteger(caseNumber) || caseNumber < 1) {
        await interaction.reply({ content: '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u043e\u043f\u0440\u0435\u0434\u0435\u043b\u0438\u0442\u044c \u043a\u0435\u0439\u0441 \u0434\u043b\u044f \u0430\u043f\u0435\u043b\u043b\u044f\u0446\u0438\u0438.', ephemeral: true });
        return;
    }

    try {
        const settings = await getAppealRuntimeSettings(interaction.guildId);
        const message = formatAppealMessage(getRuntimeQuestions(settings), interaction);
        const ticket = await createAppealTicket({
            guild: interaction.guild,
            userId: interaction.user.id,
            caseNumber,
            message,
            client,
        });
        const meta = await getAppealTicketMeta(ticket.id);

        await interaction.reply({
            content: [
                `\u0410\u043f\u0435\u043b\u043b\u044f\u0446\u0438\u044f #${ticket.id} \u0441\u043e\u0437\u0434\u0430\u043d\u0430 \u0434\u043b\u044f \u043a\u0435\u0439\u0441\u0430 #${caseNumber}.`,
                meta.threadChannelId
                    ? `\u0422\u0440\u0435\u0434: <#${meta.threadChannelId}>`
                    : '\u0422\u0440\u0435\u0434 \u043d\u0435 \u0431\u044b\u043b \u0441\u043e\u0437\u0434\u0430\u043d \u0430\u0432\u0442\u043e\u043c\u0430\u0442\u0438\u0447\u0435\u0441\u043a\u0438. \u041f\u0440\u043e\u0432\u0435\u0440\u044c\u0442\u0435 \u043d\u0430\u0441\u0442\u0440\u043e\u0439\u043a\u0438 \u043a\u0430\u043d\u0430\u043b\u0430 \u0434\u043b\u044f appeal-thread.',
            ].join('\n'),
            ephemeral: true,
        });
    } catch (error) {
        await interaction.reply({
            content: error instanceof Error ? error.message : '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0441\u043e\u0437\u0434\u0430\u0442\u044c \u0430\u043f\u0435\u043b\u043b\u044f\u0446\u0438\u044e.',
            ephemeral: true,
        });
    }
}

async function handleStaffInReview(interaction: ButtonInteraction, client: Client) {
    const ticketId = Number.parseInt(interaction.customId.split(':')[1] ?? '', 10);
    if (!Number.isInteger(ticketId) || ticketId < 1 || !interaction.guild) {
        await interaction.reply({ content: '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u043e\u043f\u0440\u0435\u0434\u0435\u043b\u0438\u0442\u044c \u0430\u043f\u0435\u043b\u043b\u044f\u0446\u0438\u044e.', ephemeral: true });
        return;
    }

    const access = await resolveAppealAccess(interaction);
    if (!access?.canTriage) {
        await interaction.reply({ content: '\u0423 \u0432\u0430\u0441 \u043d\u0435\u0442 \u0434\u043e\u0441\u0442\u0443\u043f\u0430 \u043a \u043e\u0431\u0440\u0430\u0431\u043e\u0442\u043a\u0435 \u0430\u043f\u0435\u043b\u043b\u044f\u0446\u0438\u0439.', ephemeral: true });
        return;
    }

    try {
        await reviewAppealTicket({
            guild: interaction.guild,
            ticketId,
            reviewerId: interaction.user.id,
            decision: 'IN_REVIEW',
            note: null,
            client,
        });

        await interaction.reply({ content: `\u0410\u043f\u0435\u043b\u043b\u044f\u0446\u0438\u044f #${ticketId} \u043f\u0435\u0440\u0435\u0432\u0435\u0434\u0435\u043d\u0430 \u0432 \u0441\u0442\u0430\u0442\u0443\u0441 "\u0412 \u0440\u0430\u0431\u043e\u0442\u0443".`, ephemeral: true });
    } catch (error) {
        await interaction.reply({ content: error instanceof Error ? error.message : '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u043e\u0431\u043d\u043e\u0432\u0438\u0442\u044c \u0430\u043f\u0435\u043b\u043b\u044f\u0446\u0438\u044e.', ephemeral: true });
    }
}

async function showStaffDecisionModal(interaction: ButtonInteraction, decision: 'ACCEPTED' | 'REJECTED') {
    const ticketId = Number.parseInt(interaction.customId.split(':')[1] ?? '', 10);
    if (!Number.isInteger(ticketId) || ticketId < 1) {
        await interaction.reply({ content: '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u043e\u043f\u0440\u0435\u0434\u0435\u043b\u0438\u0442\u044c \u0430\u043f\u0435\u043b\u043b\u044f\u0446\u0438\u044e.', ephemeral: true });
        return;
    }

    const access = await resolveAppealAccess(interaction);
    if (!access?.canReview) {
        await interaction.reply({ content: '\u0423 \u0432\u0430\u0441 \u043d\u0435\u0442 \u0434\u043e\u0441\u0442\u0443\u043f\u0430 \u043a \u0444\u0438\u043d\u0430\u043b\u044c\u043d\u043e\u043c\u0443 \u0440\u0435\u0448\u0435\u043d\u0438\u044e \u043f\u043e \u0430\u043f\u0435\u043b\u043b\u044f\u0446\u0438\u0438.', ephemeral: true });
        return;
    }

    const modal = new ModalBuilder()
        .setCustomId(`${APPEAL_STAFF_NOTE_MODAL_PREFIX}:${decision}:${ticketId}`)
        .setTitle(decision === 'ACCEPTED' ? `\u041e\u0434\u043e\u0431\u0440\u0438\u0442\u044c #${ticketId}` : `\u041e\u0442\u043a\u043b\u043e\u043d\u0438\u0442\u044c #${ticketId}`);

    modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
                .setCustomId('appeal_staff_note')
                .setLabel(decision === 'ACCEPTED' ? '\u041a\u043e\u043c\u043c\u0435\u043d\u0442\u0430\u0440\u0438\u0439 \u0434\u043b\u044f \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044f' : '\u041f\u0440\u0438\u0447\u0438\u043d\u0430 \u043e\u0442\u043a\u0430\u0437\u0430')
                .setRequired(decision === 'REJECTED')
                .setStyle(TextInputStyle.Paragraph)
                .setMaxLength(2000)
                .setPlaceholder(decision === 'ACCEPTED'
                    ? '\u0427\u0442\u043e \u0438\u0437\u043c\u0435\u043d\u0438\u0442\u0441\u044f \u043f\u043e \u0438\u0442\u043e\u0433\u0430\u043c \u0430\u043f\u0435\u043b\u043b\u044f\u0446\u0438\u0438?'
                    : '\u041a\u0440\u0430\u0442\u043a\u043e \u043e\u0431\u044a\u044f\u0441\u043d\u0438\u0442\u0435, \u043f\u043e\u0447\u0435\u043c\u0443 \u0430\u043f\u0435\u043b\u043b\u044f\u0446\u0438\u044f \u043e\u0442\u043a\u043b\u043e\u043d\u0435\u043d\u0430.'),
        ),
    );

    await interaction.showModal(modal);
}

async function handleStaffDecisionModal(interaction: ModalSubmitInteraction, client: Client) {
    const [, decisionRaw, ticketRaw] = interaction.customId.split(':');
    const decision = decisionRaw === 'ACCEPTED' ? 'ACCEPTED' : decisionRaw === 'REJECTED' ? 'REJECTED' : null;
    const ticketId = Number.parseInt(ticketRaw ?? '', 10);
    if (!decision || !Number.isInteger(ticketId) || ticketId < 1 || !interaction.guild) {
        await interaction.reply({ content: '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u043e\u043f\u0440\u0435\u0434\u0435\u043b\u0438\u0442\u044c \u0430\u043f\u0435\u043b\u043b\u044f\u0446\u0438\u044e.', ephemeral: true });
        return;
    }

    const access = await resolveAppealAccess(interaction);
    if (!access?.canReview) {
        await interaction.reply({ content: '\u0423 \u0432\u0430\u0441 \u043d\u0435\u0442 \u0434\u043e\u0441\u0442\u0443\u043f\u0430 \u043a \u0444\u0438\u043d\u0430\u043b\u044c\u043d\u043e\u043c\u0443 \u0440\u0435\u0448\u0435\u043d\u0438\u044e \u043f\u043e \u0430\u043f\u0435\u043b\u043b\u044f\u0446\u0438\u0438.', ephemeral: true });
        return;
    }

    const note = interaction.fields.getTextInputValue('appeal_staff_note').trim() || null;

    try {
        await reviewAppealTicket({
            guild: interaction.guild,
            ticketId,
            reviewerId: interaction.user.id,
            decision,
            note,
            client,
        });

        await interaction.reply({
            content: decision === 'ACCEPTED'
                ? `\u0410\u043f\u0435\u043b\u043b\u044f\u0446\u0438\u044f #${ticketId} \u043e\u0434\u043e\u0431\u0440\u0435\u043d\u0430.`
                : `\u0410\u043f\u0435\u043b\u043b\u044f\u0446\u0438\u044f #${ticketId} \u043e\u0442\u043a\u043b\u043e\u043d\u0435\u043d\u0430.`,
            ephemeral: true,
        });
    } catch (error) {
        await interaction.reply({ content: error instanceof Error ? error.message : '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u043e\u0431\u043d\u043e\u0432\u0438\u0442\u044c \u0430\u043f\u0435\u043b\u043b\u044f\u0446\u0438\u044e.', ephemeral: true });
    }
}

export function isAppealInteraction(interaction: Interaction) {
    const customId = 'customId' in interaction ? interaction.customId : '';
    return customId === APPEAL_PANEL_BUTTON_ID
        || customId === APPEAL_SHARED_PANEL_BUTTON_ID
        || customId.startsWith(`${APPEAL_SHARED_CATEGORY_SELECT_PREFIX}:`)
        || customId.startsWith(`${APPEAL_CASE_SELECT_PREFIX}:`)
        || customId.startsWith(`${APPEAL_INTAKE_MODAL_PREFIX}:`)
        || customId.startsWith(`${APPEAL_STAFF_IN_REVIEW_PREFIX}:`)
        || customId.startsWith(`${APPEAL_STAFF_ACCEPT_PREFIX}:`)
        || customId.startsWith(`${APPEAL_STAFF_REJECT_PREFIX}:`)
        || customId.startsWith(`${APPEAL_STAFF_NOTE_MODAL_PREFIX}:`);
}

export async function handleAppealInteraction(interaction: Interaction, client: Client) {
    if (interaction.isButton()) {
        if (interaction.customId === APPEAL_PANEL_BUTTON_ID) {
            await handlePanelStart(interaction);
            return;
        }
        if (interaction.customId === APPEAL_SHARED_PANEL_BUTTON_ID) {
            await handleSharedPanelStart(interaction);
            return;
        }
        if (interaction.customId.startsWith(`${APPEAL_STAFF_IN_REVIEW_PREFIX}:`)) {
            await handleStaffInReview(interaction, client);
            return;
        }
        if (interaction.customId.startsWith(`${APPEAL_STAFF_ACCEPT_PREFIX}:`)) {
            await showStaffDecisionModal(interaction, 'ACCEPTED');
            return;
        }
        if (interaction.customId.startsWith(`${APPEAL_STAFF_REJECT_PREFIX}:`)) {
            await showStaffDecisionModal(interaction, 'REJECTED');
        }
        return;
    }

    if (interaction.isStringSelectMenu()) {
        if (interaction.customId.startsWith(`${APPEAL_SHARED_CATEGORY_SELECT_PREFIX}:`)) {
            await handleSharedCategorySelect(interaction);
            return;
        }
        if (interaction.customId.startsWith(`${APPEAL_CASE_SELECT_PREFIX}:`)) {
            await handleCaseSelect(interaction);
            return;
        }
    }

    if (interaction.isModalSubmit()) {
        if (interaction.customId.startsWith(`${APPEAL_INTAKE_MODAL_PREFIX}:`)) {
            await handleIntakeModal(interaction, client);
            return;
        }
        if (interaction.customId.startsWith(`${APPEAL_STAFF_NOTE_MODAL_PREFIX}:`)) {
            await handleStaffDecisionModal(interaction, client);
        }
    }
}
