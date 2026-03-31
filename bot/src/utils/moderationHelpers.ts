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

const ACTION_LABELS = {
    WARN: { ru: 'Варн', en: 'Warn' },
    UNWARN: { ru: 'Снятие варна', en: 'Warn removal' },
    MUTE: { ru: 'Мут', en: 'Mute' },
    UNMUTE: { ru: 'Снятие мута', en: 'Mute removal' },
    TIMEOUT: { ru: 'Тайм-аут', en: 'Timeout' },
    UNTIMEOUT: { ru: 'Снятие тайм-аута', en: 'Timeout removal' },
    KICK: { ru: 'Кик', en: 'Kick' },
    BAN: { ru: 'Бан', en: 'Ban' },
    TEMPBAN: { ru: 'Временный бан', en: 'Temporary ban' },
    UNBAN: { ru: 'Снятие бана', en: 'Ban removal' },
    NOTE: { ru: 'Примечание', en: 'Note' },
    NOTE_CLEAR: { ru: 'Снятие примечания', en: 'Note removal' },
    CLEAR: { ru: 'Очистка сообщений', en: 'Message clear' },
    SLOWMODE: { ru: 'Slowmode', en: 'Slowmode' },
    SLOWMODE_CLEAR: { ru: 'Снятие slowmode', en: 'Slowmode clear' },
    LOCK: { ru: 'Закрытие канала', en: 'Channel lock' },
    UNLOCK: { ru: 'Открытие канала', en: 'Channel unlock' },
    VOICE_KICK: { ru: 'Кик из голоса', en: 'Voice disconnect' },
    VOICE_MOVE: { ru: 'Перемещение в голосе', en: 'Voice move' },
} as const;

const STATUS_LABELS = {
    ACTIVE: { ru: 'Активен', en: 'Active' },
    EXPIRED: { ru: 'Истек', en: 'Expired' },
    CLEARED: { ru: 'Снят', en: 'Cleared' },
    REVERTED: { ru: 'Отменен', en: 'Reverted' },
    INFO: { ru: 'Инфо', en: 'Info' },
} as const;

const SOURCE_LABELS = {
    manual: { ru: 'Вручную', en: 'Manual' },
    system: { ru: 'Система', en: 'System' },
    automod: { ru: 'AutoMod', en: 'AutoMod' },
    ai: { ru: 'AI', en: 'AI' },
} as const;

export function localizeModerationAction(locale: 'ru' | 'en', actionType: string) {
    const label = ACTION_LABELS[actionType as keyof typeof ACTION_LABELS];
    return label ? label[locale] : actionType;
}

export function localizeModerationStatus(locale: 'ru' | 'en', status: string) {
    const label = STATUS_LABELS[status as keyof typeof STATUS_LABELS];
    return label ? label[locale] : status;
}

export function localizeModerationSource(locale: 'ru' | 'en', source: string) {
    const label = SOURCE_LABELS[source as keyof typeof SOURCE_LABELS];
    return label ? label[locale] : source;
}
