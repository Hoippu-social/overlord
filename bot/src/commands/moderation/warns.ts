import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType,
    EmbedBuilder,
    PermissionFlagsBits,
    SlashCommandBuilder,
} from 'discord.js';
import { getPunishmentHistory } from '../../services/ModerationService';
import { localizeDescription } from '../../utils/commandLocalizations';
import { getInteractionLocale, t } from '../../utils/i18n';
import { localizeModerationAction } from '../../utils/moderationHelpers';
import { Command } from '../../utils/types';

const USER_ID_REGEX = /^\d{16,20}$/;
const USER_MENTION_REGEX = /^<@!?(\d{16,20})>$/;
const MAX_REASON_LENGTH = 850;
const PAGE_SIZE = 5;
const MAX_HISTORY_FETCH = 250;

function parseUserIdInput(value: string) {
    const trimmed = value.trim();
    const mentionMatch = trimmed.match(USER_MENTION_REGEX);
    if (mentionMatch) {
        return mentionMatch[1];
    }

    if (USER_ID_REGEX.test(trimmed)) {
        return trimmed;
    }

    return null;
}

function formatHistoryDate(locale: 'ru' | 'en', value: Date) {
    return new Intl.DateTimeFormat(locale === 'ru' ? 'ru-RU' : 'en-US', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    }).format(value);
}

function truncate(value: string, max: number) {
    if (value.length <= max) return value;
    return `${value.slice(0, max - 3)}...`;
}

function normalizeReason(value: string) {
    return value.replace(/```/g, '```\u200b');
}

function buildPaginationRow(locale: 'ru' | 'en', customIdBase: string, currentPage: number, totalPages: number) {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId(`${customIdBase}:prev`)
            .setLabel(t(locale, 'staff.pagination.prev'))
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(currentPage === 0),
        new ButtonBuilder()
            .setCustomId(`${customIdBase}:next`)
            .setLabel(t(locale, 'staff.pagination.next'))
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(currentPage >= totalPages - 1),
    );
}

const command: Command = {
    data: localizeDescription(
        new SlashCommandBuilder()
            .setName('warns')
            .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
            .setDMPermission(false)
            .addStringOption((option) =>
                localizeDescription(option.setName('target').setRequired(false), {
                    en: 'Target user mention or ID',
                    ru: 'Упоминание пользователя или его ID',
                })
            ),
        {
            en: 'Show punishment history',
            ru: 'Показать историю наказаний',
        }
    ),
    accessGroup: 'moderation',
    accessKey: 'warns',
    requiredAccessLevel: 30,
    async execute(interaction) {
        const locale = await getInteractionLocale(interaction);
        if (!interaction.guildId) {
            await interaction.reply({ content: t(locale, 'general.guildOnly'), ephemeral: true });
            return;
        }

        const targetInput = interaction.options.getString('target');

        let resolvedTargetId = interaction.user.id;
        let resolvedTargetUser = interaction.user;

        if (targetInput) {
            const parsedId = parseUserIdInput(targetInput);
            if (!parsedId) {
                await interaction.reply({
                    content: t(locale, 'staff.warns.invalidTarget'),
                    ephemeral: true,
                });
                return;
            }

            resolvedTargetId = parsedId;
            const fetchedUser = await interaction.client.users.fetch(parsedId).catch(() => null);
            if (fetchedUser) {
                resolvedTargetUser = fetchedUser;
            }
        }

        const history = await getPunishmentHistory(interaction.guildId, resolvedTargetId, MAX_HISTORY_FETCH);

        const summary = locale === 'ru'
            ? [
                `Мут - \`${history.counts.mutes} шт\``,
                `Варн - \`${history.counts.warns} шт\``,
                `Кик - \`${history.counts.kicks} шт\``,
                `Бан - \`${history.counts.bans} шт\``,
                `Тайм-аут - \`${history.counts.timeouts} шт\``,
            ].join(', ')
            : [
                `Mutes - \`${history.counts.mutes}\``,
                `Warns - \`${history.counts.warns}\``,
                `Kicks - \`${history.counts.kicks}\``,
                `Bans - \`${history.counts.bans}\``,
                `Timeouts - \`${history.counts.timeouts}\``,
            ].join(', ');

        const targetLabel = resolvedTargetUser?.tag ?? resolvedTargetId;
        const totalPages = Math.max(1, Math.ceil(history.cases.length / PAGE_SIZE));
        let currentPage = 0;

        const buildEmbed = (page: number) => {
            const start = page * PAGE_SIZE;
            const pageCases = history.cases.slice(start, start + PAGE_SIZE);
            const embed = new EmbedBuilder()
                .setColor(0x10131a)
                .setAuthor({
                    name: interaction.user.tag,
                    iconURL: interaction.user.displayAvatarURL({ size: 128 }),
                })
                .setDescription(
                    locale === 'ru'
                        ? `**MODERATION | История Наказаний - ${targetLabel}**\n**За всё время:**\n${summary}.`
                        : `**MODERATION | Punishment History - ${targetLabel}**\n**All time:**\n${summary}.`
                );

            const targetAvatar = resolvedTargetUser?.displayAvatarURL({ size: 256 });
            if (targetAvatar) {
                embed.setThumbnail(targetAvatar);
            }

            if (!history.cases.length) {
                embed.addFields({
                    name: '\u200b',
                    value: `> **${locale === 'ru' ? 'ИСТОРИЯ' : 'HISTORY'}**\n\`\`\`text\n${t(locale, 'staff.warns.empty')}\n\`\`\``,
                    inline: false,
                });
            } else {
                for (const punishmentCase of pageCases) {
                    const dateLabel = formatHistoryDate(locale, punishmentCase.createdAt);
                    let heading = `\`${localizeModerationAction(locale, punishmentCase.actionType)} #${punishmentCase.caseNumber}\` \`${dateLabel}\``;
                    if (punishmentCase.status !== 'ACTIVE') {
                        heading = `~~${heading}~~`;
                    }

                    const moderatorLabel = punishmentCase.actorUserId ? `<@${punishmentCase.actorUserId}>` : t(locale, 'audit.moderation.system');
                    const reason = normalizeReason(truncate(punishmentCase.reason || t(locale, 'audit.moderation.notSpecified'), MAX_REASON_LENGTH));

                    embed.addFields({
                        name: '\u200b',
                        value: [
                            `> ${heading}`,
                            '>',
                            '```text',
                            `${locale === 'ru' ? 'Причина' : 'Reason'}: ${reason}`,
                            '```',
                            '>',
                            `> **${locale === 'ru' ? 'Модератор' : 'Moderator'}:** ${moderatorLabel}`,
                        ].join('\n'),
                        inline: false,
                    });
                }
            }

            embed.setFooter({
                text: t(locale, 'staff.pagination.footer', {
                    page: Math.min(page + 1, totalPages),
                    pages: totalPages,
                }),
            });

            return embed;
        };

        const customIdBase = `warns:${interaction.id}`;
        const components = totalPages > 1 ? [buildPaginationRow(locale, customIdBase, currentPage, totalPages)] : [];
        await interaction.reply({ embeds: [buildEmbed(currentPage)], components });

        if (totalPages <= 1) {
            return;
        }

        const replyMessage = await interaction.fetchReply();
        if (!replyMessage || !('createMessageComponentCollector' in replyMessage)) {
            return;
        }

        const collector = replyMessage.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 10 * 60 * 1000,
        });

        collector.on('collect', async (buttonInteraction) => {
            if (!buttonInteraction.customId.startsWith(`${customIdBase}:`)) {
                return;
            }

            if (buttonInteraction.user.id !== interaction.user.id) {
                await buttonInteraction.reply({
                    content: t(locale, 'staff.buttons.ownerOnly'),
                    ephemeral: true,
                });
                return;
            }

            if (buttonInteraction.customId.endsWith(':prev')) {
                currentPage = Math.max(0, currentPage - 1);
            } else if (buttonInteraction.customId.endsWith(':next')) {
                currentPage = Math.min(totalPages - 1, currentPage + 1);
            }

            await buttonInteraction.update({
                embeds: [buildEmbed(currentPage)],
                components: [buildPaginationRow(locale, customIdBase, currentPage, totalPages)],
            });
        });

        collector.on('end', async () => {
            await interaction.editReply({
                components: [],
            }).catch(() => null);
        });
    },
};

export default command;
