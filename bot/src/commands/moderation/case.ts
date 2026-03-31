import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { getCaseByNumber } from '../../services/ModerationService';
import { localizeDescription } from '../../utils/commandLocalizations';
import { getInteractionLocale, t } from '../../utils/i18n';
import { localizeModerationAction, localizeModerationSource, localizeModerationStatus } from '../../utils/moderationHelpers';
import { buildStaffEmbed } from '../../utils/staffEmbeds';
import { Command } from '../../utils/types';

const command: Command = {
    data: localizeDescription(
        new SlashCommandBuilder()
            .setName('case')
            .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
            .setDMPermission(false)
            .addIntegerOption((option) =>
                localizeDescription(option.setName('id').setRequired(true).setMinValue(1), {
                    en: 'Moderation case number',
                    ru: 'Номер модераторского кейса',
                })
            ),
        {
            en: 'Show a moderation case by case number',
            ru: 'Показать модераторский кейс по номеру',
        }
    ),
    accessGroup: 'moderation',
    accessKey: 'case',
    requiredAccessLevel: 30,
    async execute(interaction) {
        const locale = await getInteractionLocale(interaction);
        if (!interaction.guildId) {
            await interaction.reply({ content: t(locale, 'general.guildOnly'), ephemeral: true });
            return;
        }

        const caseNumber = interaction.options.getInteger('id', true);
        const moderationCase = await getCaseByNumber(interaction.guildId, caseNumber);

        if (!moderationCase) {
            await interaction.reply({ content: t(locale, 'staff.case.notFound', { caseNumber }), ephemeral: true });
            return;
        }

        const noteLines = moderationCase.notes.length
            ? moderationCase.notes.map((note) => `${note.actorUserId ?? t(locale, 'audit.moderation.system')}: ${note.note}`).join('\n')
            : t(locale, 'audit.moderation.notSpecified');

        const embed = buildStaffEmbed({
            actor: interaction.user,
            title: t(locale, 'staff.case.title'),
            color: 0x10131a,
            fields: [
                { label: t(locale, 'staff.case.case'), value: `#${moderationCase.caseNumber}` },
                { label: t(locale, 'staff.case.action'), value: localizeModerationAction(locale, moderationCase.actionType) },
                { label: t(locale, 'staff.case.status'), value: localizeModerationStatus(locale, moderationCase.status) },
                { label: t(locale, 'staff.case.source'), value: localizeModerationSource(locale, moderationCase.source) },
                { label: t(locale, 'staff.case.target'), value: moderationCase.targetUserId ? `<@${moderationCase.targetUserId}>` : t(locale, 'audit.moderation.notSpecified') },
                { label: t(locale, 'staff.case.actor'), value: moderationCase.actorUserId ? `<@${moderationCase.actorUserId}>` : t(locale, 'audit.moderation.system') },
                { label: t(locale, 'staff.case.related'), value: moderationCase.relatedCaseId ? `#${moderationCase.relatedCaseId}` : t(locale, 'audit.moderation.notSpecified') },
                { label: t(locale, 'staff.case.expires'), value: moderationCase.expiresAt ? new Date(moderationCase.expiresAt).toLocaleString(locale === 'ru' ? 'ru-RU' : 'en-US') : t(locale, 'audit.moderation.notSpecified') },
                { label: t(locale, 'staff.case.reason'), value: moderationCase.reason ?? t(locale, 'audit.moderation.notSpecified'), inline: false },
                { label: t(locale, 'staff.case.notes'), value: noteLines, inline: false },
            ],
        });

        await interaction.reply({ embeds: [embed], ephemeral: true });
    },
};

export default command;
