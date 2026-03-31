import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonInteraction,
    ButtonStyle,
    EmbedBuilder,
    GuildMember,
    Message,
} from 'discord.js';
import { logAuditEvent } from '../utils/auditLog';
import { prisma } from '../utils/database';
import { getGuildLocale, t } from '../utils/i18n';
import {
    AI_CATEGORIES,
    createModerationCase,
    ensureModeratorAccess,
    getModerationRuntimeSnapshot,
    isMissingModerationTableError,
    parseJsonObject,
    timeoutMember,
} from './ModerationService';

type AiCategory = (typeof AI_CATEGORIES)[number];

type AiSignal = {
    category: AiCategory;
    score: number;
};

type AiAssessment = {
    summary: string;
    confidence: number;
    categories: AiSignal[];
};

const AI_ACTION_PREFIX = 'ai_mod:';
const AI_ALERT_COOLDOWN_MS = 5 * 60_000;
const alertState = new Map<string, { signature: string; sentAt: number }>();

function buildAiActionRow(locale: 'ru' | 'en', messageId: string) {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(`${AI_ACTION_PREFIX}dismiss:${messageId}`).setLabel(t(locale, 'ai.action.dismiss')).setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`${AI_ACTION_PREFIX}false_positive:${messageId}`).setLabel(t(locale, 'ai.action.falsePositive')).setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`${AI_ACTION_PREFIX}warn:${messageId}`).setLabel(t(locale, 'ai.action.deleteWarn')).setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`${AI_ACTION_PREFIX}timeout:${messageId}`).setLabel(t(locale, 'ai.action.deleteTimeout')).setStyle(ButtonStyle.Danger)
    );
}

function buildDisabledAiActionRow(locale: 'ru' | 'en', messageId: string, action: string) {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(`${AI_ACTION_PREFIX}done_dismiss:${messageId}`).setLabel(action === 'dismiss' ? t(locale, 'ai.action.dismissed') : t(locale, 'ai.action.dismiss')).setStyle(ButtonStyle.Secondary).setDisabled(true),
        new ButtonBuilder().setCustomId(`${AI_ACTION_PREFIX}done_false_positive:${messageId}`).setLabel(t(locale, 'ai.action.falsePositive')).setStyle(ButtonStyle.Secondary).setDisabled(true),
        new ButtonBuilder().setCustomId(`${AI_ACTION_PREFIX}done_warn:${messageId}`).setLabel(action === 'warn' ? t(locale, 'ai.action.warned') : t(locale, 'ai.action.deleteWarn')).setStyle(ButtonStyle.Primary).setDisabled(true),
        new ButtonBuilder().setCustomId(`${AI_ACTION_PREFIX}done_timeout:${messageId}`).setLabel(action === 'timeout' ? t(locale, 'ai.action.timedOut') : t(locale, 'ai.action.deleteTimeout')).setStyle(ButtonStyle.Danger).setDisabled(true)
    );
}

function sanitizeAiAssessment(assessment: AiAssessment | null): AiAssessment | null {
    if (!assessment || typeof assessment.summary !== 'string' || typeof assessment.confidence !== 'number' || !Array.isArray(assessment.categories)) {
        return null;
    }

    const categories = assessment.categories
        .filter((entry): entry is AiSignal => typeof entry?.category === 'string' && typeof entry?.score === 'number')
        .filter((entry) => (AI_CATEGORIES as readonly string[]).includes(entry.category));

    return {
        summary: assessment.summary.trim().slice(0, 500),
        confidence: Math.max(0, Math.min(100, Math.round(assessment.confidence))),
        categories,
    };
}

function parseIncidentCategories(value: string | null) {
    if (!value) return [];
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function getEnvKey(provider: string | null) {
    switch ((provider || '').toLowerCase()) {
        case 'gemini':
            return process.env.GEMINI_API_KEY || null;
        case 'openai':
            return process.env.OPENAI_API_KEY || null;
        default:
            return null;
    }
}

function buildPrompt(content: string, enabledCategories: string[], customPolicyPrompt: string | null) {
    return [
        'You are a moderation classifier for Discord messages.',
        'Return strict JSON only with this shape: {"summary":"string","confidence":0-100,"categories":[{"category":"one_of_enabled_categories","score":0-100}]}',
        `Enabled categories: ${enabledCategories.join(', ')}`,
        customPolicyPrompt ? `Server policy: ${customPolicyPrompt}` : null,
        `Message: ${content}`,
    ]
        .filter(Boolean)
        .join('\n');
}

async function callGemini(model: string, apiKey: string, prompt: string): Promise<AiAssessment | null> {
    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${apiKey}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                generationConfig: {
                    responseMimeType: 'application/json',
                },
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
            }),
        }
    );

    if (!response.ok) {
        throw new Error(`Gemini moderation request failed (${response.status})`);
    }

    const payload = (await response.json()) as any;
    const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof text !== 'string') return null;
    return sanitizeAiAssessment(parseJsonObject<AiAssessment>(text));
}

async function callOpenAi(model: string, apiKey: string, prompt: string): Promise<AiAssessment | null> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model,
            response_format: { type: 'json_object' },
            messages: [
                {
                    role: 'system',
                    content: 'You are a moderation classifier. Return strict JSON only.',
                },
                {
                    role: 'user',
                    content: prompt,
                },
            ],
            temperature: 0.1,
        }),
    });

    if (!response.ok) {
        throw new Error(`OpenAI moderation request failed (${response.status})`);
    }

    const payload = (await response.json()) as any;
    const text = payload?.choices?.[0]?.message?.content;
    if (typeof text !== 'string') return null;
    return sanitizeAiAssessment(parseJsonObject<AiAssessment>(text));
}

async function assessMessage(provider: string, model: string, apiKey: string, prompt: string) {
    if (provider === 'gemini') {
        return callGemini(model, apiKey, prompt);
    }

    if (provider === 'openai') {
        return callOpenAi(model, apiKey, prompt);
    }

    return null;
}

function excerpt(content: string, max = 280) {
    return content.length <= max ? content : `${content.slice(0, max)}...`;
}

function buildAlertSignature(triggered: AiSignal[], summary: string) {
    return JSON.stringify({
        summary: summary.trim().slice(0, 300),
        categories: triggered
            .map((entry) => ({
                category: entry.category,
                score: Math.round(entry.score),
            }))
            .sort((left, right) => left.category.localeCompare(right.category)),
    });
}

async function sendAiAlert(message: Message, assessment: AiAssessment, triggered: AiSignal[], provider: string, model: string) {
    const locale = await getGuildLocale(message.guild?.id);
    const route = await prisma.auditTagRoute.findUnique({
        where: {
            guildId_tag: {
                guildId: message.guild!.id,
                tag: 'ai_moderation',
            },
        },
    }).catch((error) => {
        if (isMissingModerationTableError(error)) {
            return null;
        }

        throw error;
    });

    if (!route || !route.enabled) return;

    const channel = await message.client.channels.fetch(route.channelId).catch(() => null);
    if (!channel || !channel.isTextBased() || !('send' in channel)) return;

    const categories = triggered
        .map((entry) => `${entry.category} (${entry.score})`)
        .join(', ');

    const embed = new EmbedBuilder()
        .setColor(0x1abc9c)
        .setTitle(t(locale, 'ai.alert.title'))
        .setDescription(assessment.summary || t(locale, 'ai.alert.summaryFallback'))
        .addFields(
            { name: t(locale, 'ai.alert.author'), value: `<@${message.author.id}> (\`${message.author.id}\`)`, inline: false },
            { name: t(locale, 'ai.alert.channel'), value: `<#${message.channel.id}>`, inline: true },
            { name: t(locale, 'ai.alert.confidence'), value: `${assessment.confidence}`, inline: true },
            { name: t(locale, 'ai.alert.categories'), value: categories || t(locale, 'ai.alert.none'), inline: false },
            { name: t(locale, 'ai.alert.excerpt'), value: `\`\`\`${excerpt(message.content, 900)}\`\`\``.slice(0, 1024), inline: false },
            { name: t(locale, 'ai.alert.jump'), value: `[${t(locale, 'ai.alert.openMessage')}](${message.url})`, inline: false },
        )
        .setFooter({ text: `${provider}/${model}` })
        .setTimestamp();

    await (channel as { send: (payload: unknown) => Promise<unknown> }).send({
        embeds: [embed],
        components: [buildAiActionRow(locale, message.id)],
    });
}

export function isAiModerationButton(customId: string) {
    return customId.startsWith(AI_ACTION_PREFIX);
}

export async function handleAiModerationButton(interaction: ButtonInteraction) {
    const locale = await getGuildLocale(interaction.guildId);
    if (!interaction.guildId || !interaction.guild || !(interaction.member instanceof GuildMember)) {
        await interaction.reply({ content: t(locale, 'ai.error.guildRequired'), ephemeral: true });
        return;
    }

    const [prefix, action, messageId] = interaction.customId.split(':');
    if (prefix !== 'ai_mod' || !action || !messageId) return;

    const allowed = await ensureModeratorAccess(interaction.guildId, interaction.member, {
        accessGroup: 'moderation',
        accessKey: 'ai_review',
        requiredAccessLevel: 50,
    }).catch(() => false);

    if (!allowed) {
        await interaction.reply({ content: t(locale, 'ai.error.accessDenied'), ephemeral: true });
        return;
    }

    const incident = await prisma.aiModerationIncident.findUnique({
        where: {
            guildId_messageId: {
                guildId: interaction.guildId,
                messageId,
            },
        },
    }).catch((error) => {
        if (isMissingModerationTableError(error)) {
            return null;
        }

        throw error;
    });

    if (!incident) {
        await interaction.reply({ content: t(locale, 'ai.error.incidentMissing'), ephemeral: true });
        return;
    }

    const existingStatus = incident.status?.toUpperCase();
    if (existingStatus !== 'OPEN') {
        await interaction.reply({ content: t(locale, 'ai.error.alreadyResolved', { status: incident.status ?? 'UNKNOWN' }), ephemeral: true });
        return;
    }

    let decision = 'DISMISSED';
    let decisionText = t(locale, 'ai.action.dismissed');

    const targetChannel = await interaction.guild.channels.fetch(incident.channelId).catch(() => null);
    const targetMessage =
        targetChannel && targetChannel.isTextBased() && 'messages' in targetChannel
            ? await targetChannel.messages.fetch(messageId).catch(() => null)
            : null;
    const targetMember = await interaction.guild.members.fetch(incident.authorId).catch(() => null);

    const parsedCategories = parseIncidentCategories(incident.categories);
    const reason = incident.summary || `AI moderation incident: ${parsedCategories.map((entry: any) => entry.category).join(', ')}`;

    switch (action) {
        case 'false_positive':
            decision = 'FALSE_POSITIVE';
            decisionText = t(locale, 'ai.action.falsePositiveMarked');
            break;
        case 'warn':
            if (targetMessage?.deletable) {
                await targetMessage.delete().catch(() => null);
            }
            await createModerationCase({
                guildId: interaction.guildId,
                actionType: 'WARN',
                source: 'ai_review',
                actorUserId: interaction.user.id,
                targetUserId: incident.authorId,
                reason,
                metadata: {
                    aiIncidentId: incident.id,
                    messageId,
                    categories: parsedCategories,
                },
            }).catch((error) => {
                if (!isMissingModerationTableError(error)) {
                    throw error;
                }
            });
            decision = 'CONFIRMED_WARN';
            decisionText = t(locale, 'ai.action.deleteWarned');
            break;
        case 'timeout':
            if (targetMessage?.deletable) {
                await targetMessage.delete().catch(() => null);
            }
            if (targetMember) {
                await timeoutMember({
                    member: targetMember,
                    actorUserId: interaction.user.id,
                    durationMinutes: 60,
                    reason,
                }).catch((error) => {
                    if (!isMissingModerationTableError(error)) {
                        throw error;
                    }
                });
            }
            decision = 'CONFIRMED_TIMEOUT';
            decisionText = t(locale, 'ai.action.deleteTimedOut');
            break;
        default:
            decision = 'DISMISSED';
            decisionText = t(locale, 'ai.action.dismissed');
            break;
    }

    await prisma.aiModerationIncident.update({
        where: { id: incident.id },
        data: {
            status: decision,
            reviewerId: interaction.user.id,
            reviewedAt: new Date(),
        },
    }).catch((error) => {
        if (!isMissingModerationTableError(error)) {
            throw error;
        }
    });

    const originalEmbed = interaction.message.embeds[0]
        ? EmbedBuilder.from(interaction.message.embeds[0])
        : new EmbedBuilder().setTitle(t(locale, 'ai.alert.title'));
    originalEmbed.addFields({
        name: t(locale, 'ai.review.field'),
        value: t(locale, 'ai.review.value', { decision: decisionText, userId: interaction.user.id }),
        inline: false,
    });

    await interaction.update({
        embeds: [originalEmbed],
        components: [buildDisabledAiActionRow(locale, messageId, action)],
    });

    await logAuditEvent(interaction.client, {
        guildId: interaction.guildId,
        tag: 'ai_moderation',
        actorId: interaction.user.id,
        targetId: incident.authorId,
        channelId: incident.channelId,
        messageId,
        payload: {
            event: 'ai_moderation_review',
            reason: decisionText,
            aiIncidentId: incident.id,
            reviewAction: action,
        },
        severity: 'WARN',
    });
}

export async function processMessageForAiModeration(message: Message, source: 'create' | 'update') {
    if (!message.guild || message.author.bot || !message.member || !message.content.trim()) return;

    const snapshot = await getModerationRuntimeSnapshot(message.guild.id).catch((error) => {
        console.error('[AiModerationService] Failed to load moderation snapshot:', error);
        return null;
    });
    if (!snapshot?.aiConfig?.enabled) return;
    if (source === 'update' && !snapshot.aiConfig.scanEdits) return;

    const roleIds = new Set(message.member.roles.cache.keys());
    const aiConfig = snapshot.aiConfig;
    if (
        aiConfig.exemptUsers.includes(message.author.id) ||
        aiConfig.exemptRoles.some((roleId) => roleIds.has(roleId)) ||
        (aiConfig.includedChannels.length > 0 && !aiConfig.includedChannels.includes(message.channel.id)) ||
        aiConfig.excludedChannels.includes(message.channel.id)
    ) {
        return;
    }

    const provider = aiConfig.provider?.toLowerCase() ?? '';
    const model = aiConfig.model ?? '';
    const apiKey = getEnvKey(provider);
    if (!provider || !model || !apiKey) return;

    const enabledCategories = snapshot.aiCategories.filter((category) => category.enabled);
    if (!enabledCategories.length) return;

    try {
        const assessment = await assessMessage(
            provider,
            model,
            apiKey,
            buildPrompt(message.content, enabledCategories.map((category) => category.category), aiConfig.customPolicyPrompt)
        );

        if (!assessment) return;

        const triggered = assessment.categories.filter((signal) => {
            const configured = enabledCategories.find((category) => category.category === signal.category);
            if (!configured) return false;
            const threshold = configured.threshold ?? aiConfig.defaultThreshold;
            return signal.score >= threshold;
        });

        if (!triggered.length) return;

        const alertKey = `${message.guild.id}:${message.id}`;
        const signature = buildAlertSignature(triggered, assessment.summary);
        const inMemoryAlert = alertState.get(alertKey);
        const existingIncident = await prisma.aiModerationIncident.findUnique({
            where: {
                guildId_messageId: {
                    guildId: message.guild.id,
                    messageId: message.id,
                },
            },
        }).catch((error) => {
            if (isMissingModerationTableError(error)) {
                return null;
            }

            throw error;
        });
        const existingSignature = existingIncident
            ? buildAlertSignature(parseIncidentCategories(existingIncident.categories) as AiSignal[], existingIncident.summary ?? '')
            : null;
        const shouldSuppressAlert =
            (existingIncident?.status?.toUpperCase() === 'OPEN' && existingSignature === signature) ||
            (inMemoryAlert?.signature === signature && Date.now() - inMemoryAlert.sentAt < AI_ALERT_COOLDOWN_MS);

        try {
            await prisma.aiModerationIncident.upsert({
                where: {
                    guildId_messageId: {
                        guildId: message.guild.id,
                        messageId: message.id,
                    },
                },
                update: {
                    channelId: message.channel.id,
                    authorId: message.author.id,
                    excerpt: excerpt(message.content),
                    summary: assessment.summary,
                    categories: JSON.stringify(triggered),
                    provider,
                    model,
                    confidence: assessment.confidence,
                    status: 'OPEN',
                },
                create: {
                    guildId: message.guild.id,
                    messageId: message.id,
                    channelId: message.channel.id,
                    authorId: message.author.id,
                    excerpt: excerpt(message.content),
                    summary: assessment.summary,
                    categories: JSON.stringify(triggered),
                    provider,
                    model,
                    confidence: assessment.confidence,
                    status: 'OPEN',
                },
            });
        } catch (error) {
            if (!isMissingModerationTableError(error)) {
                throw error;
            }
        }

        await logAuditEvent(message.client, {
            guildId: message.guild.id,
            tag: 'ai_moderation',
            actorId: null,
            targetId: message.author.id,
            channelId: message.channel.id,
            messageId: message.id,
            payload: {
                event: source === 'update' ? 'ai_moderation_edit_alert' : 'ai_moderation_alert',
                reason: assessment.summary,
                contentAfter: message.content,
                excerpt: excerpt(message.content),
                categories: triggered,
                confidence: assessment.confidence,
                provider,
                model,
            },
            severity: 'WARN',
        });

        if (!shouldSuppressAlert) {
            await sendAiAlert(message, assessment, triggered, provider, model);
            alertState.set(alertKey, { signature, sentAt: Date.now() });
        }
    } catch (error) {
        console.error('[AiModerationService] Failed to process AI moderation:', error);
    }
}
