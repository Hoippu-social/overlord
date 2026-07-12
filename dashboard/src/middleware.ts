import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { getDashboardHomePath, getRequestPublicHost } from '@/lib/publicDashboard';
import { getNextAuthSessionCookieName, LOCAL_SESSION_COOKIE_NAME } from '@/lib/authCookies';
import { verifyLocalSessionToken } from '@/lib/localSession';

export async function middleware(request: NextRequest) {
    if (process.env.NODE_ENV !== 'production' && request.nextUrl.pathname.startsWith('/_next/static/chunks/')) {
        const response = NextResponse.next();
        response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        response.headers.set('Pragma', 'no-cache');
        response.headers.set('Expires', '0');
        return response;
    }

    const token = await getToken({
        req: request,
        secret: process.env.NEXTAUTH_SECRET,
        cookieName: getNextAuthSessionCookieName(),
    });
    const sessionToken = request.cookies.get(LOCAL_SESSION_COOKIE_NAME);
    const hasValidLocalSession = await verifyLocalSessionToken(sessionToken?.value);
    const isAuthenticated = Boolean(token) || hasValidLocalSession;
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
    matcher: ['/dashboard/:path*', '/login', '/_next/static/chunks/:path*'],
};
