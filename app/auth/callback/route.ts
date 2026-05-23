// OAuth callback: exchanges the `code` Supabase appends to the redirect URL
// for a session cookie, then sends the user home.

import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function GET(req: Request) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';

  if (code) {
    const supabase = createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    console.warn('[auth/callback] exchange failed:', error.message);
  }

  // Anything went wrong — back to login with an error flag the page can surface.
  return NextResponse.redirect(`${origin}/login?error=oauth_failed`);
}
