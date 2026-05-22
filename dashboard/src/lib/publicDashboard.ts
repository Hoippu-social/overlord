export const PUBLIC_DASHBOARD_HOST = 'dashboard.overlord.ink';
export const INTERNAL_DASHBOARD_PREFIX = '/dashboard';

function normalizeHost(host?: string | null) {
    return (host ?? '').split(':')[0].toLowerCase();
}

export function isPublicDashboardHost(host?: string | null) {
    return normalizeHost(host) === PUBLIC_DASHBOARD_HOST;
}

export function getRequestPublicHost(headers: Headers) {
    return headers.get('x-overlord-public-host') ?? headers.get('x-forwarded-host') ?? headers.get('host');
}

export function getBrowserPublicHost() {
    return typeof window === 'undefined' ? null : window.location.host;
}

export function getDashboardHomePath(host?: string | null) {
    return isPublicDashboardHost(host) ? '/' : INTERNAL_DASHBOARD_PREFIX;
}

export function toPublicDashboardPath(path: string, host?: string | null) {
    if (!isPublicDashboardHost(host)) {
        return path;
    }

    if (path === INTERNAL_DASHBOARD_PREFIX) {
        return '/';
    }

    if (path.startsWith(`${INTERNAL_DASHBOARD_PREFIX}/`)) {
        return path.slice(INTERNAL_DASHBOARD_PREFIX.length);
    }

    return path;
}
