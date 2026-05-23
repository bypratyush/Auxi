// Debug-only: GET /api/debug/discovery?url=<encodedUrl>&category=<websiteType>
// Runs Firecrawl map + sitemap extraction in parallel and shows each source's
// raw output plus the merged candidate pool and final role-matched picks.
// Lets you see exactly what the audit pipeline would discover for a site.

import { mapSite } from '@/lib/services/firecrawl';
import { extractAllSitemapURLs } from '@/lib/audit/sitemap';
import { discoverPages } from '@/lib/audit/page-discovery';
import { subTools } from '@/lib/sub-tools';
import type { WebsiteType } from '@/lib/audit/types';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

const VALID_TYPES: WebsiteType[] = [
  'ecommerce',
  'saas',
  'landing',
  'blog',
  'portfolio',
  'docs',
  'nonprofit',
  'news',
];

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get('url');
  const category = (searchParams.get('category') || 'ecommerce') as WebsiteType;

  if (!url) {
    return new Response(
      JSON.stringify({
        error:
          'Pass ?url= (and optional &category=). Example: /api/debug/discovery?url=https://stripe.com&category=saas',
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }
  if (!VALID_TYPES.includes(category)) {
    return new Response(
      JSON.stringify({ error: `Invalid category. One of: ${VALID_TYPES.join(', ')}` }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const subTool = subTools[category];

  // Run each source independently so we can show their raw output side-by-side.
  const [mapRes, sitemapRes, discoveryRes] = await Promise.allSettled([
    mapSite(url, 200),
    extractAllSitemapURLs(url),
    discoverPages(url, subTool.discoveryPlan, 5),
  ]);

  const body = {
    input: { url, category, subToolLabel: subTool.label },
    sources: {
      firecrawlMap:
        mapRes.status === 'fulfilled'
          ? { count: mapRes.value.length, sample: mapRes.value.slice(0, 30) }
          : { error: String(mapRes.reason) },
      sitemap:
        sitemapRes.status === 'fulfilled'
          ? { count: sitemapRes.value.length, sample: sitemapRes.value.slice(0, 30) }
          : { error: String(sitemapRes.reason) },
    },
    discovery:
      discoveryRes.status === 'fulfilled'
        ? discoveryRes.value
        : { error: String(discoveryRes.reason) },
  };

  return new Response(JSON.stringify(body, null, 2), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}
