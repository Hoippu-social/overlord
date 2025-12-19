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

        // Restrict handling to configured interface channel
        if (config.interfaceChannelId && interaction.channelId !== config.interfaceChannelId) return;

        if (interaction.isButton()) {
            await handleButton(interaction);
        } else if (interaction.isModalSubmit()) {
            if (interaction.customId === RENAME_MODAL_ID) {
                await handleRenameSubmit(interaction);
            } else if (interaction.customId === LIMIT_MODAL_ID) {
                await handleLimitModal(interaction);
            }
        } else if (interaction.isStringSelectMenu()) {
            await handleStringSelect(interaction);
        } else if (interaction.isUserSelectMenu()) {
            await handleUserSelect(interaction);
        }
    },
};

type ResolvedRoom =
    | { error: string }
    | { member: GuildMember; channel: VoiceChannel; room: { ownerId: string; channelId: string; guildId: string; hubChannelId: string } };

async function resolveRoomFromMember(interaction: Interaction): Promise<ResolvedRoom> {
    const member = interaction.member as GuildMember | null;
    const channel = member?.voice?.channel;
    if (!channel || channel.type !== ChannelType.GuildVoice) {
        return { error: 'Сначала зайдите в свою временную комнату.' };
    }

    const room = getTempVoiceRoom(channel.id);
    if (!room) {
        return { error: 'Эта комната не управляется модулем временных комнат.' };
    }

    return { member: member!, channel: channel as VoiceChannel, room };
}

async function handleButton(interaction: ButtonInteraction) {
    const action = interaction.customId;
    if (!action.startsWith('tv_')) return;

    const resolved = await resolveRoomFromMember(interaction);
    if ('error' in resolved) {
        await interaction.reply({ content: resolved.error, ephemeral: true });
        return;
    }

    const { member, channel, room } = resolved;
    const isOwner = room.ownerId === member.id;

    switch (action) {
        case 'tv_rename':
            if (!isOwner) {
                await interaction.reply({ content: 'Только владелец комнаты может менять имя.', ephemeral: true });
                return;
            }
            await showRenameModal(interaction, channel);
            break;
        case 'tv_limit':
            if (!isOwner) {
                await interaction.reply({ content: 'Только владелец комнаты может менять лимит.', ephemeral: true });
                return;
            }
            await sendLimitSelect(interaction);
            break;
        case 'tv_lock':
            if (!isOwner) {
                await interaction.reply({ content: 'Только владелец комнаты может закрывать/открывать вход.', ephemeral: true });
                return;
            }
            await toggleLock(interaction, channel, room.ownerId);
            break;
        case 'tv_claim':
            await handleClaim(interaction, channel, room);
            break;
        case 'tv_kick':
            if (!isOwner) {
                await interaction.reply({ content: 'Только владелец комнаты может кикать пользователей.', ephemeral: true });
                return;
            }
            await sendKickSelect(interaction, channel);
            break;
        case 'tv_block':
            if (!isOwner) {
                await interaction.reply({ content: 'Только владелец комнаты может блокировать пользователей.', ephemeral: true });
                return;
            }
            await sendUserSelect(interaction, BLOCK_SELECT_ID, 'Кого заблокировать');
            break;
        case 'tv_permit':
            if (!isOwner) {
                await interaction.reply({ content: 'Только владелец комнаты может разрешать доступ.', ephemeral: true });
                return;
            }
            await sendUserSelect(interaction, PERMIT_SELECT_ID, 'Кому разрешить вход');
            break;
        case HIDE_TOGGLE_ID:
            if (!isOwner) {
                await interaction.reply({ content: 'Только владелец комнаты может скрывать или показывать её.', ephemeral: true });
                return;
            }
            await toggleHide(interaction, channel);
            break;
        case SPEAK_TOGGLE_ID:
            if (!isOwner) {
                await interaction.reply({ content: 'Только владелец комнаты может ограничивать право говорить.', ephemeral: true });
                return;
            }
            await toggleSpeak(interaction, channel);
            break;
        default:
            break;
    }
}

async function showRenameModal(interaction: ButtonInteraction, channel: VoiceChannel) {
    const modal = new ModalBuilder().setCustomId(RENAME_MODAL_ID).setTitle('Переименовать комнату');

    const input = new TextInputBuilder()
        .setCustomId('tv_room_name')
        .setLabel('Новое имя')
        .setStyle(TextInputStyle.Short)
        .setMaxLength(90)
        .setPlaceholder(channel.name)
        .setRequired(true);

    modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));

    await interaction.showModal(modal);
}

async function sendLimitSelect(interaction: ButtonInteraction) {
    const select = new StringSelectMenuBuilder()
        .setCustomId(LIMIT_SELECT_ID)
        .setPlaceholder('Выберите лимит')
        .addOptions(
            { label: 'Задать самому...', value: 'custom' },
            { label: 'Без лимита', value: '0' },
            { label: '2', value: '2' },
            { label: '5', value: '5' },
            { label: '10', value: '10' },
            { label: '25', value: '25' },
            { label: '50', value: '50' },
        );

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);
    await interaction.reply({ content: 'Выберите лимит пользователей для комнаты:', components: [row], ephemeral: true });
}

async function sendKickSelect(interaction: ButtonInteraction, channel: VoiceChannel) {
    const members = channel.members.filter((m) => m.id !== interaction.user.id);
    if (members.size === 0) {
        await interaction.reply({ content: 'Некого кикать — в комнате только вы.', ephemeral: true });
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
        .setPlaceholder('Выберите кого кикнуть')
        .addOptions(options);

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);
    await interaction.reply({ content: 'Кого кикнуть из комнаты?', components: [row], ephemeral: true });
}

async function sendUserSelect(interaction: ButtonInteraction, customId: string, placeholder: string) {
    const select = new UserSelectMenuBuilder().setCustomId(customId).setPlaceholder(placeholder).setMinValues(1).setMaxValues(5);
    const row = new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(select);
    await interaction.reply({ content: placeholder, components: [row], ephemeral: true });
}

async function handleRenameSubmit(interaction: ModalSubmitInteraction) {
    const resolved = await resolveRoomFromMember(interaction);
    if ('error' in resolved) {
        await interaction.reply({ content: resolved.error, ephemeral: true });
        return;
    }

    const { channel, room, member } = resolved;
    if (room.ownerId !== member.id) {
        await interaction.reply({ content: 'Только владелец комнаты может переименовывать её.', ephemeral: true });
        return;
    }

    const newName = String(interaction.fields.getTextInputValue('tv_room_name') || '').trim();
    if (!newName) {
        await interaction.reply({ content: 'Имя не может быть пустым.', ephemeral: true });
        return;
    }

    const previousSettings = await getUserVoiceSettings(interaction.guildId!, room.ownerId);
    const updatedSettings = await saveUserVoiceSettings(interaction.guildId!, room.ownerId, { preferredName: newName });

    await renameRoom(channel, newName);
    await interaction.reply({ content: `Название обновлено на **${newName}**.`, ephemeral: true });
    await applyAccessLists(channel, previousSettings, updatedSettings);
}

async function handleLimitModal(interaction: ModalSubmitInteraction) {
    const resolved = await resolveRoomFromMember(interaction);
    if ('error' in resolved) {
        await interaction.reply({ content: resolved.error, ephemeral: true });
        return;
    }

    const { channel, room, member } = resolved;
    if (room.ownerId !== member.id) {
        await interaction.reply({ content: 'Только владелец комнаты может менять лимит.', ephemeral: true });
        return;
    }

    const raw = String(interaction.fields.getTextInputValue('tv_limit_value') || '').trim();
    const value = parseInt(raw, 10);
    if (isNaN(value) || value < 0 || value > 99) {
        await interaction.reply({ content: 'Введите число от 0 до 99.', ephemeral: true });
        return;
    }

    const limit = value === 0 ? null : value;
    const previousSettings = await getUserVoiceSettings(interaction.guildId!, room.ownerId);
    const updatedSettings = await saveUserVoiceSettings(interaction.guildId!, room.ownerId, { preferredLimit: limit });

    await setRoomLimit(channel, limit);
    await applyAccessLists(channel, previousSettings, updatedSettings);
    await interaction.reply({ content: `Лимит установлен: ${limit ?? 'без лимита'}.`, ephemeral: true });
}

async function handleStringSelect(interaction: StringSelectMenuInteraction) {
    if (!interaction.customId.startsWith('tv_')) return;

    const resolved = await resolveRoomFromMember(interaction);
    if ('error' in resolved) {
        await interaction.reply({ content: resolved.error, ephemeral: true });
        return;
    }

    const { channel, room, member } = resolved;
    if (room.ownerId !== member.id && interaction.customId !== KICK_SELECT_ID) {
        await interaction.reply({ content: 'Только владелец комнаты может использовать эту панель.', ephemeral: true });
        return;
    }

    switch (interaction.customId) {
        case LIMIT_SELECT_ID: {
            const raw = interaction.values[0];
            if (raw === 'custom') {
                const modal = new ModalBuilder().setCustomId(LIMIT_MODAL_ID).setTitle('Задать лимит');
                const input = new TextInputBuilder()
                    .setCustomId('tv_limit_value')
                    .setLabel('Максимум участников (0-99)')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('Например: 8')
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
            await interaction.reply({ content: `Лимит обновлён: ${limit ?? 'без лимита'}.`, ephemeral: true });
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
                content: kicked > 0 ? `Кикнул ${kicked} пользователь(ей).` : 'Не удалось кикнуть выбранных пользователей.',
                ephemeral: true,
            });
            break;
        }
        default:
            break;
    }
}

async function handleUserSelect(interaction: UserSelectMenuInteraction) {
    if (interaction.customId !== BLOCK_SELECT_ID && interaction.customId !== PERMIT_SELECT_ID) return;

    const resolved = await resolveRoomFromMember(interaction);
    if ('error' in resolved) {
        await interaction.reply({ content: resolved.error, ephemeral: true });
        return;
    }

    const { channel, room, member } = resolved;
    if (room.ownerId !== member.id) {
        await interaction.reply({ content: 'Только владелец комнаты может менять доступ.', ephemeral: true });
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
        content: interaction.customId === BLOCK_SELECT_ID ? 'Пользователи заблокированы.' : 'Пользователям разрешён доступ.',
        ephemeral: true,
    });
}

async function toggleLock(interaction: ButtonInteraction, channel: VoiceChannel, ownerId: string) {
    const previousSettings = await getUserVoiceSettings(interaction.guildId!, ownerId);
    const nextLocked = !(previousSettings?.locked ?? false);
    const updatedSettings = await saveUserVoiceSettings(interaction.guildId!, ownerId, { locked: nextLocked });

    await setRoomLockState(channel, nextLocked);
    await applyAccessLists(channel, previousSettings, updatedSettings);

    await interaction.reply({
        content: nextLocked ? 'Комната закрыта для новых пользователей.' : 'Комната открыта.',
        ephemeral: true,
    });
}

async function handleClaim(
    interaction: ButtonInteraction,
    channel: VoiceChannel,
    room: { ownerId: string; channelId: string; guildId: string }
) {
    const member = interaction.member as GuildMember;

    if (room.ownerId === member.id) {
        await interaction.reply({ content: 'Вы уже владелец этой комнаты.', ephemeral: true });
        return;
    }

    const currentOwnerStillInside = channel.members.has(room.ownerId);
    if (currentOwnerStillInside) {
        await interaction.reply({ content: 'Текущий владелец ещё в комнате. Забрать нельзя.', ephemeral: true });
        return;
    }

    await updateRoomOwner(room.channelId, member.id);
    await ensureOwnerPermissions(channel, member.id);

    await interaction.reply({ content: 'Вы стали владельцем комнаты.', ephemeral: true });
}

async function toggleHide(interaction: ButtonInteraction, channel: VoiceChannel) {
    const everyone = channel.guild.roles.everyone.id;
    const current = channel.permissionOverwrites.cache.get(everyone);
    const hidden = current?.deny?.has('ViewChannel') ?? false;
    await setRoomVisibility(channel, !hidden);
    await interaction.reply({ content: hidden ? 'Комната показана всем.' : 'Комната скрыта от всех.', ephemeral: true });
}

async function toggleSpeak(interaction: ButtonInteraction, channel: VoiceChannel) {
    const everyone = channel.guild.roles.everyone.id;
    const current = channel.permissionOverwrites.cache.get(everyone);
    const blocked = current?.deny?.has('Speak') ?? false;
    await setRoomSpeakPermission(channel, blocked);
    await interaction.reply({ content: blocked ? 'Разрешено говорить всем.' : 'Право говорить ограничено.', ephemeral: true });
}
