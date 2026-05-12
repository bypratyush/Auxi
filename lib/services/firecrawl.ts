// Firecrawl client — page scrape to clean markdown.
// Docs: https://docs.firecrawl.dev
// TODO: implement scrape(url) -> { markdown, html, metadata }.
export async function scrapePage(_url: string): Promise<{ markdown: string; html: string }> {
  throw new Error('scrapePage not implemented');
}
