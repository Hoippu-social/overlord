import { NextResponse } from 'next/server';
import { getAppCookieOptions, LOCAL_SESSION_COOKIE_NAME } from '@/lib/authCookies';

export async function POST(request: Request) {
    const body = await request.json();
    const { password } = body;

    if (password === process.env.DASHBOARD_PASSWORD) {
        // Generate a simple session token with timestamp for uniqueness
        const sessionToken = `session_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;

        const response = NextResponse.json({ success: true });
        response.cookies.set(LOCAL_SESSION_COOKIE_NAME, sessionToken, getAppCookieOptions(60 * 60 * 24 * 7));
        return response;
    }

    return NextResponse.json({ success: false }, { status: 401 });
}
