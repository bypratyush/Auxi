// Multi-source URL discovery via sitemap + robots.txt parsing.
// Edge-runtime compatible: uses DecompressionStream (Web Streams) for .gz,
// not Node's zlib. fast-xml-parser is pure JS, runs anywhere.
//
// Pipeline:
//   1. Fetch robots.txt and extract `Sitemap:` directives
//   2. HEAD-probe a list of conventional sitemap paths in parallel
//   3. Merge + dedupe the candidate sitemap URLs
//   4. Fetch each, parse, recurse into <sitemapindex> children
//   5. Return all extracted <url><loc> entries with metadata
//
// We cap the total returned URLs so a Shopify store with 50,000 product
// URLs doesn't blow our memory/time budget.

import { XMLParser } from 'fast-xml-parser';

const parser = new XMLParser({ ignoreAttributes: false });

export interface SitemapURL {
  loc: string;
  lastmod?: string;
  /** 0.0 to 1.0 — declared importance from the site owner. Useful for ranking. */
  priority?: number;
  changefreq?: string;
}

const LIMITS = {
  /** Hard cap on URLs returned across all sitemaps for this audit. */
  maxTotalUrls: 1000,
  /** Max recursion depth into nested sitemap index files. */
  maxIndexDepth: 3,
  /** Per-fetch timeouts. */
  robotsTimeoutMs: 5_000,
  probeTimeoutMs: 4_000,
  sitemapTimeoutMs: 10_000,
};

const SITEMAP_PATHS = [
  '/sitemap.xml',
  '/sitemap_index.xml',
  '/sitemap-index.xml',
  '/sitemaps.xml',
  '/sitemap/sitemap.xml',
  '/wp-sitemap.xml',
  '/sitemap.xml.gz',
  '/page-sitemap.xml',
  '/post-sitemap.xml',
];

/** Top-level entry. Returns deduplicated, capped list of URLs from all discovered sitemaps. */
export async function extractAllSitemapURLs(baseUrl: string): Promise<SitemapURL[]> {
  let origin: string;
  try {
    origin = new URL(baseUrl).origin;
  } catch {
    return [];
  }

  const [robotsUrls, probeUrls] = await Promise.all([
    getSitemapUrlsFromRobots(origin),
    probeSitemapLocations(origin),
  ]);

  const sitemapUrls = Array.from(new Set([...robotsUrls, ...probeUrls]));
  if (sitemapUrls.length === 0) return [];

  const allUrls = await fetchAndParseSitemaps(sitemapUrls, origin, 0);

  // Dedupe by loc, preserving the first occurrence (with its metadata)
  const seen = new Set<string>();
  const out: SitemapURL[] = [];
  for (const u of allUrls) {
    if (!u.loc || seen.has(u.loc)) continue;
    seen.add(u.loc);
    out.push(u);
    if (out.length >= LIMITS.maxTotalUrls) break;
  }
  return out;
}

// ── robots.txt — parse `Sitemap:` directives ─────────────
async function getSitemapUrlsFromRobots(origin: string): Promise<string[]> {
  try {
    const res = await fetch(`${origin}/robots.txt`, {
      signal: AbortSignal.timeout(LIMITS.robotsTimeoutMs),
    });
    if (!res.ok) return [];
    const text = await res.text();
    return text
      .split('\n')
      .filter((line) => line.toLowerCase().trim().startsWith('sitemap:'))
      // Use indexOf(":") rather than split(":", 2) because the URL contains a colon
      .map((line) => line.slice(line.indexOf(':') + 1).trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

// ── Probe conventional sitemap paths in parallel ─────────
async function probeSitemapLocations(origin: string): Promise<string[]> {
  const results = await Promise.allSettled(
    SITEMAP_PATHS.map(async (path): Promise<string | null> => {
      const url = `${origin}${path}`;
      try {
        const res = await fetch(url, {
          method: 'HEAD',
          signal: AbortSignal.timeout(LIMITS.probeTimeoutMs),
        });
        return res.ok ? url : null;
      } catch {
        return null;
      }
    }),
  );

  return results
    .filter(
      (r): r is PromiseFulfilledResult<string> =>
        r.status === 'fulfilled' && typeof r.value === 'string',
    )
    .map((r) => r.value);
}

// ── Fetch + parse, recurse into <sitemapindex> children ──
async function fetchAndParseSitemaps(
  urls: string[],
  origin: string,
  depth: number,
): Promise<SitemapURL[]> {
  if (depth > LIMITS.maxIndexDepth) return [];
  const results = await Promise.allSettled(urls.map((url) => fetchSitemap(url, origin, depth)));
  const out: SitemapURL[] = [];
  for (const r of results) {
    if (r.status === 'fulfilled') {
      out.push(...r.value);
      if (out.length >= LIMITS.maxTotalUrls) return out.slice(0, LIMITS.maxTotalUrls);
    }
  }
  return out;
}

async function fetchSitemap(url: string, origin: string, depth: number): Promise<SitemapURL[]> {
  let res: Response;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(LIMITS.sitemapTimeoutMs) });
  } catch {
    return [];
  }
  if (!res.ok) return [];

  // Decompress if gzipped — Edge-compatible via DecompressionStream.
  let text: string;
  try {
    if (url.endsWith('.gz')) {
      const decompressed = res.body?.pipeThrough(new DecompressionStream('gzip'));
      if (!decompressed) return [];
      text = await new Response(decompressed).text();
    } else {
      text = await res.text();
    }
  } catch {
    return [];
  }

  // Parse — tolerate any wrongly-typed content; we just attempt the XML parse
  let parsed: Record<string, unknown>;
  try {
    parsed = parser.parse(text) as Record<string, unknown>;
  } catch {
    return [];
  }

  // Sitemap INDEX → recurse into children
  const sitemapindex = parsed.sitemapindex as { sitemap?: unknown } | undefined;
  if (sitemapindex) {
    const children = toArray<{ loc?: string }>(sitemapindex.sitemap)
      .map((s) => s.loc)
      .filter((loc): loc is string => Boolean(loc))
      .map((loc) => absolutize(loc, origin));
    return fetchAndParseSitemaps(children, origin, depth + 1);
  }

  // Regular sitemap → extract URLs
  const urlset = parsed.urlset as { url?: unknown } | undefined;
  if (urlset) {
    return toArray<{
      loc?: string;
      lastmod?: string;
      priority?: string | number;
      changefreq?: string;
    }>(urlset.url)
      .filter((u) => Boolean(u.loc))
      .map((u) => ({
        loc: absolutize(u.loc as string, origin),
        lastmod: typeof u.lastmod === 'string' ? u.lastmod : undefined,
        priority:
          u.priority !== undefined && u.priority !== null
            ? typeof u.priority === 'number'
              ? u.priority
              : parseFloat(String(u.priority))
            : undefined,
        changefreq: typeof u.changefreq === 'string' ? u.changefreq : undefined,
      }));
  }

  return [];
}

// ── Helpers ──────────────────────────────────────────────
function toArray<T>(val: unknown): T[] {
  if (val === undefined || val === null) return [];
  return Array.isArray(val) ? (val as T[]) : [val as T];
}

function absolutize(loc: string, origin: string): string {
  try {
    return new URL(loc, origin).href;
  } catch {
    return loc;
  }
}
