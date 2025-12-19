import { ChannelType, Events, VoiceBasedChannel, VoiceChannel, VoiceState } from 'discord.js';
import logger from '../utils/logger';
import {
    applySettingsToChannel,
    buildChannelName,
    deleteTempRoomChannel,
    ensureOwnerPermissions,
    forgetTempVoiceRoom,
    getTempVoiceConfig,
    getUserVoiceSettings,
    getTempVoiceRoom,
    rememberTempVoiceRoom,
} from '../utils/tempVoice';

const CLEANUP_DELAY_MS = 1000;
const cleanupTimers = new Map<string, NodeJS.Timeout>();

export default {
    name: Events.VoiceStateUpdate,
    async execute(oldState: VoiceState, newState: VoiceState) {
        if (!newState.guild || newState.channelId === oldState.channelId) {
            // Cancel pending cleanup if someone re-joined a tracked channel without moving
            cancelCleanup(newState.channelId);
            return;
        }

        try {
            await maybeCreateTempRoom(newState);
            cancelCleanup(newState.channelId);
            await maybeScheduleCleanup(oldState);
        } catch (error) {
            logger.error(`[TempVoice] Voice state handler error: ${error}`);
        }
    },
};

async function maybeCreateTempRoom(state: VoiceState) {
    if (!state.member || !state.channelId) return;

    const config = await getTempVoiceConfig(state.guild.id);
    if (!config || state.channelId !== config.hubChannelId) return;

    const userSettings = await getUserVoiceSettings(state.guild.id, state.member.id);
    const parentId = config.categoryId || state.channel?.parentId || undefined;
    const defaultLimit = config.userLimit && config.userLimit > 0 ? config.userLimit : null;
    const resolvedLimit = userSettings?.preferredLimit ?? defaultLimit;
    const channelName = userSettings?.preferredName?.trim() || buildChannelName(config.nameTemplate, state.member);

    try {
        const voiceChannel = (await state.guild.channels.create({
            name: channelName,
            type: ChannelType.GuildVoice,
            parent: parentId,
            userLimit: resolvedLimit ?? 0,
            reason: `Temporary room for ${state.member.user.tag}`,
        })) as VoiceChannel;

        await rememberTempVoiceRoom({
            channelId: voiceChannel.id,
            guildId: state.guild.id,
            hubChannelId: config.hubChannelId,
            ownerId: state.member.id,
        });

        await applySettingsToChannel({
            channel: voiceChannel,
            ownerId: state.member.id,
            settings: userSettings,
            defaults: { name: channelName, limit: resolvedLimit },
        });

        // Ensure owner permissions even if settings were empty
        await ensureOwnerPermissions(voiceChannel, state.member.id);

        try {
            await state.member.voice.setChannel(voiceChannel);
        } catch (moveError) {
            logger.error(`[TempVoice] Failed to move ${state.member.user.tag} into temp room: ${moveError}`);
            await deleteTempRoomChannel(voiceChannel, 'Failed to move owner into temp room');
            return;
        }

        logger.info(`[TempVoice] Created temp room ${voiceChannel.id} for ${state.member.user.tag}`);
    } catch (error) {
        logger.error(`[TempVoice] Failed to create temp room: ${error}`);
    }
}

async function maybeScheduleCleanup(state: VoiceState) {
    if (!state.channelId) return;

    const room = getTempVoiceRoom(state.channelId);
    if (!room) return;

    const channel = state.channel;
    if (!channel || !channel.isVoiceBased()) {
        await forgetTempVoiceRoom(state.channelId);
        return;
    }

    if (channel.members.size === 0) {
        queueCleanup(channel);
    }
}

function queueCleanup(channel: VoiceBasedChannel) {
    if (cleanupTimers.has(channel.id)) return;

    const timeout = setTimeout(async () => {
        cleanupTimers.delete(channel.id);

        if (channel.members.size === 0) {
            await deleteTempRoomChannel(channel, 'All users left the temp room');
        }
    }, CLEANUP_DELAY_MS);

    cleanupTimers.set(channel.id, timeout);
}

function cancelCleanup(channelId: string | null) {
    if (!channelId) return;

    const existing = cleanupTimers.get(channelId);
    if (existing) {
        clearTimeout(existing);
        cleanupTimers.delete(channelId);
    }
}
