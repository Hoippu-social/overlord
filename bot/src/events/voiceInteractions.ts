import {
    ActionRowBuilder,
    ButtonInteraction,
    ChannelType,
    Events,
    GuildMember,
    Interaction,
    ModalBuilder,
    ModalSubmitInteraction,
    StringSelectMenuBuilder,
    StringSelectMenuInteraction,
    TextInputBuilder,
    TextInputStyle,
    UserSelectMenuBuilder,
    UserSelectMenuInteraction,
    VoiceChannel,
} from 'discord.js';
import { getGuildLocale, t, LocaleCode } from '../utils/i18n';
import logger from '../utils/logger';
import {
    applyAccessLists,
    ensureOwnerPermissions,
    getTempVoiceConfig,
    getTempVoiceRoom,
    getUserVoiceSettings,
    parseIds,
    renameRoom,
    saveUserVoiceSettings,
    setRoomLimit,
    setRoomLockState,
    setRoomSpeakPermission,
    setRoomVisibility,
    stringifyIds,
    updateRoomOwner,
} from '../utils/tempVoice';

const LIMIT_SELECT_ID = 'tv_limit_select';
const RENAME_MODAL_ID = 'tv_rename_modal';
const LIMIT_MODAL_ID = 'tv_limit_modal';
const BLOCK_SELECT_ID = 'tv_block_select';
const PERMIT_SELECT_ID = 'tv_permit_select';
const KICK_SELECT_ID = 'tv_kick_select';
const HIDE_TOGGLE_ID = 'tv_hide';
const SPEAK_TOGGLE_ID = 'tv_speak';

export default {
    name: Events.InteractionCreate,
    async execute(interaction: Interaction) {
        if (!interaction.guildId || !interaction.guild) return;

        const config = await getTempVoiceConfig(interaction.guildId);
        if (!config) return;

        if (config.interfaceChannelId && interaction.channelId !== config.interfaceChannelId) return;

        const locale = await getGuildLocale(interaction.guildId);

        if (interaction.isButton()) {
            await handleButton(interaction, locale);
        } else if (interaction.isModalSubmit()) {
            if (interaction.customId === RENAME_MODAL_ID) {
                await handleRenameSubmit(interaction, locale);
            } else if (interaction.customId === LIMIT_MODAL_ID) {
                await handleLimitModal(interaction, locale);
            }
        } else if (interaction.isStringSelectMenu()) {
            await handleStringSelect(interaction, locale);
        } else if (interaction.isUserSelectMenu()) {
            await handleUserSelect(interaction, locale);
        }
    },
};

type ResolvedRoom =
    | { error: string }
    | { member: GuildMember; channel: VoiceChannel; room: { ownerId: string; channelId: string; guildId: string; hubChannelId: string } };

async function resolveRoomFromMember(interaction: Interaction, locale: LocaleCode): Promise<ResolvedRoom> {
    const member = interaction.member as GuildMember | null;
    const channel = member?.voice?.channel;
    if (!channel || channel.type !== ChannelType.GuildVoice) {
        return { error: t(locale, 'voice.notInVoice') };
    }

    const room = getTempVoiceRoom(channel.id);
    if (!room) {
        return { error: t(locale, 'voice.notTempRoom') };
    }

    return { member: member!, channel: channel as VoiceChannel, room };
}

async function handleButton(interaction: ButtonInteraction, locale: LocaleCode) {
    const action = interaction.customId;
    if (!action.startsWith('tv_')) return;

    const resolved = await resolveRoomFromMember(interaction, locale);
    if ('error' in resolved) {
        await interaction.reply({ content: resolved.error, ephemeral: true });
        return;
    }

    const { member, channel, room } = resolved;
    const isOwner = room.ownerId === member.id;

    switch (action) {
        case 'tv_rename':
            if (!isOwner) {
                await interaction.reply({ content: t(locale, 'voice.ownerOnly.rename'), ephemeral: true });
                return;
            }
            await showRenameModal(interaction, channel, locale);
            break;
        case 'tv_limit':
            if (!isOwner) {
                await interaction.reply({ content: t(locale, 'voice.ownerOnly.limit'), ephemeral: true });
                return;
            }
            await sendLimitSelect(interaction, locale);
            break;
        case 'tv_lock':
            if (!isOwner) {
                await interaction.reply({ content: t(locale, 'voice.ownerOnly.lock'), ephemeral: true });
                return;
            }
            await toggleLock(interaction, channel, room.ownerId, locale);
            break;
        case 'tv_claim':
            await handleClaim(interaction, channel, room, locale);
            break;
        case 'tv_kick':
            if (!isOwner) {
                await interaction.reply({ content: t(locale, 'voice.ownerOnly.kick'), ephemeral: true });
                return;
            }
            await sendKickSelect(interaction, channel, locale);
            break;
        case 'tv_block':
            if (!isOwner) {
                await interaction.reply({ content: t(locale, 'voice.ownerOnly.block'), ephemeral: true });
                return;
            }
            await sendUserSelect(interaction, BLOCK_SELECT_ID, t(locale, 'voice.select.block.prompt'));
            break;
        case 'tv_permit':
            if (!isOwner) {
                await interaction.reply({ content: t(locale, 'voice.ownerOnly.permit'), ephemeral: true });
                return;
            }
            await sendUserSelect(interaction, PERMIT_SELECT_ID, t(locale, 'voice.select.permit.prompt'));
            break;
        case HIDE_TOGGLE_ID:
            if (!isOwner) {
                await interaction.reply({ content: t(locale, 'voice.ownerOnly.hide'), ephemeral: true });
                return;
            }
            await toggleHide(interaction, channel, locale);
            break;
        case SPEAK_TOGGLE_ID:
            if (!isOwner) {
                await interaction.reply({ content: t(locale, 'voice.ownerOnly.speak'), ephemeral: true });
                return;
            }
            await toggleSpeak(interaction, channel, locale);
            break;
        default:
            break;
    }
}

async function showRenameModal(interaction: ButtonInteraction, channel: VoiceChannel, locale: LocaleCode) {
    const modal = new ModalBuilder().setCustomId(RENAME_MODAL_ID).setTitle(t(locale, 'voice.modal.rename.title'));

    const input = new TextInputBuilder()
        .setCustomId('tv_room_name')
        .setLabel(t(locale, 'voice.modal.rename.label'))
        .setStyle(TextInputStyle.Short)
        .setMaxLength(90)
        .setPlaceholder(channel.name)
        .setRequired(true);

    modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));

    await interaction.showModal(modal);
}

async function sendLimitSelect(interaction: ButtonInteraction, locale: LocaleCode) {
    const select = new StringSelectMenuBuilder()
        .setCustomId(LIMIT_SELECT_ID)
        .setPlaceholder(t(locale, 'voice.select.limit.placeholder'))
        .addOptions(
            { label: t(locale, 'voice.select.limit.custom'), value: 'custom' },
            { label: t(locale, 'voice.select.limit.none'), value: '0' },
            { label: '2', value: '2' },
            { label: '5', value: '5' },
            { label: '10', value: '10' },
            { label: '25', value: '25' },
            { label: '50', value: '50' },
        );

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);
    await interaction.reply({ content: t(locale, 'voice.select.limit.prompt'), components: [row], ephemeral: true });
}

async function sendKickSelect(interaction: ButtonInteraction, channel: VoiceChannel, locale: LocaleCode) {
    const members = channel.members.filter((m) => m.id !== interaction.user.id);
    if (members.size === 0) {
        await interaction.reply({ content: t(locale, 'voice.select.kick.empty'), ephemeral: true });
        return;
    }

    const options = members
        .map((m) => ({
            label: m.displayName,
            value: m.id,
            description: m.user.tag,
        }))
        .slice(0, 25);

    const select = new StringSelectMenuBuilder()
        .setCustomId(KICK_SELECT_ID)
        .setPlaceholder(t(locale, 'voice.select.kick.placeholder'))
        .addOptions(options);

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);
    await interaction.reply({ content: t(locale, 'voice.select.kick.prompt'), components: [row], ephemeral: true });
}

async function sendUserSelect(interaction: ButtonInteraction, customId: string, placeholder: string) {
    const select = new UserSelectMenuBuilder().setCustomId(customId).setPlaceholder(placeholder).setMinValues(1).setMaxValues(5);
    const row = new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(select);
    await interaction.reply({ content: placeholder, components: [row], ephemeral: true });
}

async function handleRenameSubmit(interaction: ModalSubmitInteraction, locale: LocaleCode) {
    const resolved = await resolveRoomFromMember(interaction, locale);
    if ('error' in resolved) {
        await interaction.reply({ content: resolved.error, ephemeral: true });
        return;
    }

    const { channel, room, member } = resolved;
    if (room.ownerId !== member.id) {
        await interaction.reply({ content: t(locale, 'voice.ownerOnly.rename'), ephemeral: true });
        return;
    }

    const newName = String(interaction.fields.getTextInputValue('tv_room_name') || '').trim();
    if (!newName) {
        await interaction.reply({ content: t(locale, 'voice.rename.empty'), ephemeral: true });
        return;
    }

    const previousSettings = await getUserVoiceSettings(interaction.guildId!, room.ownerId);
    const updatedSettings = await saveUserVoiceSettings(interaction.guildId!, room.ownerId, { preferredName: newName });

    await renameRoom(channel, newName);
    await interaction.reply({ content: t(locale, 'voice.rename.updated', { name: newName }), ephemeral: true });
    await applyAccessLists(channel, previousSettings, updatedSettings);
}

async function handleLimitModal(interaction: ModalSubmitInteraction, locale: LocaleCode) {
    const resolved = await resolveRoomFromMember(interaction, locale);
    if ('error' in resolved) {
        await interaction.reply({ content: resolved.error, ephemeral: true });
        return;
    }

    const { channel, room, member } = resolved;
    if (room.ownerId !== member.id) {
        await interaction.reply({ content: t(locale, 'voice.ownerOnly.limit'), ephemeral: true });
        return;
    }

    const raw = String(interaction.fields.getTextInputValue('tv_limit_value') || '').trim();
    const value = parseInt(raw, 10);
    if (isNaN(value) || value < 0 || value > 99) {
        await interaction.reply({ content: t(locale, 'voice.limit.invalid'), ephemeral: true });
        return;
    }

    const limit = value === 0 ? null : value;
    const previousSettings = await getUserVoiceSettings(interaction.guildId!, room.ownerId);
    const updatedSettings = await saveUserVoiceSettings(interaction.guildId!, room.ownerId, { preferredLimit: limit });

    await setRoomLimit(channel, limit);
    await applyAccessLists(channel, previousSettings, updatedSettings);

    const limitValue = limit ?? t(locale, 'general.unlimited');
    await interaction.reply({ content: t(locale, 'voice.limit.updated', { limit: String(limitValue) }), ephemeral: true });
}

async function handleStringSelect(interaction: StringSelectMenuInteraction, locale: LocaleCode) {
    if (!interaction.customId.startsWith('tv_')) return;

    const resolved = await resolveRoomFromMember(interaction, locale);
    if ('error' in resolved) {
        await interaction.reply({ content: resolved.error, ephemeral: true });
        return;
    }

    const { channel, room, member } = resolved;
    if (room.ownerId !== member.id && interaction.customId !== KICK_SELECT_ID) {
        await interaction.reply({ content: t(locale, 'voice.ownerOnly.panel'), ephemeral: true });
        return;
    }

    switch (interaction.customId) {
        case LIMIT_SELECT_ID: {
            const raw = interaction.values[0];
            if (raw === 'custom') {
                const modal = new ModalBuilder().setCustomId(LIMIT_MODAL_ID).setTitle(t(locale, 'voice.modal.limit.title'));
                const input = new TextInputBuilder()
                    .setCustomId('tv_limit_value')
                    .setLabel(t(locale, 'voice.modal.limit.label'))
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder(t(locale, 'voice.modal.limit.placeholder'))
                    .setMaxLength(2)
                    .setRequired(true);
                modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
                await interaction.showModal(modal);
                return;
            }

            const value = parseInt(raw, 10);
            const limit = value === 0 ? null : value;
            const previousSettings = await getUserVoiceSettings(interaction.guildId!, room.ownerId);
            const updatedSettings = await saveUserVoiceSettings(interaction.guildId!, room.ownerId, { preferredLimit: limit });

            await setRoomLimit(channel, limit);
            await applyAccessLists(channel, previousSettings, updatedSettings);

            const limitValue = limit ?? t(locale, 'general.unlimited');
            await interaction.reply({ content: t(locale, 'voice.limit.updated', { limit: String(limitValue) }), ephemeral: true });
            break;
        }
        case KICK_SELECT_ID: {
            const targets = interaction.values;
            let kicked = 0;

            for (const targetId of targets) {
                const target = channel.members.get(targetId);
                if (!target) continue;
                try {
                    await target.voice.setChannel(null, 'Kicked from temporary room');
                    kicked += 1;
                } catch (error) {
                    logger.warn(`[TempVoice] Failed to kick ${targetId} from ${channel.id}: ${error}`);
                }
            }

            await interaction.reply({
                content: kicked > 0 ? t(locale, 'voice.kick.done', { count: kicked }) : t(locale, 'voice.kick.none'),
                ephemeral: true,
            });
            break;
        }
        default:
            break;
    }
}

async function handleUserSelect(interaction: UserSelectMenuInteraction, locale: LocaleCode) {
    if (interaction.customId !== BLOCK_SELECT_ID && interaction.customId !== PERMIT_SELECT_ID) return;

    const resolved = await resolveRoomFromMember(interaction, locale);
    if ('error' in resolved) {
        await interaction.reply({ content: resolved.error, ephemeral: true });
        return;
    }

    const { channel, room, member } = resolved;
    if (room.ownerId !== member.id) {
        const errorKey = interaction.customId === BLOCK_SELECT_ID ? 'voice.ownerOnly.block' : 'voice.ownerOnly.permit';
        await interaction.reply({ content: t(locale, errorKey), ephemeral: true });
        return;
    }

    const previousSettings = await getUserVoiceSettings(interaction.guildId!, room.ownerId);
    const blocked = new Set(parseIds(previousSettings?.blockedUsers));
    const allowed = new Set(parseIds(previousSettings?.allowedUsers));

    for (const userId of interaction.values) {
        if (interaction.customId === BLOCK_SELECT_ID) {
            blocked.add(userId);
            allowed.delete(userId);
        } else {
            allowed.add(userId);
            blocked.delete(userId);
        }
    }

    const updatedSettings = await saveUserVoiceSettings(interaction.guildId!, room.ownerId, {
        blockedUsers: stringifyIds(blocked),
        allowedUsers: stringifyIds(allowed),
    });

    await applyAccessLists(channel, previousSettings, updatedSettings);
    await interaction.reply({
        content: interaction.customId === BLOCK_SELECT_ID ? t(locale, 'voice.block.updated') : t(locale, 'voice.permit.updated'),
        ephemeral: true,
    });
}

async function toggleLock(interaction: ButtonInteraction, channel: VoiceChannel, ownerId: string, locale: LocaleCode) {
    const previousSettings = await getUserVoiceSettings(interaction.guildId!, ownerId);
    const nextLocked = !(previousSettings?.locked ?? false);
    const updatedSettings = await saveUserVoiceSettings(interaction.guildId!, ownerId, { locked: nextLocked });

    await setRoomLockState(channel, nextLocked);
    await applyAccessLists(channel, previousSettings, updatedSettings);

    await interaction.reply({ content: nextLocked ? t(locale, 'voice.locked') : t(locale, 'voice.unlocked'), ephemeral: true });
}

async function handleClaim(
    interaction: ButtonInteraction,
    channel: VoiceChannel,
    room: { ownerId: string; channelId: string; guildId: string },
    locale: LocaleCode
) {
    const member = interaction.member as GuildMember;

    if (room.ownerId === member.id) {
        await interaction.reply({ content: t(locale, 'voice.claim.alreadyOwner'), ephemeral: true });
        return;
    }

    const currentOwnerStillInside = channel.members.has(room.ownerId);
    if (currentOwnerStillInside) {
        await interaction.reply({ content: t(locale, 'voice.claim.ownerInside'), ephemeral: true });
        return;
    }

    await updateRoomOwner(room.channelId, member.id);
    await ensureOwnerPermissions(channel, member.id);

    await interaction.reply({ content: t(locale, 'voice.claim.success'), ephemeral: true });
}

async function toggleHide(interaction: ButtonInteraction, channel: VoiceChannel, locale: LocaleCode) {
    const everyone = channel.guild.roles.everyone.id;
    const current = channel.permissionOverwrites.cache.get(everyone);
    const hidden = current?.deny?.has('ViewChannel') ?? false;
    await setRoomVisibility(channel, !hidden);
    await interaction.reply({ content: hidden ? t(locale, 'voice.hide.shown') : t(locale, 'voice.hide.hidden'), ephemeral: true });
}

async function toggleSpeak(interaction: ButtonInteraction, channel: VoiceChannel, locale: LocaleCode) {
    const everyone = channel.guild.roles.everyone.id;
    const current = channel.permissionOverwrites.cache.get(everyone);
    const blocked = current?.deny?.has('Speak') ?? false;
    await setRoomSpeakPermission(channel, blocked);
    await interaction.reply({ content: blocked ? t(locale, 'voice.speak.allowed') : t(locale, 'voice.speak.restricted'), ephemeral: true });
}
