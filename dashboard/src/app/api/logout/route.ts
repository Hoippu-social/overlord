import { NextResponse } from 'next/server';
import { getAppCookieOptions, getLegacyHostCookieOptions, LOCAL_SESSION_COOKIE_NAME } from '@/lib/authCookies';
import { MASTER_MODE_COOKIE } from '@/lib/constants';

export async function POST() {
  const response = NextResponse.json({ success: true });
  const expiredSharedCookie = getAppCookieOptions(0);
  const expiredLegacyCookie = getLegacyHostCookieOptions(0);

  response.cookies.set(LOCAL_SESSION_COOKIE_NAME, '', expiredSharedCookie);
  response.cookies.set(MASTER_MODE_COOKIE, '', expiredSharedCookie);
  response.cookies.set(LOCAL_SESSION_COOKIE_NAME, '', expiredLegacyCookie);
  response.cookies.set(MASTER_MODE_COOKIE, '', expiredLegacyCookie);

  return response;
}
