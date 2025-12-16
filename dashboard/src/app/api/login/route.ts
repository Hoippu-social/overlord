import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
    const body = await request.json();
    const { password } = body;

    if (password === process.env.DASHBOARD_PASSWORD) {
        // Generate a simple session token with timestamp for uniqueness
        const sessionToken = `session_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;

        // Set session cookie with unique token
        (await cookies()).set('session', sessionToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 60 * 60 * 24 * 7, // 1 week
            path: '/',
        });

        return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false }, { status: 401 });
}
