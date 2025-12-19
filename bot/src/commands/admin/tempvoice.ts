import { ChannelType, ChatInputCommandInteraction, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { prisma } from '../../utils/database';
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

    async execute(interaction) {
        if (!interaction.guildId || !interaction.guild) {
            await interaction.reply({ content: 'This command can only be used inside a server.', ephemeral: true });
            return;
        }

        if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels)) {
            await interaction.reply({ content: 'You need the Manage Channels permission to configure temp rooms.', ephemeral: true });
            return;
        }

        const subcommand = interaction.options.getSubcommand();

        switch (subcommand) {
            case 'setup':
                await handleSetup(interaction);
                break;
            case 'status':
                await handleStatus(interaction);
                break;
            case 'disable':
                await handleDisable(interaction);
                break;
            default:
                await interaction.reply({ content: 'Unknown subcommand.', ephemeral: true });
                break;
        }
    },
};

async function handleSetup(interaction: ChatInputCommandInteraction) {
    if (!interaction.guildId || !interaction.guild) {
        await interaction.reply({ content: 'This command can only be used inside a server.', ephemeral: true });
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
        await interaction.reply({ content: 'Hub must be a voice channel.', ephemeral: true });
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

        await interaction.reply({
            content: [
                'Temporary rooms enabled.',
                `Hub: <#${hubChannel.id}>`,
                category ? `Category: <#${category.id}>` : 'Category: not set',
                `Name template: ${nameTemplate}`,
                `User limit: ${limit ?? 'no limit'}`,
            ].join('\n'),
            ephemeral: true,
        });
    } catch (error) {
        logger.error(`[TempVoice] Failed to save configuration: ${error}`);
        await interaction.reply({ content: 'Failed to save configuration, please try again later.', ephemeral: true });
    }
}

async function handleStatus(interaction: ChatInputCommandInteraction) {
    if (!interaction.guildId) {
        await interaction.reply({ content: 'This command can only be used inside a server.', ephemeral: true });
        return;
    }

    try {
        const config = await getTempVoiceConfig(interaction.guildId);

        if (!config) {
            await interaction.reply({ content: 'Temp rooms are not configured yet.', ephemeral: true });
            return;
        }

        await interaction.reply({
            content: [
                `Hub: <#${config.hubChannelId}>`,
                `Category: ${config.categoryId ? `<#${config.categoryId}>` : 'not set'}`,
                `Name template: ${config.nameTemplate}`,
                `User limit: ${config.userLimit ?? 'no limit'}`,
            ].join('\n'),
            ephemeral: true,
        });
    } catch (error) {
        logger.error(`[TempVoice] Failed to load configuration: ${error}`);
        await interaction.reply({ content: 'Failed to load configuration.', ephemeral: true });
    }
}

async function handleDisable(interaction: ChatInputCommandInteraction) {
    if (!interaction.guildId) {
        await interaction.reply({ content: 'This command can only be used inside a server.', ephemeral: true });
        return;
    }

    try {
        const config = await getTempVoiceConfig(interaction.guildId);

        if (!config) {
            await interaction.reply({ content: 'Temp rooms are already disabled.', ephemeral: true });
            return;
        }

        await removeGuildTempRooms(interaction.client, interaction.guildId);
        await prisma.tempVoiceConfig.delete({ where: { guildId: interaction.guildId } });
        clearTempVoiceConfigCache(interaction.guildId);

        await interaction.reply({ content: 'Temp rooms disabled and active rooms removed.', ephemeral: true });
    } catch (error) {
        logger.error(`[TempVoice] Failed to disable temp rooms: ${error}`);
        await interaction.reply({ content: 'Failed to disable temp rooms.', ephemeral: true });
    }
}

export default command;
