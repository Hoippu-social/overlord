import { ChannelType, ChatInputCommandInteraction, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { GuildMember } from 'discord.js';
import { hasGuildPermissionAccess } from '../../services/ModerationService';
import { prisma } from '../../utils/database';
import { getGuildLocale, t, LocaleCode } from '../../utils/i18n';
import logger from '../../utils/logger';
import { cacheTempVoiceConfig, clearTempVoiceConfigCache, getTempVoiceConfig, removeGuildTempRooms } from '../../utils/tempVoice';
import { Command } from '../../utils/types';

const DEFAULT_TEMPLATE = 'Room {user}';

const command: Command = {
    data: new SlashCommandBuilder()
        .setName('tempvoice')
        .setDescription('Manage temporary private voice rooms')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
        .setDMPermission(false)
        .addSubcommand(sub =>
            sub
                .setName('setup')
                .setDescription('Enable temporary rooms for a lobby channel')
                .addChannelOption(option =>
                    option
                        .setName('hub')
                        .setDescription('Voice channel users join to get their room')
                        .setRequired(true)
                        .addChannelTypes(ChannelType.GuildVoice)
                )
                .addChannelOption(option =>
                    option
                        .setName('category')
                        .setDescription('Category to place created rooms')
                        .addChannelTypes(ChannelType.GuildCategory)
                )
                .addStringOption(option =>
                    option
                        .setName('name')
                        .setDescription('Channel name template, use {user} for the owner name')
                        .setMaxLength(90)
                )
                .addIntegerOption(option =>
                    option
                        .setName('limit')
                        .setDescription('User limit for created rooms (optional)')
                        .setMinValue(1)
                        .setMaxValue(99)
                )
        )
        .addSubcommand(sub =>
            sub
                .setName('status')
                .setDescription('Show current temp room configuration')
        )
        .addSubcommand(sub =>
            sub
                .setName('disable')
                .setDescription('Turn off temp rooms and clean up active ones')
        ) as any,
    accessGroup: 'admin',
    accessKey: 'tempvoice',
    async execute(interaction) {
        const locale = await getGuildLocale(interaction.guildId);

        if (!interaction.guildId || !interaction.guild) {
            await interaction.reply({ content: t(locale, 'general.guildOnly'), ephemeral: true });
            return;
        }

        const member = interaction.member instanceof GuildMember
            ? interaction.member
            : await interaction.guild.members.fetch(interaction.user.id).catch(() => null);

        if (!member) {
            await interaction.reply({ content: 'Unable to resolve your guild member state.', ephemeral: true });
            return;
        }

        if (!hasGuildPermissionAccess(member, PermissionFlagsBits.ManageChannels)) {
            await interaction.reply({ content: t(locale, 'tempvoice.notManager'), ephemeral: true });
            return;
        }

        const subcommand = interaction.options.getSubcommand();

        switch (subcommand) {
            case 'setup':
                await handleSetup(interaction, locale);
                break;
            case 'status':
                await handleStatus(interaction, locale);
                break;
            case 'disable':
                await handleDisable(interaction, locale);
                break;
            default:
                await interaction.reply({ content: t(locale, 'tempvoice.unknownSubcommand'), ephemeral: true });
                break;
        }
    },
};

async function handleSetup(interaction: ChatInputCommandInteraction, locale: LocaleCode) {
    if (!interaction.guildId || !interaction.guild) {
        await interaction.reply({ content: t(locale, 'general.guildOnly'), ephemeral: true });
        return;
    }

    const guild = interaction.guild;
    const hubChannel = interaction.options.getChannel('hub', true);
    const category = interaction.options.getChannel('category');
    const templateInput = interaction.options.getString('name') as string | null;
    const limit = interaction.options.getInteger('limit') as number | null;

    let nameTemplate = (templateInput || DEFAULT_TEMPLATE).trim();
    if (!nameTemplate.includes('{user}')) {
        nameTemplate = `${nameTemplate} {user}`;
    }

    if (hubChannel?.type !== ChannelType.GuildVoice) {
        await interaction.reply({ content: t(locale, 'tempvoice.hubMustBeVoice'), ephemeral: true });
        return;
    }

    try {
        await prisma.guild.upsert({
            where: { id: interaction.guildId },
            update: { name: guild.name, icon: guild.icon ?? undefined },
            create: { id: interaction.guildId, name: guild.name, icon: guild.icon ?? undefined },
        });

        const config = await prisma.tempVoiceConfig.upsert({
            where: { guildId: interaction.guildId },
            update: {
                hubChannelId: hubChannel.id,
                categoryId: category?.id ?? undefined,
                nameTemplate,
                userLimit: limit ?? undefined,
            },
            create: {
                guildId: interaction.guildId,
                hubChannelId: hubChannel.id,
                categoryId: category?.id ?? undefined,
                nameTemplate,
                userLimit: limit ?? undefined,
            },
        });

        cacheTempVoiceConfig(config);

        const categoryValue = category ? `<#${category.id}>` : t(locale, 'general.notSet');
        const limitValue = limit ?? t(locale, 'general.unlimited');

        await interaction.reply({
            content: t(locale, 'tempvoice.enabled', {
                hub: hubChannel.id,
                category: categoryValue,
                template: nameTemplate,
                limit: String(limitValue),
            }),
            ephemeral: true,
        });
    } catch (error) {
        logger.error(`[TempVoice] Failed to save configuration: ${error}`);
        await interaction.reply({ content: t(locale, 'tempvoice.failedSave'), ephemeral: true });
    }
}

async function handleStatus(interaction: ChatInputCommandInteraction, locale: LocaleCode) {
    if (!interaction.guildId) {
        await interaction.reply({ content: t(locale, 'general.guildOnly'), ephemeral: true });
        return;
    }

    try {
        const config = await getTempVoiceConfig(interaction.guildId);

        if (!config) {
            await interaction.reply({ content: t(locale, 'tempvoice.statusMissing'), ephemeral: true });
            return;
        }

        const categoryValue = config.categoryId ? `<#${config.categoryId}>` : t(locale, 'general.notSet');
        const limitValue = config.userLimit ?? t(locale, 'general.unlimited');

        await interaction.reply({
            content: t(locale, 'tempvoice.status', {
                hub: config.hubChannelId,
                category: categoryValue,
                template: config.nameTemplate,
                limit: String(limitValue),
            }),
            ephemeral: true,
        });
    } catch (error) {
        logger.error(`[TempVoice] Failed to load configuration: ${error}`);
        await interaction.reply({ content: t(locale, 'tempvoice.failedLoad'), ephemeral: true });
    }
}

async function handleDisable(interaction: ChatInputCommandInteraction, locale: LocaleCode) {
    if (!interaction.guildId) {
        await interaction.reply({ content: t(locale, 'general.guildOnly'), ephemeral: true });
        return;
    }

    try {
        const config = await getTempVoiceConfig(interaction.guildId);

        if (!config) {
            await interaction.reply({ content: t(locale, 'tempvoice.disable.missing'), ephemeral: true });
            return;
        }

        await removeGuildTempRooms(interaction.client, interaction.guildId);
        await prisma.tempVoiceConfig.delete({ where: { guildId: interaction.guildId } });
        clearTempVoiceConfigCache(interaction.guildId);

        await interaction.reply({ content: t(locale, 'tempvoice.disable.done'), ephemeral: true });
    } catch (error) {
        logger.error(`[TempVoice] Failed to disable temp rooms: ${error}`);
        await interaction.reply({ content: t(locale, 'tempvoice.disable.failed'), ephemeral: true });
    }
}

export default command;
