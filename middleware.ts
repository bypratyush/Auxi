// Auth middleware.
// Runs on the Edge for every matched request. Responsibilities:
//   1. Refresh the Supabase auth cookie if it's about to expire (required for SSR auth).
//   2. Redirect unauthenticated users off protected routes (just `/` for now).
//   3. Redirect signed-in users off /login → /.

import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

export async function middleware(req: NextRequest) {
  let response = NextResponse.next({ request: { headers: req.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return req.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          req.cookies.set({ name, value, ...options });
          response = NextResponse.next({ request: { headers: req.headers } });
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          req.cookies.set({ name, value: '', ...options });
          response = NextResponse.next({ request: { headers: req.headers } });
          response.cookies.set({ name, value: '', ...options });
        },
      },
    },
  );

  // Touching getUser() will refresh the cookie if it's expired.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = req.nextUrl.pathname;
  const isLogin = path === '/login';
  const isHome = path === '/';

  // Signed-in user lands on /login → straight to /
  if (isLogin && user) {
    const url = req.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

  // Signed-out user hits a protected route → /login
  if (isHome && !user) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  return response;
}

// Match only paths we actually want middleware to run on.
// Explicitly exclude /api/audits — that route validates auth itself and would
// have its body consumed by middleware otherwise.
export const config = {
  matcher: ['/', '/login'],
};
