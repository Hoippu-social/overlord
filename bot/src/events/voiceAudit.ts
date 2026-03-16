import { Client, Events, VoiceState } from 'discord.js';
import { addVoiceDuration } from '../utils/inviteTracker';
import { logAuditEvent } from '../utils/auditLog';
import { StatsService } from '../services/StatsService';

/**
 * voiceSessions tracks the moment a user's "active" (non-deafened) voice segment started.
 * Key:   "guildId:userId"
 * Value: unix timestamp (ms) when they last became active (joined or un-deafened)
 *        null → user is in voice but currently self-deafened (full mute), timer paused
 */
const voiceSessions = new Map<string, number | null>();

function makeKey(guildId: string, userId: string) {
    return `${guildId}:${userId}`;
}

/**
 * Returns true when user is self-deafened (full mute = ears + mic both off).
 * Discord.js: selfDeaf covers the "deafen yourself" button which cuts both in one action.
 */
function isFullMute(state: VoiceState): boolean {
    return state.selfDeaf === true;
}

/**
 * Flush an active segment to DB and economy tracker.
 * If isFinal=true, removes the key entirely.
 * If isFinal=false, sets key to null (paused — still in voice, just muted).
 * Does nothing if there is no active start time (already paused / never started).
 */
async function flushSegment(
    client: Client,
    guildId: string,
    memberId: string,
    channelId: string,
    key: string,
    isFinal: boolean
): Promise<void> {
    const startedAt = voiceSessions.get(key);
    if (!startedAt) return; // was paused (full-mute) — nothing to flush

    const durationSec = (Date.now() - startedAt) / 1000;
    const joinedAt = new Date(startedAt);
    const leftAt = new Date();

    await StatsService.trackVoiceSession(guildId, channelId, memberId, joinedAt, durationSec, leftAt);
    await addVoiceDuration(guildId, memberId, durationSec);

    if (isFinal) {
        voiceSessions.delete(key);
    } else {
        voiceSessions.set(key, null); // pause
    }
}

/**
 * Scan all guilds on startup and seed voiceSessions for members already in voice.
 */
export async function initVoiceSessions(client: Client) {
    for (const guild of client.guilds.cache.values()) {
        for (const [, state] of guild.voiceStates.cache) {
            if (state.channelId && state.member && !state.member.user.bot) {
                const key = makeKey(guild.id, state.member.id);
                if (isFullMute(state)) {
                    // Already deafened on startup — mark as paused
                    voiceSessions.set(key, null);
                } else {
                    voiceSessions.set(key, Date.now());
                }
            }
        }
    }
    console.log(`[VoiceAudit] Initialized ${voiceSessions.size} active voice sessions`);
}

export default {
    name: Events.VoiceStateUpdate,
    once: false,
    async execute(oldState: VoiceState, newState: VoiceState) {
        const guildId = newState.guild?.id || oldState.guild?.id;
        const memberId = newState.member?.id || oldState.member?.id;
        if (!guildId || !memberId) return;

        // Ignore bots
        if (newState.member?.user.bot || oldState.member?.user.bot) return;

        const key = makeKey(guildId, memberId);

        const leftVoice = !!oldState.channelId && !newState.channelId;
        const joinedVoice = !oldState.channelId && !!newState.channelId;
        const movedChannel =
            !!oldState.channelId &&
            !!newState.channelId &&
            oldState.channelId !== newState.channelId;

        const wasFullMute = isFullMute(oldState);
        const nowFullMute = isFullMute(newState);
        const muteChanged = wasFullMute !== nowFullMute;

        // ── Joined a voice channel ──────────────────────────────────────────
        if (joinedVoice && newState.channelId) {
            if (nowFullMute) {
                // Joined already deafened — start paused
                voiceSessions.set(key, null);
            } else {
                voiceSessions.set(key, Date.now());
            }

            await logAuditEvent(newState.client, {
                guildId,
                tag: 'voice',
                actorId: memberId,
                targetId: memberId,
                channelId: newState.channelId,
                payload: { event: 'voice_join', channelId: newState.channelId },
                severity: 'INFO',
            });
            return;
        }

        // ── Left a voice channel ────────────────────────────────────────────
        if (leftVoice && oldState.channelId) {
            if (!wasFullMute) {
                await flushSegment(newState.client, guildId, memberId, oldState.channelId, key, true);
            } else {
                // Was full-muted — no active time to flush, just clean up
                voiceSessions.delete(key);
            }

            await logAuditEvent(oldState.client, {
                guildId,
                tag: 'voice',
                actorId: memberId,
                targetId: memberId,
                channelId: oldState.channelId,
                payload: { event: 'voice_leave', channelId: oldState.channelId },
                severity: 'INFO',
            });
            return;
        }

        // ── Moved between channels ──────────────────────────────────────────
        if (movedChannel && oldState.channelId && newState.channelId) {
            if (!wasFullMute) {
                // Flush the old channel's active segment, then pause
                await flushSegment(newState.client, guildId, memberId, oldState.channelId, key, false);
            }
            // Start fresh segment in new channel (unless still full-muted)
            if (!nowFullMute) {
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

        // ── Self-deafened toggled (full-mute on/off) ───────────────────────
        if (muteChanged && newState.channelId) {
            if (nowFullMute && !wasFullMute) {
                // Turned full-mute ON → flush current segment and pause timer
                await flushSegment(newState.client, guildId, memberId, newState.channelId, key, false);
            } else if (!nowFullMute && wasFullMute) {
                // Turned full-mute OFF → resume timer (start fresh segment)
                voiceSessions.set(key, Date.now());
            }
        }
    },
};
