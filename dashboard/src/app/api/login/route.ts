import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { getAppCookieOptions, LOCAL_SESSION_COOKIE_NAME } from '@/lib/authCookies';
import { createLocalSessionToken } from '@/lib/localSession';

// Simple in-memory rate limiter keyed by client IP. Resets per process; good
// enough to blunt online password guessing on a single-instance dashboard.
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

type Attempt = { count: number; resetAt: number };
const attempts = new Map<string, Attempt>();

function getClientIp(request: Request): string {
    const forwarded = request.headers.get('x-forwarded-for');
    if (forwarded) {
        return forwarded.split(',')[0].trim();
    }
    return request.headers.get('x-real-ip') || 'unknown';
}

function isRateLimited(ip: string): boolean {
    const now = Date.now();
    const entry = attempts.get(ip);
    if (!entry || entry.resetAt <= now) {
        return false;
    }
    return entry.count >= MAX_ATTEMPTS;
}

function recordFailure(ip: string): void {
    const now = Date.now();
    const entry = attempts.get(ip);
    if (!entry || entry.resetAt <= now) {
        attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
        return;
    }
    entry.count += 1;
}

// Constant-time string comparison that does not leak length via early return.
function passwordMatches(provided: string, expected: string): boolean {
    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    if (a.length !== b.length) {
        // Still run a comparison against a same-length buffer to keep timing flat.
        timingSafeEqual(a, Buffer.alloc(a.length));
        return false;
    }
    return timingSafeEqual(a, b);
}

export async function POST(request: Request) {
    const ip = getClientIp(request);
    if (isRateLimited(ip)) {
        return NextResponse.json(
            { success: false, error: 'Too many attempts. Try again later.' },
            { status: 429 }
        );
    }

    const expected = process.env.DASHBOARD_PASSWORD;
    const body = await request.json().catch(() => ({}));
    const password = typeof body?.password === 'string' ? body.password : '';

    if (!expected || !passwordMatches(password, expected)) {
        recordFailure(ip);
        return NextResponse.json({ success: false }, { status: 401 });
    }

    const sessionToken = await createLocalSessionToken();
    if (!sessionToken) {
        // NEXTAUTH_SECRET missing — cannot mint a verifiable session.
        console.error('Cannot create local session: NEXTAUTH_SECRET is not set');
        return NextResponse.json({ success: false, error: 'Server misconfigured' }, { status: 500 });
    }

    attempts.delete(ip);
    const response = NextResponse.json({ success: true });
    response.cookies.set(LOCAL_SESSION_COOKIE_NAME, sessionToken, getAppCookieOptions(60 * 60 * 24 * 7));
    return response;
}
