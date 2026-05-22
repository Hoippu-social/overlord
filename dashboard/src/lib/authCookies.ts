import type { NextAuthOptions } from 'next-auth';

type NextAuthCookies = NonNullable<NextAuthOptions['cookies']>;
type NextAuthCookie = NonNullable<NextAuthCookies['sessionToken']>;
type NextAuthCookieOptions = NextAuthCookie['options'];

export const LOCAL_SESSION_COOKIE_NAME = 'session';

const SHARED_COOKIE_DOMAIN = '.overlord.ink';
const OAUTH_COOKIE_MAX_AGE = 60 * 15;

function isOverlordHost(hostname: string) {
    const host = hostname.toLowerCase();
    return host === 'overlord.ink' || host.endsWith('.overlord.ink');
}

export function getSharedCookieDomain() {
    const configuredDomain = process.env.AUTH_COOKIE_DOMAIN?.trim();
    if (configuredDomain) {
        return configuredDomain === 'none' ? undefined : configuredDomain;
    }

    try {
        const nextAuthUrl = process.env.NEXTAUTH_URL ? new URL(process.env.NEXTAUTH_URL) : null;
        if (nextAuthUrl && isOverlordHost(nextAuthUrl.hostname)) {
            return SHARED_COOKIE_DOMAIN;
        }
    } catch {
        return undefined;
    }

    return undefined;
}

function shouldUseSharedCookieDomain() {
    return Boolean(getSharedCookieDomain());
}

function shouldUseSecureCookies() {
    if (process.env.NODE_ENV === 'production' || shouldUseSharedCookieDomain()) {
        return true;
    }

    try {
        return process.env.NEXTAUTH_URL ? new URL(process.env.NEXTAUTH_URL).protocol === 'https:' : false;
    } catch {
        return false;
    }
}

function secureCookiePrefix() {
    return shouldUseSecureCookies() ? '__Secure-' : '';
}

function shouldUseSecureAppCookies() {
    return process.env.NODE_ENV === 'production' || shouldUseSharedCookieDomain();
}

export function getNextAuthSessionCookieName() {
    if (!shouldUseSharedCookieDomain()) {
        return undefined;
    }

    return `${secureCookiePrefix()}overlord-auth.session-token`;
}

function createNextAuthCookie(name: string, maxAge?: number): NextAuthCookie {
    const domain = getSharedCookieDomain();
    const options: NextAuthCookieOptions = {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: shouldUseSecureCookies(),
        ...(domain ? { domain } : {}),
        ...(maxAge ? { maxAge } : {}),
    };

    return { name, options };
}

export function createSharedNextAuthCookies(): NextAuthOptions['cookies'] | undefined {
    if (!shouldUseSharedCookieDomain()) {
        return undefined;
    }

    const prefix = secureCookiePrefix();

    return {
        sessionToken: createNextAuthCookie(`${prefix}overlord-auth.session-token`),
        callbackUrl: createNextAuthCookie(`${prefix}overlord-auth.callback-url`),
        csrfToken: createNextAuthCookie(`${prefix}overlord-auth.csrf-token`),
        pkceCodeVerifier: createNextAuthCookie(`${prefix}overlord-auth.pkce.code_verifier`, OAUTH_COOKIE_MAX_AGE),
        state: createNextAuthCookie(`${prefix}overlord-auth.state`, OAUTH_COOKIE_MAX_AGE),
        nonce: createNextAuthCookie(`${prefix}overlord-auth.nonce`),
    };
}

export function getAppCookieOptions(maxAge?: number) {
    const domain = getSharedCookieDomain();

    return {
        httpOnly: true,
        secure: shouldUseSecureAppCookies(),
        sameSite: 'lax' as const,
        path: '/',
        ...(domain ? { domain } : {}),
        ...(typeof maxAge === 'number' ? { maxAge } : {}),
    };
}

export function getLegacyHostCookieOptions(maxAge?: number) {
    return {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax' as const,
        path: '/',
        ...(typeof maxAge === 'number' ? { maxAge } : {}),
    };
}
