import { ChannelType, ChatInputCommandInteraction, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { GuildMember } from 'discord.js';
import { hasGuildPermissionAccess } from '../../services/ModerationService';
import { localizeDescription } from '../../utils/commandLocalizations';
import { prisma } from '../../utils/database';
import { getGuildLocale, t, LocaleCode } from '../../utils/i18n';
import logger from '../../utils/logger';
import { cacheTempVoiceConfig, clearTempVoiceConfigCache, getTempVoiceConfig, removeGuildTempRooms } from '../../utils/tempVoice';
import { Command } from '../../utils/types';

const DEFAULT_TEMPLATE = 'Room {user}';

const command: Command = {
    data: localizeDescription(new SlashCommandBuilder()
        .setName('tempvoice'), {
        en: 'Manage temporary private voice rooms',
        ru: 'Управлять временными приватными голосовыми комнатами',
    })
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
        .setDMPermission(false)
        .addSubcommand((sub: any) =>
            localizeDescription(sub
                .setName('setup'), {
                en: 'Enable temporary rooms for a lobby channel',
                ru: 'Включить временные комнаты для лобби-канала',
            })
                .addChannelOption((option: any) =>
                    localizeDescription(option
                        .setName('hub'), {
                        en: 'Voice channel users join to get their room',
                        ru: 'Голосовой канал, в который заходят для создания комнаты',
                    })
                        .setRequired(true)
                        .addChannelTypes(ChannelType.GuildVoice)
                )
                .addChannelOption((option: any) =>
                    localizeDescription(option
                        .setName('category'), {
                        en: 'Category to place created rooms',
                        ru: 'Категория для создаваемых комнат',
                    })
                        .addChannelTypes(ChannelType.GuildCategory)
                )
                .addStringOption((option: any) =>
                    localizeDescription(option
                        .setName('name'), {
                        en: 'Channel name template, use {user} for the owner name',
                        ru: 'Шаблон имени канала, используйте {user} для имени владельца',
                    })
                        .setMaxLength(90)
                )
                .addIntegerOption((option: any) =>
                    localizeDescription(option
                        .setName('limit'), {
                        en: 'User limit for created rooms',
                        ru: 'Лимит пользователей для создаваемых комнат',
                    })
                        .setMinValue(1)
                        .setMaxValue(99)
                )
        )
        .addSubcommand((sub: any) =>
            localizeDescription(sub
                .setName('status'), {
                en: 'Show current temp room configuration',
                ru: 'Показать текущую конфигурацию временных комнат',
            })
        )
        .addSubcommand((sub: any) =>
            localizeDescription(sub
                .setName('disable'), {
                en: 'Turn off temp rooms and clean up active ones',
                ru: 'Выключить временные комнаты и удалить активные',
            })
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
            await interaction.reply({ content: t(locale, 'general.memberResolveFailed'), ephemeral: true });
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
