// Firecrawl — single-page scrape + site-wide URL map.
// Docs: https://docs.firecrawl.dev/api-reference/v2-endpoint/scrape
//       https://docs.firecrawl.dev/api-reference/v2-endpoint/map

const SCRAPE_ENDPOINT = 'https://api.firecrawl.dev/v2/scrape';
const MAP_ENDPOINT = 'https://api.firecrawl.dev/v2/map';

export interface ScrapedPage {
  markdown: string;
  html: string;
  title: string | null;
  description: string | null;
  url: string;
}

interface FirecrawlResponse {
  success: boolean;
  data?: {
    markdown?: string;
    html?: string;
    metadata?: {
      title?: string;
      description?: string;
      ogTitle?: string;
      ogDescription?: string;
      sourceURL?: string;
      statusCode?: number;
    };
  };
  error?: string;
}

export async function scrapePage(url: string): Promise<ScrapedPage> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) throw new Error('FIRECRAWL_API_KEY is not set');

  const res = await fetch(SCRAPE_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url,
      formats: ['markdown', 'html'],
      onlyMainContent: true,
      blockAds: true,
      waitFor: 1500,
      timeout: 25000,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Firecrawl ${res.status}: ${body.slice(0, 200)}`);
  }

  const json = (await res.json()) as FirecrawlResponse;
  if (!json.success || !json.data) {
    throw new Error(`Firecrawl returned no data: ${json.error ?? 'unknown'}`);
  }

  const md = json.data.markdown ?? '';
  const html = json.data.html ?? '';
  const meta = json.data.metadata ?? {};

  return {
    markdown: md,
    html,
    title: meta.title ?? meta.ogTitle ?? null,
    description: meta.description ?? meta.ogDescription ?? null,
    url: meta.sourceURL ?? url,
  };
}

interface FirecrawlMapResponse {
  success?: boolean;
  links?: Array<string | { url: string; title?: string }>;
  data?: { links?: Array<string | { url: string; title?: string }> };
  error?: string;
}

export interface MappedLink {
  url: string;
  title: string | null;
}

/**
 * Map a site — returns all discoverable internal URLs. ~1 Firecrawl credit.
 * v2 may return links as strings or as {url, title} objects; we normalize.
 */
export async function mapSite(rootUrl: string, limit = 200): Promise<MappedLink[]> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) throw new Error('FIRECRAWL_API_KEY is not set');

  const res = await fetch(MAP_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    // v2 /map body is minimal — url + limit. Older keys like `ignoreSitemap`
    // are rejected with a 400 "Unrecognized key in body".
    body: JSON.stringify({ url: rootUrl, limit }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Firecrawl map ${res.status}: ${body.slice(0, 200)}`);
  }

  const json = (await res.json()) as FirecrawlMapResponse;
  const rawLinks = json.links ?? json.data?.links ?? [];
  return rawLinks
    .map<MappedLink | null>((l) => {
      if (typeof l === 'string') return { url: l, title: null };
      if (l && typeof l === 'object' && typeof l.url === 'string') {
        return { url: l.url, title: l.title ?? null };
      }
      return null;
    })
    .filter((x): x is MappedLink => x !== null);
}
