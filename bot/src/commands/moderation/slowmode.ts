import { ChannelType, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { logAuditEvent } from '../../utils/auditLog';
import { setChannelSlowmode } from '../../services/ModerationService';
import { localizeDescription } from '../../utils/commandLocalizations';
import { getInteractionLocale, t } from '../../utils/i18n';
import { buildStaffEmbed } from '../../utils/staffEmbeds';
import { Command } from '../../utils/types';

function isGuildChannel(channel: unknown): channel is Parameters<typeof setChannelSlowmode>[0]['channel'] {
    return Boolean(channel && typeof channel === 'object' && 'guild' in channel);
}

const command: Command = {
    data: localizeDescription(
        new SlashCommandBuilder()
            .setName('slowmode')
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
            .setDMPermission(false)
            .addIntegerOption((option) =>
                localizeDescription(option.setName('seconds').setRequired(true).setMinValue(0).setMaxValue(21600), {
                    en: 'Slowmode in seconds, use 0 to clear',
                    ru: 'Медленный режим в секундах, 0 чтобы снять',
                })
            )
            .addChannelOption((option) =>
                localizeDescription(option.setName('channel').setRequired(false).addChannelTypes(ChannelType.GuildText, ChannelType.PublicThread, ChannelType.PrivateThread), {
                    en: 'Channel to update, defaults to current',
                    ru: 'Канал для обновления, по умолчанию текущий',
                })
            )
            .addStringOption((option) =>
                localizeDescription(option.setName('reason').setRequired(false).setMaxLength(500), {
                    en: 'Reason',
                    ru: 'Причина',
                })
            ),
        {
            en: 'Set slowmode for a text channel',
            ru: 'Изменить slowmode для текстового канала',
        }
    ),
    accessGroup: 'moderation',
    accessKey: 'slowmode',
    requiredAccessLevel: 50,
    async execute(interaction) {
        const locale = await getInteractionLocale(interaction);
        if (!interaction.guild) {
            await interaction.reply({
                embeds: [
                    buildStaffEmbed({
                        actor: interaction.user,
                        title: t(locale, 'staff.error.title'),
                        color: 0xef4444,
                        description: ['', t(locale, 'general.guildOnly')],
                    }),
                ],
                ephemeral: true,
            });
            return;
        }

        const seconds = interaction.options.getInteger('seconds', true);
        const selectedChannel = interaction.options.getChannel('channel', false) ?? interaction.channel;
        const reason = interaction.options.getString('reason');

        if (!isGuildChannel(selectedChannel)) {
            await interaction.reply({
                embeds: [
                    buildStaffEmbed({
                        actor: interaction.user,
                        title: t(locale, 'staff.error.title'),
                        color: 0xef4444,
                        description: ['', t(locale, 'general.textChannelOnly')],
                    }),
                ],
                ephemeral: true,
            });
            return;
        }

        const moderationCase = await setChannelSlowmode({
            channel: selectedChannel,
            actorUserId: interaction.user.id,
            seconds,
            reason,
        });

        await logAuditEvent(interaction.client, {
            guildId: interaction.guild.id,
            tag: 'moderation',
            actorId: interaction.user.id,
            channelId: selectedChannel.id,
            payload: {
                event: seconds > 0 ? 'slowmode' : 'slowmode_clear',
                caseNumber: moderationCase.caseNumber,
                reason,
                seconds,
            },
            severity: 'INFO',
        });

        await interaction.reply({
            embeds: [
                buildStaffEmbed({
                    actor: interaction.user,
                    title: t(locale, 'moderation.slowmode.title'),
                    color: 0x38bdf8,
                    description: [''],
                    fields: [
                        { label: t(locale, 'moderation.action.channel'), value: `<#${selectedChannel.id}>` },
                        { label: t(locale, 'moderation.action.duration'), value: seconds > 0 ? `${seconds}s` : t(locale, 'audit.moderation.cleared') },
                        { label: t(locale, 'moderation.action.reason'), value: reason ?? t(locale, 'audit.moderation.notSpecified') },
                        { label: t(locale, 'moderation.action.case'), value: `#${moderationCase.caseNumber}` },
                    ],
                }),
            ],
            ephemeral: true,
        });
    },
};

export default command;
