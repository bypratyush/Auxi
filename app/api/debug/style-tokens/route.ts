// Debug-only: GET /api/debug/style-tokens?url=<encodedUrl>[&url=...]
// Fetches each URL's HTML with plain fetch (no Firecrawl credit) and runs the
// declared-token extractor. Returns the same DesignTokens shape the audit pipeline
// would feed to the LLM. Useful for previewing what B is producing per site.

import { extractStyleTokens } from '@/lib/services/style-tokens';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36 AuxiDebug/0.1';

async function fetchHtml(url: string): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12_000);
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,*/*;q=0.5' },
      signal: ctrl.signal,
      redirect: 'follow',
    });
    if (!res.ok) throw new Error(`upstream ${res.status} ${res.statusText}`);
    const ct = res.headers.get('content-type') || '';
    if (!/html/i.test(ct)) throw new Error(`unexpected content-type: ${ct}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const urls = searchParams.getAll('url');
  if (urls.length === 0) {
    return new Response(
      JSON.stringify({
        error:
          'Pass at least one ?url= param. Example: /api/debug/style-tokens?url=https://stripe.com',
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const pages: { url: string; html: string }[] = [];
  const fetchErrors: { url: string; error: string }[] = [];

  await Promise.all(
    urls.map(async (url) => {
      try {
        const html = await fetchHtml(url);
        pages.push({ url, html });
      } catch (e) {
        fetchErrors.push({ url, error: e instanceof Error ? e.message : String(e) });
      }
    }),
  );

  const tokens = pages.length > 0 ? await extractStyleTokens(pages) : null;

  return new Response(
    JSON.stringify(
      {
        input: { urls, pagesFetched: pages.length, fetchErrors },
        tokens,
      },
      null,
      2,
    ),
    { headers: { 'Content-Type': 'application/json; charset=utf-8' } },
  );
}
