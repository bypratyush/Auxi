// POST /auth/signout — clears the Supabase session cookie and sends user back to /login.

import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function POST(req: Request) {
  const supabase = createSupabaseServerClient();
  await supabase.auth.signOut();
  const url = new URL('/login', req.url);
  return NextResponse.redirect(url, { status: 303 });
}
