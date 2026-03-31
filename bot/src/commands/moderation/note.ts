import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { clearModeratorNote, createModeratorNote, listCasesForUser } from '../../services/ModerationService';
import { localizeDescription } from '../../utils/commandLocalizations';
import { getInteractionLocale, t } from '../../utils/i18n';
import { buildStaffEmbed } from '../../utils/staffEmbeds';
import { Command } from '../../utils/types';

const command: Command = {
    data: localizeDescription(
        new SlashCommandBuilder()
            .setName('note')
            .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
            .setDMPermission(false)
            .addSubcommand((sub: any) =>
                localizeDescription(sub.setName('add'), {
                    en: 'Add a private moderator note',
                    ru: 'Добавить приватную заметку модератора',
                })
                    .addUserOption((option: any) =>
                        localizeDescription(option.setName('user').setRequired(true), {
                            en: 'Target member',
                            ru: 'Целевой участник',
                        })
                    )
                    .addStringOption((option: any) =>
                        localizeDescription(option.setName('text').setRequired(true).setMaxLength(1000), {
                            en: 'Note text',
                            ru: 'Текст заметки',
                        })
                    )
            )
            .addSubcommand((sub: any) =>
                localizeDescription(sub.setName('list'), {
                    en: 'List private notes for a member',
                    ru: 'Показать приватные заметки участника',
                })
                    .addUserOption((option: any) =>
                        localizeDescription(option.setName('user').setRequired(true), {
                            en: 'Target member',
                            ru: 'Целевой участник',
                        })
                    )
            )
            .addSubcommand((sub: any) =>
                localizeDescription(sub.setName('remove'), {
                    en: 'Clear a private note by case id',
                    ru: 'Снять приватную заметку по номеру кейса',
                })
                    .addIntegerOption((option: any) =>
                        localizeDescription(option.setName('note_id').setRequired(true).setMinValue(1), {
                            en: 'Note case number',
                            ru: 'Номер кейса заметки',
                        })
                    )
            ),
        {
            en: 'Manage private moderation notes',
            ru: 'Управлять приватными заметками модерации',
        }
    ),
    accessGroup: 'moderation',
    accessKey: 'note',
    requiredAccessLevel: 30,
    async execute(interaction) {
        const locale = await getInteractionLocale(interaction);
        if (!interaction.guildId) {
            await interaction.reply({ content: t(locale, 'general.guildOnly'), ephemeral: true });
            return;
        }

        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'add') {
            const target = interaction.options.getUser('user', true);
            const text = interaction.options.getString('text', true);
            const noteCase = await createModeratorNote(interaction.guildId, interaction.user.id, target.id, text);
            await interaction.reply({
                embeds: [
                    buildStaffEmbed({
                        actor: interaction.user,
                        title: t(locale, 'moderation.note.created.title'),
                        color: 0x10131a,
                        thumbnailUrl: target.displayAvatarURL({ size: 256 }),
                        description: ['', `**${t(locale, 'staff.case.target')}:** <@${target.id}>`],
                        fields: [
                            { label: t(locale, 'staff.note.case'), value: `#${noteCase.caseNumber}` },
                            { label: t(locale, 'staff.note.reason'), value: text, inline: false },
                        ],
                    }),
                ],
                ephemeral: true,
            });
            return;
        }

        if (subcommand === 'list') {
            const target = interaction.options.getUser('user', true);
            const notes = (await listCasesForUser(interaction.guildId, target.id, 25)).filter((row) => row.actionType === 'NOTE' && row.status === 'INFO');
            if (!notes.length) {
                await interaction.reply({ content: t(locale, 'staff.note.empty'), ephemeral: true });
                return;
            }

            await interaction.reply({
                embeds: [
                    buildStaffEmbed({
                        actor: interaction.user,
                        title: t(locale, 'moderation.note.list.title'),
                        color: 0x10131a,
                        thumbnailUrl: target.displayAvatarURL({ size: 256 }),
                        description: ['', `**${t(locale, 'staff.case.target')}:** <@${target.id}>`],
                        fields: notes.map((note) => ({
                            label: `#${note.caseNumber}`,
                            value: note.reason || t(locale, 'audit.moderation.notSpecified'),
                            inline: false,
                        })),
                    }),
                ],
                ephemeral: true,
            });
            return;
        }

        const noteId = interaction.options.getInteger('note_id', true);
        const cleared = await clearModeratorNote(interaction.guildId, interaction.user.id, noteId);
        await interaction.reply({
            embeds: [
                buildStaffEmbed({
                    actor: interaction.user,
                    title: t(locale, 'moderation.note.cleared.title'),
                    color: 0x10131a,
                    description: ['', `**${t(locale, 'staff.case.target')}:** <@${cleared.targetUserId}>`],
                    fields: [
                        { label: t(locale, 'staff.note.case'), value: `#${cleared.caseNumber}` },
                        { label: t(locale, 'staff.note.reason'), value: cleared.reason ?? t(locale, 'audit.moderation.notSpecified'), inline: false },
                    ],
                }),
            ],
            ephemeral: true,
        });
    },
};

export default command;
