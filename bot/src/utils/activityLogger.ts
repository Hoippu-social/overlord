import { format } from 'date-fns';

// Simple in‑memory activity logger that stores events for the last 30 minutes.
// It is deliberately lightweight – suitable for a development bot.
// Each entry is a string with a timestamp.

type LogEntry = {
    timestamp: number; // epoch ms
    message: string;
};

const activityLog: LogEntry[] = [];

/**
 * Add a new log entry.
 * The entry is kept in memory and automatically purged after 30 minutes.
 */
export function logActivity(message: string): void {
    const now = Date.now();
    activityLog.push({ timestamp: now, message });
    // Remove entries older than 30 min (1800 000 ms)
    const cutoff = now - 30 * 60 * 1000;
    while (activityLog.length && activityLog[0].timestamp < cutoff) {
        activityLog.shift();
    }
}

/**
 * Retrieve all log entries from the last 30 minutes as a formatted string.
 */
export function getRecentActivity(): string {
    const now = Date.now();
    const cutoff = now - 30 * 60 * 1000;
    const recent = activityLog.filter(e => e.timestamp >= cutoff);
    if (recent.length === 0) return 'No recent activity.';
    return recent
        .map(e => `${format(e.timestamp, 'yyyy-MM-dd HH:mm:ss')} – ${e.message}`)
        .join('\n');
}
