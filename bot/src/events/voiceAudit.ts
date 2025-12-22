import { Events, VoiceState } from 'discord.js';
import { addVoiceDuration } from '../utils/inviteTracker';
import { logAuditEvent } from '../utils/auditLog';

const voiceSessions = new Map<string, number>();

function makeKey(guildId: string, userId: string) {
    return `${guildId}:${userId}`;
}

export default {
    name: Events.VoiceStateUpdate,
    once: false,
    async execute(oldState: VoiceState, newState: VoiceState) {
        const guildId = newState.guild?.id || oldState.guild?.id;
        const memberId = newState.member?.id || oldState.member?.id;
        if (!guildId || !memberId) return;

        const key = makeKey(guildId, memberId);
        const leftVoice = oldState.channelId && !newState.channelId;
        const joinedVoice = !oldState.channelId && newState.channelId;
        const movedVoice = oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId;

        if (joinedVoice) {
            voiceSessions.set(key, Date.now());
            await logAuditEvent(newState.client, {
                guildId,
                tag: 'voice',
                actorId: memberId,
                targetId: memberId,
                channelId: newState.channelId,
                payload: {
                    event: 'voice_join',
                    channelId: newState.channelId,
                },
                severity: 'INFO',
            });
            return;
        }

        if (leftVoice) {
            const startedAt = voiceSessions.get(key);
            voiceSessions.delete(key);
            if (!startedAt) return;
            const durationSec = (Date.now() - startedAt) / 1000;
            await addVoiceDuration(guildId, memberId, durationSec);
            await logAuditEvent(oldState.client, {
                guildId,
                tag: 'voice',
                actorId: memberId,
                targetId: memberId,
                channelId: oldState.channelId,
                payload: {
                    event: 'voice_leave',
                    channelId: oldState.channelId,
                    durationSec: Math.floor(durationSec),
                },
                severity: 'INFO',
            });
            return;
        }

        if (movedVoice) {
            if (!voiceSessions.has(key)) {
                voiceSessions.set(key, Date.now());
            }
            await logAuditEvent(newState.client, {
                guildId,
                tag: 'voice',
                actorId: memberId,
                targetId: memberId,
                payload: {
                    event: 'voice_move',
                    fromChannelId: oldState.channelId,
                    toChannelId: newState.channelId,
                },
                severity: 'INFO',
            });
            return;
        }
    },
};
