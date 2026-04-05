import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { MASTER_MODE_COOKIE } from '@/lib/constants';

export async function POST() {
  const cookieStore = await cookies();
  cookieStore.delete('session');
  cookieStore.delete(MASTER_MODE_COOKIE);
  return NextResponse.json({ success: true });
}
