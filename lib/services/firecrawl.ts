// Firecrawl — POST /v2/scrape returns cleaned page markdown + html.
// Docs: https://docs.firecrawl.dev/api-reference/v2-endpoint/scrape

const ENDPOINT = 'https://api.firecrawl.dev/v2/scrape';

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

  const res = await fetch(ENDPOINT, {
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
