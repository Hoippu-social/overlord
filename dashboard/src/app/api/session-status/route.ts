import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { LOCAL_SESSION_COOKIE_NAME } from '@/lib/authCookies';

export const dynamic = 'force-dynamic';

export async function GET() {
    const session = await getServerSession(authOptions);
    const cookieStore = await cookies();
    const hasLocalSession = Boolean(cookieStore.get(LOCAL_SESSION_COOKIE_NAME)?.value);

    return NextResponse.json(
        {
            authenticated: Boolean(session?.user || hasLocalSession),
            localOnly: !session?.user && hasLocalSession,
            user: session?.user
                ? {
                      id: (session.user as { id?: string }).id ?? null,
                      name: session.user.name ?? null,
                      image: session.user.image ?? null,
                  }
                : null,
        },
        {
            headers: {
                'Cache-Control': 'private, no-store, max-age=0',
                Vary: 'Cookie',
            },
        }
    );
}
