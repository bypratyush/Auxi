// Browser-side Supabase client.
// Use in client components ("use client") to trigger OAuth flows or read the
// current session. Reads cookies set by our server-side callback route.

import { createBrowserClient } from '@supabase/ssr';

export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
