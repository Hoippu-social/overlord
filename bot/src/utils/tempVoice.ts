import type { TempVoiceConfig, UserVoiceSettings } from '@prisma/client';
import { ChannelType, Client, GuildMember, VoiceBasedChannel, VoiceChannel } from 'discord.js';
import { prisma } from './database';
import logger from './logger';

type TempRoomRecord = {
    channelId: string;
    guildId: string;
    ownerId: string;
    hubChannelId: string;
};

const configCache = new Map<string, TempVoiceConfig | null>();
const roomCache = new Map<string, TempRoomRecord>();
const userSettingsCache = new Map<string, UserVoiceSettings | null>();

export async function getTempVoiceConfig(guildId: string): Promise<TempVoiceConfig | null> {
    if (configCache.has(guildId)) {
        return configCache.get(guildId) || null;
    }

    try {
        const config = await prisma.tempVoiceConfig.findUnique({ where: { guildId } });
        configCache.set(guildId, config);
        return config;
    } catch (error) {
        logger.error(`[TempVoice] Failed to load config for guild ${guildId}: ${error}`);
        configCache.set(guildId, null);
        return null;
    }
}

export function cacheTempVoiceConfig(config: TempVoiceConfig) {
    configCache.set(config.guildId, config);
}

export function clearTempVoiceConfigCache(guildId: string) {
    configCache.delete(guildId);
}

export function getTempVoiceRoom(channelId: string): TempRoomRecord | undefined {
    return roomCache.get(channelId);
}

export async function rememberTempVoiceRoom(room: TempRoomRecord) {
    roomCache.set(room.channelId, room);

    await prisma.tempVoiceRoom.upsert({
        where: { channelId: room.channelId },
        update: {
            guildId: room.guildId,
            ownerId: room.ownerId,
            hubChannelId: room.hubChannelId,
        },
        create: {
            channelId: room.channelId,
            guildId: room.guildId,
            ownerId: room.ownerId,
            hubChannelId: room.hubChannelId,
        },
    });
}

export async function forgetTempVoiceRoom(channelId: string) {
    roomCache.delete(channelId);

    try {
        await prisma.tempVoiceRoom.delete({ where: { channelId } });
    } catch (error: any) {
        if (error.code !== 'P2025') {
            logger.error(`[TempVoice] Failed to remove room ${channelId} from database: ${error}`);
        }
    }
}

export async function updateRoomOwner(channelId: string, newOwnerId: string) {
    const cached = roomCache.get(channelId);
    if (cached) {
        cached.ownerId = newOwnerId;
        roomCache.set(channelId, cached);
    }

    try {
        await prisma.tempVoiceRoom.update({
            where: { channelId },
            data: { ownerId: newOwnerId },
        });
    } catch (error) {
        logger.error(`[TempVoice] Failed to update room owner for ${channelId}: ${error}`);
    }
}

export async function deleteTempRoomChannel(channel: VoiceBasedChannel, reason: string) {
    await forgetTempVoiceRoom(channel.id);

    try {
        if ('deletable' in channel && !channel.deletable) {
            logger.warn(`[TempVoice] Missing permissions to delete channel ${channel.id}`);
            return;
        }

        await channel.delete(reason);
        logger.info(`[TempVoice] Deleted temp room ${channel.id}: ${reason}`);
    } catch (error) {
        logger.error(`[TempVoice] Failed to delete temp room ${channel.id}: ${error}`);
    }
}

export async function removeGuildTempRooms(client: Client, guildId: string) {
    const rooms = await prisma.tempVoiceRoom.findMany({ where: { guildId } });

    for (const room of rooms) {
        const channel = await client.channels.fetch(room.channelId).catch(() => null);

        if (channel && channel.isVoiceBased()) {
            await deleteTempRoomChannel(channel, 'Temp voice module disabled');
        } else {
            await forgetTempVoiceRoom(room.channelId);
        }
    }
}

export async function reconcileTempVoiceRooms(client: Client) {
    let rooms;

    try {
        rooms = await prisma.tempVoiceRoom.findMany();
    } catch (error) {
        logger.error(`[TempVoice] Failed to reconcile temp rooms: ${error}`);
        return;
    }

    for (const room of rooms) {
        const channel = await client.channels.fetch(room.channelId).catch(() => null);

        if (!channel || channel.type !== ChannelType.GuildVoice) {
            await forgetTempVoiceRoom(room.channelId);
            continue;
        }

        roomCache.set(room.channelId, {
            channelId: room.channelId,
            guildId: room.guildId,
            hubChannelId: room.hubChannelId,
            ownerId: room.ownerId,
        });

        if (channel.members.size === 0) {
            await deleteTempRoomChannel(channel, 'Cleaned up stale temp room on startup');
        }
    }
}

export async function getUserVoiceSettings(guildId: string, userId: string): Promise<UserVoiceSettings | null> {
    const key = settingsKey(guildId, userId);
    if (userSettingsCache.has(key)) return userSettingsCache.get(key) || null;

    try {
        const settings = await prisma.userVoiceSettings.findUnique({
            where: { guildId_userId: { guildId, userId } },
        });
        userSettingsCache.set(key, settings);
        return settings;
    } catch (error) {
        logger.error(`[TempVoice] Failed to load settings for ${userId} in guild ${guildId}: ${error}`);
        userSettingsCache.set(key, null);
        return null;
    }
}

export async function saveUserVoiceSettings(
    guildId: string,
    userId: string,
    updates: Partial<UserVoiceSettings>
): Promise<UserVoiceSettings> {
    const existing = await getUserVoiceSettings(guildId, userId);

    const preferredName = updates.preferredName !== undefined ? updates.preferredName : existing?.preferredName ?? null;
    const preferredLimit = updates.preferredLimit !== undefined ? updates.preferredLimit : existing?.preferredLimit ?? null;
    const blockedUsers = updates.blockedUsers !== undefined ? updates.blockedUsers : existing?.blockedUsers ?? null;
    const allowedUsers = updates.allowedUsers !== undefined ? updates.allowedUsers : existing?.allowedUsers ?? null;
    const locked = updates.locked !== undefined ? updates.locked : existing?.locked ?? false;

    const data = {
        preferredName,
        preferredLimit,
        locked,
        blockedUsers,
        allowedUsers,
    };

    const record = await prisma.userVoiceSettings.upsert({
        where: { guildId_userId: { guildId, userId } },
        update: data,
        create: { guildId, userId, ...data },
    });

    userSettingsCache.set(settingsKey(guildId, userId), record);
    return record;
}

export function buildChannelName(template: string, member: GuildMember) {
    const fallback = member.nickname || member.user.globalName || member.user.username || 'room';
    const result = template.includes('{user}') ? template.replace('{user}', fallback) : `${template} ${fallback}`;
    return result.substring(0, 90);
}

export async function ensureOwnerPermissions(channel: VoiceBasedChannel, ownerId: string) {
    try {
        await channel.permissionOverwrites.edit(
            ownerId,
            {
                ManageChannels: true,
                MoveMembers: true,
                MuteMembers: true,
                DeafenMembers: true,
                Connect: true,
                ViewChannel: true,
                Speak: true,
            },
            { reason: 'Grant temp room owner controls' }
        );
    } catch (error) {
        logger.warn(`[TempVoice] Failed to ensure owner permissions for ${ownerId} in ${channel.id}: ${error}`);
    }
}

export async function setRoomLockState(channel: VoiceBasedChannel, locked: boolean) {
    try {
        const everyoneId = channel.guild.roles.everyone.id;
        await channel.permissionOverwrites.edit(
            everyoneId,
            { Connect: locked ? false : null },
            { reason: locked ? 'Lock temp room' : 'Unlock temp room' }
        );
    } catch (error) {
        logger.warn(`[TempVoice] Failed to update lock state for ${channel.id}: ${error}`);
    }
}

export async function setRoomLimit(channel: VoiceChannel, limit: number | null) {
    try {
        await channel.setUserLimit(limit ?? 0, 'Update temp room limit');
    } catch (error) {
        logger.warn(`[TempVoice] Failed to set limit for ${channel.id}: ${error}`);
    }
}

export async function renameRoom(channel: VoiceChannel, name: string) {
    try {
        await channel.setName(name.substring(0, 90), 'Rename temp room');
    } catch (error) {
        logger.warn(`[TempVoice] Failed to rename ${channel.id}: ${error}`);
    }
}

export async function setRoomVisibility(channel: VoiceBasedChannel, hidden: boolean) {
    try {
        const everyoneId = channel.guild.roles.everyone.id;
        await channel.permissionOverwrites.edit(
            everyoneId,
            { ViewChannel: hidden ? false : null },
            { reason: hidden ? 'Hide temp room' : 'Unhide temp room' }
        );
    } catch (error) {
        logger.warn(`[TempVoice] Failed to update visibility for ${channel.id}: ${error}`);
    }
}

export async function setRoomSpeakPermission(channel: VoiceBasedChannel, allowSpeak: boolean) {
    try {
        const everyoneId = channel.guild.roles.everyone.id;
        await channel.permissionOverwrites.edit(
            everyoneId,
            { Speak: allowSpeak ? null : false },
            { reason: allowSpeak ? 'Enable speak in temp room' : 'Disable speak in temp room' }
        );
    } catch (error) {
        logger.warn(`[TempVoice] Failed to update speak permission for ${channel.id}: ${error}`);
    }
}

export async function applyAccessLists(
    channel: VoiceBasedChannel,
    previous: UserVoiceSettings | null,
    next: UserVoiceSettings
) {
    const prevBlocked = new Set(parseIds(previous?.blockedUsers));
    const prevAllowed = new Set(parseIds(previous?.allowedUsers));
    const blocked = new Set(parseIds(next.blockedUsers));
    const allowed = new Set(parseIds(next.allowedUsers));

    const removed = new Set<string>();
    for (const id of prevBlocked) if (!blocked.has(id)) removed.add(id);
    for (const id of prevAllowed) if (!allowed.has(id)) removed.add(id);

    for (const id of removed) {
        await clearUserAccessOverride(channel, id);
    }

    for (const id of blocked) {
        await setUserAccessOverride(channel, id, 'block');
    }

    for (const id of allowed) {
        await setUserAccessOverride(channel, id, 'allow');
    }
}

export async function applySettingsToChannel(params: {
    channel: VoiceChannel;
    ownerId: string;
    settings: UserVoiceSettings | null;
    defaults: { name: string; limit: number | null };
}) {
    const { channel, ownerId, settings, defaults } = params;
    const name = settings?.preferredName?.trim() || defaults.name;
    const limit = settings?.preferredLimit ?? defaults.limit;
    const locked = settings?.locked ?? false;

    if (channel.name !== name) {
        await renameRoom(channel, name);
    }
    if (channel.userLimit !== (limit ?? 0)) {
        await setRoomLimit(channel, limit);
    }

    await setRoomLockState(channel, locked);
    if (settings) {
        await applyAccessLists(channel, null, settings);
    }
    await ensureOwnerPermissions(channel, ownerId);
}

export function parseIds(value?: string | null): string[] {
    if (!value) return [];
    try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) return parsed.filter((v) => typeof v === 'string');
    } catch {
        logger.warn('[TempVoice] Failed to parse stored user list');
    }
    return [];
}

export function stringifyIds(ids: Iterable<string>) {
    return JSON.stringify(Array.from(ids));
}

async function setUserAccessOverride(channel: VoiceBasedChannel, userId: string, mode: 'allow' | 'block') {
    try {
        await channel.permissionOverwrites.edit(
            userId,
            {
                Connect: mode === 'allow' ? true : false,
                ViewChannel: mode === 'allow' ? true : null,
                Speak: mode === 'allow' ? true : null,
            },
            { reason: mode === 'allow' ? 'Allow user in temp room' : 'Block user from temp room' }
        );
    } catch (error) {
        logger.warn(`[TempVoice] Failed to set ${mode} override for ${userId} in ${channel.id}: ${error}`);
    }
}

async function clearUserAccessOverride(channel: VoiceBasedChannel, userId: string) {
    try {
        await channel.permissionOverwrites.edit(
            userId,
            {
                Connect: null,
                ViewChannel: null,
                Speak: null,
            },
            { reason: 'Clear temp room override' }
        );
    } catch (error) {
        logger.warn(`[TempVoice] Failed to clear overrides for ${userId} in ${channel.id}: ${error}`);
    }
}

function settingsKey(guildId: string, userId: string) {
    return `${guildId}:${userId}`;
}
