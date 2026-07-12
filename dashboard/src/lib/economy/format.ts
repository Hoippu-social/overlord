import type { LocaleCode } from '@/lib/i18n';

/**
 * Formats a money value (a BigInt-as-string from the wire, or a bigint/number)
 * with grouped thousands. Never loses precision — grouping is done on the string,
 * not via Number(). Negative values keep their sign.
 */
export function formatMoney(value: string | bigint | number): string {
    let str = typeof value === 'string' ? value.trim() : value.toString();
    if (str === '' || str === 'NaN') return '0';

    let negative = false;
    if (str.startsWith('-')) {
        negative = true;
        str = str.slice(1);
    }
    // Strip any accidental decimal part — economy amounts are integers.
    const dot = str.indexOf('.');
    if (dot >= 0) str = str.slice(0, dot);
    if (str === '' || /[^0-9]/.test(str)) str = str.replace(/[^0-9]/g, '') || '0';

    const grouped = str.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return negative ? `-${grouped}` : grouped;
}

/** Money value + currency label/emoji, e.g. "1 380 450 ✦". */
/**
 * True if the value is a Discord custom-emoji reference (`<:name:id>` or `<a:name:id>`).
 * These only render as an image inside Discord — outside it (dashboard plain text,
 * chart labels) they must fall back to the currency name instead of the raw tag.
 */
export function isCustomEmojiTag(value: string | null | undefined): boolean {
    return !!value && /^<a?:[A-Za-z0-9_~]+:\d+>$/.test(value);
}

/** Plain-text currency symbol: real unicode emoji pass through, custom Discord emoji
 *  tags fall back to the currency name since they can't render as text. */
export function currencySymbolText(currency: { name: string; emoji: string | null }): string {
    return currency.emoji && !isCustomEmojiTag(currency.emoji) ? currency.emoji : currency.name;
}

export function formatCurrency(
    value: string | bigint | number,
    currency: { name: string; emoji: string | null }
): string {
    const amount = formatMoney(value);
    const symbol = currencySymbolText(currency);
    return `${amount} ${symbol}`;
}

/** Compact abbreviated money for tight KPI cards: 1.38M, 24.5K, 950. */
export function formatMoneyCompact(value: string | bigint | number): string {
    let n: number;
    try {
        n = typeof value === 'number' ? value : Number(BigInt(typeof value === 'string' ? (value.split('.')[0] || '0') : value));
    } catch {
        n = Number(value) || 0;
    }
    const abs = Math.abs(n);
    const sign = n < 0 ? '-' : '';
    if (abs >= 1_000_000_000) return `${sign}${(abs / 1_000_000_000).toFixed(2)}B`;
    if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(2)}M`;
    if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(1)}K`;
    return `${sign}${abs}`;
}

/** Basis points → percentage label, e.g. 500 → "5%", 250 → "2.5%". */
export function formatBps(bps: number): string {
    const pct = bps / 100;
    return Number.isInteger(pct) ? `${pct}%` : `${pct.toFixed(1)}%`;
}

/** Multiplier float → "×1.5" label. */
export function formatMultiplier(m: number): string {
    return `×${Number.isInteger(m) ? m : m.toFixed(2)}`;
}

/** ISO timestamp → localized short date-time. */
export function formatDateTime(iso: string, locale: LocaleCode): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString(locale === 'ru' ? 'ru-RU' : 'en-US', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

/** ISO timestamp → localized short date (no time). */
export function formatDate(iso: string, locale: LocaleCode): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString(locale === 'ru' ? 'ru-RU' : 'en-US', {
        day: '2-digit',
        month: '2-digit',
    });
}

/** Relative "5м назад" / "5m ago" from an ISO timestamp. */
export function formatRelative(iso: string, locale: LocaleCode): string {
    const diffMs = Date.now() - new Date(iso).getTime();
    const past = diffMs >= 0;
    const abs = Math.abs(diffMs);
    const mins = Math.round(abs / 60000);

    let label: string;
    if (mins < 60) label = locale === 'ru' ? `${mins}м` : `${mins}m`;
    else if (mins < 1440) label = locale === 'ru' ? `${Math.floor(mins / 60)}ч` : `${Math.floor(mins / 60)}h`;
    else label = locale === 'ru' ? `${Math.floor(mins / 1440)}д` : `${Math.floor(mins / 1440)}d`;

    if (locale === 'ru') return past ? `${label} назад` : `через ${label}`;
    return past ? `${label} ago` : `in ${label}`;
}

/** True if a ledger amount string represents emission (money entering the economy). */
export function isEmission(amountStr: string): boolean {
    return !amountStr.trim().startsWith('-');
}
