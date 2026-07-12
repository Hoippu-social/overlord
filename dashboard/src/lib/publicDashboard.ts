export const INTERNAL_DASHBOARD_PREFIX = '/dashboard';
const CANONICAL_DASHBOARD_ORIGIN = 'https://overlord.ink';
const LEGACY_DASHBOARD_HOST = 'dashboard.overlord.ink';

function normalizeHost(host?: string | null) {
    const value = (host ?? '').split(',')[0]?.trim();
    if (!value) {
        return '';
    }

    try {
        const url = new URL(value.includes('://') ? value : `https://${value}`);
        return url.hostname.toLowerCase();
    } catch {
        return value.replace(/:\d+$/, '').toLowerCase();
    }
}

function isLegacyDashboardHost(host?: string | null) {
    return normalizeHost(host) === LEGACY_DASHBOARD_HOST;
}

function getPublicDashboardOrigin() {
    const configuredOrigin = process.env.NEXT_PUBLIC_DASHBOARD_ORIGIN?.trim();
    if (!configuredOrigin) {
        return CANONICAL_DASHBOARD_ORIGIN;
    }

    try {
        return new URL(configuredOrigin).origin;
    } catch {
        return CANONICAL_DASHBOARD_ORIGIN;
    }
}

function pathWithSearchAndHash(url: URL) {
    return `${url.pathname}${url.search}${url.hash}`;
}

function legacyDashboardPath(url: URL) {
    const pathname = url.pathname === '/' ? INTERNAL_DASHBOARD_PREFIX : url.pathname;
    return `${pathname}${url.search}${url.hash}`;
}

function toPublicDashboardUrl(path: string) {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `${getPublicDashboardOrigin()}${normalizedPath}`;
}

export function getRequestPublicHost(headers: Headers) {
    return headers.get('x-overlord-public-host') ?? headers.get('x-forwarded-host') ?? headers.get('host');
}

export function getBrowserPublicHost() {
    return typeof window === 'undefined' ? null : window.location.host;
}

export function getDashboardHomePath(host?: string | null) {
    if (isLegacyDashboardHost(host)) {
        return toPublicDashboardUrl(INTERNAL_DASHBOARD_PREFIX);
    }

    return INTERNAL_DASHBOARD_PREFIX;
}

export function toPublicDashboardPath(path: string, host?: string | null) {
    if (isLegacyDashboardHost(host)) {
        return toPublicDashboardUrl(path);
    }

    return path;
}

export function resolveAuthRedirectUrl(url: string, baseUrl: string) {
    const publicOrigin = getPublicDashboardOrigin();
    let base: URL;

    try {
        base = new URL(baseUrl);
    } catch {
        base = new URL(publicOrigin);
    }

    let target: URL;
    try {
        target = new URL(url, base);
    } catch {
        return isLegacyDashboardHost(base.hostname) ? publicOrigin : base.origin;
    }

    if (isLegacyDashboardHost(target.hostname)) {
        return `${publicOrigin}${legacyDashboardPath(target)}`;
    }

    if (target.origin === publicOrigin) {
        return target.toString();
    }

    if (url.startsWith('/') || target.origin === base.origin) {
        const origin = isLegacyDashboardHost(base.hostname) ? publicOrigin : base.origin;
        return `${origin}${pathWithSearchAndHash(target)}`;
    }

    return isLegacyDashboardHost(base.hostname) ? publicOrigin : base.origin;
}
