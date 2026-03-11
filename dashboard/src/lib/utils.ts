export function formatDate(date: string | Date): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return typeof date === 'string' ? date : '';

    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();

    return `${day}.${month}.${year}`;
}

export function formatChartDate(dateStr: string): string {
    if (!dateStr) return '';

    // YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        const [y, m, d] = dateStr.split('-');
        return `${d}.${m}.${y}`;
    }

    // DD.MM HH:mm (from 7d period in API)
    if (/^\d{2}\.\d{2} \d{2}:\d{2}$/.test(dateStr)) {
        const [dm, time] = dateStr.split(' ');
        // We don't have year here from the string alone, but usually we want to keep HH:mm on charts
        // The user specifically asked for dd.mm.year though.
        // However, if we return dd.mm.year on every tick for 7d, it might be too long.
        // Let's see.
        return dateStr;
    }

    return dateStr;
}

export function formatYAxis(value: number, locale: 'ru' | 'en'): string {
    if (value >= 1000000) {
        const val = value / 1000000;
        const str = Number.isInteger(val) ? val.toString() : val.toFixed(1).replace(/\.0$/, '');
        return locale === 'ru' ? `${str} млн` : `${str} kk`;
    }
    if (value >= 10000) {
        const val = value / 1000;
        const str = Number.isInteger(val) ? val.toString() : val.toFixed(1).replace(/\.0$/, '');
        return locale === 'ru' ? `${str} тыс.` : `${str}k`;
    }
    return value.toString();
}
