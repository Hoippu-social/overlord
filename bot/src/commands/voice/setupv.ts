import {
    ChannelType,
    PermissionFlagsBits,
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
} from 'discord.js';
import { prisma } from '../../utils/database';
import { getGuildLocale, t } from '../../utils/i18n';
import logger from '../../utils/logger';
import { cacheTempVoiceConfig, clearTempVoiceConfigCache } from '../../utils/tempVoice';
import { Command } from '../../utils/types';

const DEFAULT_CATEGORY = 'Temporary Voice';
const DEFAULT_HUB = 'Join to Create';
const DEFAULT_INTERFACE = 'temp-voice-control';
const DEFAULT_TEMPLATE = 'Room {user}';

const command: Command = {
    data: new SlashCommandBuilder()
        .setName('setupv')
        .setDescription('Create hub, category, and control panel for temp rooms')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
        .setDMPermission(false)
        .addStringOption((opt) =>
            opt
                .setName('category')
                .setDescription('Category name for temp rooms')
                .setMaxLength(80)
        )
        .addStringOption((opt) =>
            opt
                .setName('hub')
                .setDescription('Voice hub channel name')
                .setMaxLength(80)
        )
        .addStringOption((opt) =>
            opt
                .setName('interface')
                .setDescription('Text channel name for control panel')
                .setMaxLength(80)
        )
        .addStringOption((opt) =>
            opt
                .setName('template')
                .setDescription('Room name template, use {user} for the owner name')
                .setMaxLength(90)
        )
        .addIntegerOption((opt) =>
            opt
                .setName('limit')
                .setDescription('User limit for created rooms (0 = unlimited)')
                .setMinValue(0)
                .setMaxValue(99)
        ) as any,
    async execute(interaction) {
        const locale = await getGuildLocale(interaction.guildId);

        if (!interaction.guildId || !interaction.guild) {
            await interaction.reply({ content: t(locale, 'setupv.guildOnly'), ephemeral: true });
            return;
        }

        if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels)) {
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
                    const ch = await interaction.guild.channels.fetch(id).catch(() => null);
                    if (ch) {
                        await ch.delete('Recreating temp voice setup');
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

            const iface = await interaction.guild.channels.create({
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
                new ButtonBuilder().setCustomId('tv_claim').setEmoji('??').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('tv_permit').setEmoji('?').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('tv_block').setEmoji('??').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('tv_limit').setEmoji('??').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('tv_lock').setEmoji('??').setStyle(ButtonStyle.Secondary),
            );

            const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder().setCustomId('tv_rename').setEmoji('??').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('tv_hide').setEmoji('??').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('tv_kick').setEmoji('??').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('tv_speak').setEmoji('???').setStyle(ButtonStyle.Secondary),
            );

            await iface.send({ embeds: [embed], components: [row1, row2] });

            const config = await prisma.tempVoiceConfig.upsert({
                where: { guildId: interaction.guildId },
                update: {
                    hubChannelId: hub.id,
                    categoryId: category.id,
                    interfaceChannelId: iface.id,
                    nameTemplate: template,
                    userLimit: limit ?? null,
                },
                create: {
                    guildId: interaction.guildId,
                    hubChannelId: hub.id,
                    categoryId: category.id,
                    interfaceChannelId: iface.id,
                    nameTemplate: template,
                    userLimit: limit ?? null,
                },
            });

            clearTempVoiceConfigCache(interaction.guildId);
            cacheTempVoiceConfig(config);

            const limitValue = limit ?? t(locale, 'general.unlimited');

            await interaction.editReply({
                content: t(locale, 'setupv.summary', {
                    category: category.toString(),
                    hub: hub.toString(),
                    panel: iface.toString(),
                    template,
                    limit: String(limitValue),
                }),
            });
        } catch (error) {
            logger.error(`[TempVoice] setupv failed: ${error}`);
            await interaction.editReply({ content: t(locale, 'setupv.error') });
        }
    },
};

export default command;
