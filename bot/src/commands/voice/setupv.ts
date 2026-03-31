import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelType,
    EmbedBuilder,
    GuildMember,
    PermissionFlagsBits,
    SlashCommandBuilder,
} from 'discord.js';
import { hasGuildPermissionAccess } from '../../services/ModerationService';
import { localizeDescription } from '../../utils/commandLocalizations';
import { prisma } from '../../utils/database';
import { getGuildLocale, t } from '../../utils/i18n';
import logger from '../../utils/logger';
import { buildStaffEmbed } from '../../utils/staffEmbeds';
import { cacheTempVoiceConfig, clearTempVoiceConfigCache } from '../../utils/tempVoice';
import { Command } from '../../utils/types';

const DEFAULT_CATEGORY = 'Temporary Voice';
const DEFAULT_HUB = 'Join to Create';
const DEFAULT_INTERFACE = 'temp-voice-control';
const DEFAULT_TEMPLATE = 'Room {user}';

const command: Command = {
    data: localizeDescription(
        new SlashCommandBuilder()
            .setName('setupv')
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
            .setDMPermission(false)
            .addStringOption((option) =>
                localizeDescription(option.setName('category'), {
                    en: 'Category name for temp rooms',
                    ru: 'Название категории для временных комнат',
                }).setMaxLength(80)
            )
            .addStringOption((option) =>
                localizeDescription(option.setName('hub'), {
                    en: 'Voice hub channel name',
                    ru: 'Название голосового хаба',
                }).setMaxLength(80)
            )
            .addStringOption((option) =>
                localizeDescription(option.setName('interface'), {
                    en: 'Text channel name for control panel',
                    ru: 'Название текстового канала панели управления',
                }).setMaxLength(80)
            )
            .addStringOption((option) =>
                localizeDescription(option.setName('template'), {
                    en: 'Room name template, use {user} for the owner name',
                    ru: 'Шаблон имени комнаты, используйте {user} для имени владельца',
                }).setMaxLength(90)
            )
            .addIntegerOption((option) =>
                localizeDescription(option.setName('limit'), {
                    en: 'User limit for created rooms (0 = unlimited)',
                    ru: 'Лимит пользователей для создаваемых комнат (0 = без лимита)',
                }).setMinValue(0).setMaxValue(99)
            ) as any,
        {
            en: 'Create hub, category, and control panel for temp rooms',
            ru: 'Создать хаб, категорию и панель управления для временных комнат',
        }
    ),
    accessGroup: 'voice',
    accessKey: 'setupv',
    async execute(interaction) {
        const locale = await getGuildLocale(interaction.guildId);

        if (!interaction.guildId || !interaction.guild) {
            await interaction.reply({ content: t(locale, 'setupv.guildOnly'), ephemeral: true });
            return;
        }

        const member = interaction.member instanceof GuildMember
            ? interaction.member
            : await interaction.guild.members.fetch(interaction.user.id).catch(() => null);

        if (!member) {
            await interaction.reply({ content: t(locale, 'general.memberResolveFailed'), ephemeral: true });
            return;
        }

        if (!hasGuildPermissionAccess(member, PermissionFlagsBits.ManageChannels)) {
            await interaction.reply({ content: t(locale, 'setupv.notManager'), ephemeral: true });
            return;
        }

        await interaction.deferReply({ ephemeral: true });

        const categoryName = interaction.options.getString('category')?.trim() || DEFAULT_CATEGORY;
        const hubName = interaction.options.getString('hub')?.trim() || DEFAULT_HUB;
        const interfaceName = interaction.options.getString('interface')?.trim() || DEFAULT_INTERFACE;
        let template = interaction.options.getString('template')?.trim() || DEFAULT_TEMPLATE;
        const limit = interaction.options.getInteger('limit');

        if (!template.includes('{user}')) {
            template = `${template} {user}`;
        }

        try {
            const existing = await prisma.tempVoiceConfig.findUnique({ where: { guildId: interaction.guildId } });

            if (existing) {
                const ids = [existing.hubChannelId, existing.interfaceChannelId, existing.categoryId].filter(Boolean) as string[];
                for (const id of ids) {
                    const channel = await interaction.guild.channels.fetch(id).catch(() => null);
                    if (channel) {
                        await channel.delete('Recreating temp voice setup');
                    }
                }
            }

            const category = await interaction.guild.channels.create({
                name: categoryName,
                type: ChannelType.GuildCategory,
                reason: 'Temp voice setup',
            });

            const hub = await interaction.guild.channels.create({
                name: hubName,
                type: ChannelType.GuildVoice,
                parent: category.id,
                userLimit: limit ?? 0,
                reason: 'Temp voice hub (join to create)',
            });

            const panel = await interaction.guild.channels.create({
                name: interfaceName,
                type: ChannelType.GuildText,
                parent: category.id,
                reason: 'Temp voice control panel',
            });

            const embed = new EmbedBuilder()
                .setTitle(t(locale, 'setupv.embed.title'))
                .setDescription(t(locale, 'setupv.embed.desc'))
                .setColor(0x9b8cff);

            const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder().setCustomId('tv_claim').setEmoji('👑').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('tv_permit').setEmoji('✅').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('tv_block').setEmoji('🚫').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('tv_limit').setEmoji('👥').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('tv_lock').setEmoji('🔒').setStyle(ButtonStyle.Secondary),
            );

            const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder().setCustomId('tv_rename').setEmoji('✏️').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('tv_hide').setEmoji('🙈').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('tv_kick').setEmoji('👢').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('tv_speak').setEmoji('🎙️').setStyle(ButtonStyle.Secondary),
            );

            await panel.send({ embeds: [embed], components: [row1, row2] });

            const config = await prisma.tempVoiceConfig.upsert({
                where: { guildId: interaction.guildId },
                update: {
                    hubChannelId: hub.id,
                    categoryId: category.id,
                    interfaceChannelId: panel.id,
                    nameTemplate: template,
                    userLimit: limit ?? null,
                },
                create: {
                    guildId: interaction.guildId,
                    hubChannelId: hub.id,
                    categoryId: category.id,
                    interfaceChannelId: panel.id,
                    nameTemplate: template,
                    userLimit: limit ?? null,
                },
            });

            clearTempVoiceConfigCache(interaction.guildId);
            cacheTempVoiceConfig(config);

            const limitValue = limit ?? t(locale, 'general.unlimited');
            await interaction.editReply({
                embeds: [
                    buildStaffEmbed({
                        actor: interaction.user,
                        title: t(locale, 'setupv.embed.title'),
                        color: 0x9b8cff,
                        description: [''],
                        fields: [
                            { label: t(locale, 'setupv.field.category'), value: category.toString() },
                            { label: t(locale, 'setupv.field.hub'), value: hub.toString() },
                            { label: t(locale, 'setupv.field.panel'), value: panel.toString() },
                            { label: t(locale, 'setupv.field.template'), value: template },
                            { label: t(locale, 'setupv.field.limit'), value: String(limitValue) },
                        ],
                    }),
                ],
            });
        } catch (error) {
            logger.error(`[TempVoice] setupv failed: ${error}`);
            await interaction.editReply({
                embeds: [
                    buildStaffEmbed({
                        actor: interaction.user,
                        title: t(locale, 'staff.error.title'),
                        color: 0xef4444,
                        description: ['', t(locale, 'setupv.error')],
                    }),
                ],
            });
        }
    },
};

export default command;
