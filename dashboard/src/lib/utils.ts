export function formatDate(date: string | Date): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return typeof date === 'string' ? date : '';

    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();

    return `${day}.${month}.${year}`;
}

export function formatDateInTimezone(date: string | Date, timeZone: string, locale: 'ru' | 'en' = 'ru'): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return typeof date === 'string' ? date : '';

    return new Intl.DateTimeFormat(locale === 'ru' ? 'ru-RU' : 'en-GB', {
        timeZone,
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    }).format(d);
}

export function formatChartDate(dateStr: string): string {
    if (!dateStr) return '';

    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        const [y, m, d] = dateStr.split('-');
        return `${d}.${m}.${y}`;
    }

    if (/^\d{2}\.\d{2} \d{2}:\d{2}$/.test(dateStr)) {
        return dateStr;
    }

    return dateStr;
}

export function formatYAxis(value: number, locale: 'ru' | 'en'): string {
    if (value >= 1_000_000) {
        const val = value / 1_000_000;
        const str = Number.isInteger(val) ? val.toString() : val.toFixed(1).replace(/\.0$/, '');
        return locale === 'ru' ? `${str} млн` : `${str}M`;
    }

    if (value >= 10_000) {
        const val = value / 1_000;
        const str = Number.isInteger(val) ? val.toString() : val.toFixed(1).replace(/\.0$/, '');
        return locale === 'ru' ? `${str} тыс.` : `${str}k`;
    }

    return value.toString();
}

export function formatLocaleNumber(value: number, locale: 'ru' | 'en'): string {
    return value.toLocaleString(locale === 'ru' ? 'ru-RU' : 'en-US');
}
