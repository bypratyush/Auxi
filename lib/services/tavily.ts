// Tavily — research search scoped to a sub-tool's preferred sources.
// Docs: https://docs.tavily.com/docs/rest-api/api-reference

const ENDPOINT = 'https://api.tavily.com/search';

export interface ResearchHit {
  title: string;
  url: string;
  snippet: string;
  score: number;
  query: string;
}

interface TavilyResponse {
  query: string;
  results: Array<{
    title: string;
    url: string;
    content: string;
    score: number;
  }>;
  answer?: string;
}

export async function searchResearch(
  query: string,
  includeDomains: string[] = [],
): Promise<ResearchHit[]> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) throw new Error('TAVILY_API_KEY is not set');

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query,
      search_depth: 'basic',
      include_domains: includeDomains,
      max_results: 5,
      include_answer: false,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Tavily ${res.status}: ${body.slice(0, 200)}`);
  }

  const json = (await res.json()) as TavilyResponse;
  return (json.results ?? []).map((r) => ({
    title: r.title,
    url: r.url,
    snippet: r.content,
    score: r.score,
    query,
  }));
}

export async function searchResearchBatch(
  queries: string[],
  includeDomains: string[] = [],
): Promise<ResearchHit[]> {
  const results = await Promise.allSettled(queries.map((q) => searchResearch(q, includeDomains)));
  return results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
}
