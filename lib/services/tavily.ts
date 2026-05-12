// Tavily client — live research fetch scoped to a sub-tool's preferred sources.
// Docs: https://docs.tavily.com
// TODO: implement search(query, includeDomains).
export async function searchResearch(
  _query: string,
  _includeDomains: string[],
): Promise<{ title: string; url: string; snippet: string }[]> {
  throw new Error('searchResearch not implemented');
}
