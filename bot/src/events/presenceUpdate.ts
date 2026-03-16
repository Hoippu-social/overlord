import { ActivityType, Events, Presence } from 'discord.js';
import { StatsService } from '../services/StatsService';
import { syncGuildRealtimeCounts } from '../utils/guildSync';

/**
 * Track user activities (games, apps) for statistics.
 * 
 * Only tracks:
 * - Playing (games)
 * - Listening (Spotify, etc.)
 * 
 * Does NOT track:
 * - Streaming (considered private)
 * - Custom Status
 * - Competing
 */
export default {
    name: Events.PresenceUpdate,
    once: false,
    async execute(oldPresence: Presence | null, newPresence: Presence) {
        // Need guild context
        if (!newPresence.guild) return;

        const guildId = newPresence.guild.id;
        const userId = newPresence.userId;

        await syncGuildRealtimeCounts(newPresence.guild);

        // Get relevant activities (Playing and Listening only)
        const oldActivities = getTrackableActivities(oldPresence);
        const newActivities = getTrackableActivities(newPresence);

        // Find activities that ended
        for (const oldAct of oldActivities) {
            const stillActive = newActivities.some(a => a.name === oldAct.name);
            if (!stillActive) {
                await StatsService.endActivity(guildId, userId, oldAct.name);
            }
        }

        // Find activities that started
        for (const newAct of newActivities) {
            const wasActive = oldActivities.some(a => a.name === newAct.name);
            if (!wasActive) {
                await StatsService.trackActivity(guildId, userId, newAct.name);
            }
        }
    },
};

interface SimpleActivity {
    name: string;
    type: ActivityType;
}

function getTrackableActivities(presence: Presence | null): SimpleActivity[] {
    if (!presence || !presence.activities) return [];

    return presence.activities
        .filter(act => {
            // Track only Playing and Listening
            return act.type === ActivityType.Playing || act.type === ActivityType.Listening;
        })
        .filter(act => {
            // Filter out empty names
            return act.name && act.name.trim().length > 0;
        })
        .map(act => ({
            name: act.name,
            type: act.type,
        }));
}
