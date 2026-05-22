import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { getDashboardHomePath, getRequestPublicHost } from '@/lib/publicDashboard';
import { getNextAuthSessionCookieName, LOCAL_SESSION_COOKIE_NAME } from '@/lib/authCookies';

export async function middleware(request: NextRequest) {
    const token = await getToken({
        req: request,
        secret: process.env.NEXTAUTH_SECRET,
        cookieName: getNextAuthSessionCookieName(),
    });
    const sessionToken = request.cookies.get(LOCAL_SESSION_COOKIE_NAME);
    const isAuthenticated = Boolean(token) || (sessionToken && sessionToken.value);
    const publicHost = getRequestPublicHost(request.headers);
    const dashboardHomePath = getDashboardHomePath(publicHost);

    if (request.nextUrl.pathname.startsWith('/dashboard')) {
        if (!isAuthenticated) {
            return NextResponse.redirect(new URL('/login', request.url));
        }
    }

    if (request.nextUrl.pathname === '/login') {
        if (isAuthenticated) {
            return NextResponse.redirect(new URL(dashboardHomePath, request.url));
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/dashboard/:path*', '/login'],
};
