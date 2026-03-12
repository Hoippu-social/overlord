export function parseDurationToMinutes(input: string) {
    const value = input.trim().toLowerCase();
    const regex = /(\d+)\s*(d|h|m)/g;
    let totalMinutes = 0;
    let matched = false;

    for (const match of value.matchAll(regex)) {
        matched = true;
        const amount = Number(match[1]);
        const unit = match[2];
        if (!Number.isFinite(amount) || amount <= 0) return null;
        if (unit === 'd') totalMinutes += amount * 24 * 60;
        if (unit === 'h') totalMinutes += amount * 60;
        if (unit === 'm') totalMinutes += amount;
    }

    if (!matched) {
        const asNumber = Number(value);
        if (Number.isFinite(asNumber) && asNumber > 0) {
            totalMinutes = asNumber;
        }
    }

    return totalMinutes > 0 ? totalMinutes : null;
}

export function parseDurationToSeconds(input: string) {
    const minutes = parseDurationToMinutes(input);
    return minutes ? minutes * 60 : null;
}

export function formatDurationFromMinutes(totalMinutes: number) {
    const days = Math.floor(totalMinutes / (24 * 60));
    const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
    const minutes = totalMinutes % 60;
    const parts = [];
    if (days) parts.push(`${days}d`);
    if (hours) parts.push(`${hours}h`);
    if (minutes) parts.push(`${minutes}m`);
    return parts.join(' ') || '0m';
}
