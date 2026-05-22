import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { BOT_OWNER_ID, MASTER_MODE_COOKIE } from '@/lib/constants';
import { getAppCookieOptions, getLegacyHostCookieOptions, getNextAuthSessionCookieName } from '@/lib/authCookies';

export async function GET(request: NextRequest) {
    const token = await getToken({
        req: request,
        secret: process.env.NEXTAUTH_SECRET,
        cookieName: getNextAuthSessionCookieName(),
    });
    const eligible = token?.sub === BOT_OWNER_ID;
    const enabled = eligible && request.cookies.get(MASTER_MODE_COOKIE)?.value === '1';

    return NextResponse.json({ eligible, enabled });
}

export async function POST(request: NextRequest) {
    const token = await getToken({
        req: request,
        secret: process.env.NEXTAUTH_SECRET,
        cookieName: getNextAuthSessionCookieName(),
    });
    if (token?.sub !== BOT_OWNER_ID) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    const enabled = body?.enabled === true;
    const response = NextResponse.json({ eligible: true, enabled });

    if (enabled) {
        response.cookies.set(MASTER_MODE_COOKIE, '1', getAppCookieOptions(60 * 60 * 24 * 30));
    } else {
        response.cookies.set(MASTER_MODE_COOKIE, '', getAppCookieOptions(0));
        response.cookies.set(MASTER_MODE_COOKIE, '', getLegacyHostCookieOptions(0));
    }

    return response;
}
