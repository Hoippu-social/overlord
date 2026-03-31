import { ChannelType, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { unlockChannel } from '../../services/ModerationService';
import { logAuditEvent } from '../../utils/auditLog';
import { localizeDescription } from '../../utils/commandLocalizations';
import { getInteractionLocale, t } from '../../utils/i18n';
import { buildStaffEmbed } from '../../utils/staffEmbeds';
import { Command } from '../../utils/types';

function isGuildChannel(channel: unknown): channel is Parameters<typeof unlockChannel>[0]['channel'] {
    return Boolean(channel && typeof channel === 'object' && 'guild' in channel);
}

const command: Command = {
    data: localizeDescription(
        new SlashCommandBuilder()
            .setName('unlock')
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
            .setDMPermission(false)
            .addChannelOption((option) =>
                localizeDescription(option.setName('channel').setRequired(false).addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement), {
                    en: 'Channel to unlock, defaults to current',
                    ru: 'Канал для открытия, по умолчанию текущий',
                })
            )
            .addStringOption((option) =>
                localizeDescription(option.setName('reason').setRequired(false).setMaxLength(500), {
                    en: 'Reason',
                    ru: 'Причина',
                })
            ),
        {
            en: 'Unlock a text channel for @everyone',
            ru: 'Открыть текстовый канал для @everyone',
        }
    ),
    accessGroup: 'moderation',
    accessKey: 'unlock',
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

        const moderationCase = await unlockChannel({
            channel: selectedChannel,
            actorUserId: interaction.user.id,
            reason,
        });

        await logAuditEvent(interaction.client, {
            guildId: interaction.guild.id,
            tag: 'moderation',
            actorId: interaction.user.id,
            channelId: selectedChannel.id,
            payload: {
                event: 'unlock',
                caseNumber: moderationCase.caseNumber,
                reason,
            },
            severity: 'INFO',
        });

        await interaction.reply({
            embeds: [
                buildStaffEmbed({
                    actor: interaction.user,
                    title: t(locale, 'moderation.unlock.title'),
                    color: 0x22c55e,
                    description: [''],
                    fields: [
                        { label: t(locale, 'moderation.action.channel'), value: `<#${selectedChannel.id}>` },
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
