// Page discovery: take a starting URL + a category's DiscoveryPlan, build a
// candidate URL pool from MULTIPLE sources (Firecrawl map + sitemap.xml +
// robots.txt sitemaps), then classify into three buckets:
//   • pages           — real HTML pages we'll scrape
//   • attachmentRoles  — role exists, but only as a downloadable file (PDF/doc/…)
//   • missingRoles     — role has no match anywhere
// Always includes the submitted URL as 'home'.
//
// Multi-source discovery matters because Firecrawl's map only follows visible
// links. Sitemaps catch orphaned, deep, or unlinked pages the site owner
// explicitly publishes (with priority + lastmod metadata when available).

import { mapSite, type MappedLink } from '../services/firecrawl';
import { extractAllSitemapURLs, type SitemapURL } from './sitemap';

export interface PageRole {
  /** Stable role slug ('plp', 'pricing', 'cart', …). Used in page_artifacts.page_role. */
  role: string;
  /** Lower number = picked first. */
  priority: number;
  /** Path-level regexes a URL must match. */
  pathPatterns: RegExp[];
  /** Path-level regexes that disqualify a match (overrides pathPatterns). */
  pathExcludes?: RegExp[];
  /** How many pages of this role to pick (default 1). */
  maxCount?: number;
  /** Human-readable label used in error / "missing page" findings. */
  label: string;
  /**
   * Other role slugs whose page may legitimately host this role's content.
   * Example: portfolio 'experience' often lives within 'about' rather than its own page.
   * If this role finds no dedicated page but a sharesPageWith role IS picked,
   * we record it under sharedRoles instead of missingRoles.
   */
  sharesPageWith?: string[];
}

export interface DiscoveryPlan {
  roles: PageRole[];
}

export interface DiscoveredPage {
  role: string;
  label: string;
  url: string;
}

export interface AttachmentRole {
  role: string;
  label: string;
  /** The downloadable file URL the role pattern matched. */
  url: string;
}

export interface DiscoveryResult {
  /** HTML pages to scrape (always starts with 'home'). */
  pages: DiscoveredPage[];
  /** Roles found only as a downloadable file — accurate context, not a failure. */
  attachmentRoles: AttachmentRole[];
  /** Roles whose content likely lives within another picked page (e.g. Experience inside About). */
  sharedRoles: SharedRole[];
  /** Roles with no match at all — surfaced to the LLM as a usability signal. */
  missingRoles: { role: string; label: string }[];
  /** Provenance + size of the discovery pool (useful for the LLM and debug). */
  meta?: {
    firecrawlMapUrls: number;
    sitemapUrls: number;
    candidatePoolSize: number;
  };
}

export interface SharedRole {
  role: string;
  label: string;
  /** The role whose page is hosting this content (e.g. 'about'). */
  hostRole: string;
  hostLabel: string;
  hostUrl: string;
}

/** Internal: a candidate URL with provenance + optional sitemap metadata. */
interface Candidate {
  url: string;
  source: 'map' | 'sitemap' | 'both';
  /** Sitemap-declared priority (0.0–1.0) when available — used for tie-breaking. */
  priority?: number;
  lastmod?: string;
}

const DEFAULT_MAX_TOTAL = 5;

// Paths ending in a binary/attachment extension can't be scraped to clean markdown.
const NON_HTML_EXTENSION =
  /\.(pdf|docx?|xlsx?|pptx?|zip|tar|gz|rar|7z|png|jpe?g|gif|webp|svg|ico|mp4|mp3|wav|mov|webm|avi|csv)(\?|#|$)/i;

export async function discoverPages(
  rootUrl: string,
  plan: DiscoveryPlan,
  maxTotal: number = DEFAULT_MAX_TOTAL,
): Promise<DiscoveryResult> {
  const home: DiscoveredPage = { role: 'home', label: 'Homepage', url: rootUrl };
  const pages: DiscoveredPage[] = [home];
  const attachmentRoles: AttachmentRole[] = [];
  const sharedRoles: SharedRole[] = [];
  const missingRoles: { role: string; label: string }[] = [];

  // Landing pages (and any plan with no roles) are single-page by design.
  if (plan.roles.length === 0) {
    return {
      pages,
      attachmentRoles,
      sharedRoles,
      missingRoles,
      meta: { firecrawlMapUrls: 0, sitemapUrls: 0, candidatePoolSize: 0 },
    };
  }

  let rootHost: string;
  try {
    rootHost = new URL(rootUrl).hostname.replace(/^www\./, '');
  } catch {
    return { pages, attachmentRoles, sharedRoles, missingRoles };
  }

  // Run BOTH discovery sources in parallel so they don't add latency to each other.
  const [mapResult, sitemapResult] = await Promise.allSettled([
    mapSite(rootUrl, 200),
    extractAllSitemapURLs(rootUrl),
  ]);

  const mapLinks: MappedLink[] = mapResult.status === 'fulfilled' ? mapResult.value : [];
  const sitemapLinks: SitemapURL[] = sitemapResult.status === 'fulfilled' ? sitemapResult.value : [];

  if (mapResult.status === 'rejected') {
    console.warn('[discovery] Firecrawl map failed:', mapResult.reason);
  }
  if (sitemapResult.status === 'rejected') {
    console.warn('[discovery] sitemap extraction failed:', sitemapResult.reason);
  }

  // Merge into one candidate pool, keyed by normalized URL, with provenance + metadata.
  const homeNormalized = normalizeUrl(rootUrl);
  const pool = new Map<string, Candidate>();

  const isInternal = (urlStr: string): boolean => {
    try {
      const u = new URL(urlStr);
      const host = u.hostname.replace(/^www\./, '');
      return host === rootHost;
    } catch {
      return false;
    }
  };

  for (const link of mapLinks) {
    if (!isInternal(link.url)) continue;
    const norm = normalizeUrl(link.url);
    if (norm === homeNormalized) continue;
    const existing = pool.get(norm);
    if (existing) {
      existing.source = existing.source === 'sitemap' ? 'both' : existing.source;
    } else {
      pool.set(norm, { url: norm, source: 'map' });
    }
  }

  for (const sm of sitemapLinks) {
    if (!isInternal(sm.loc)) continue;
    const norm = normalizeUrl(sm.loc);
    if (norm === homeNormalized) continue;
    const existing = pool.get(norm);
    if (existing) {
      existing.source = existing.source === 'map' ? 'both' : existing.source;
      if (existing.priority === undefined && sm.priority !== undefined) existing.priority = sm.priority;
      if (existing.lastmod === undefined && sm.lastmod) existing.lastmod = sm.lastmod;
    } else {
      pool.set(norm, { url: norm, source: 'sitemap', priority: sm.priority, lastmod: sm.lastmod });
    }
  }

  // If both sources came back empty, give up but mark every role as missing.
  if (pool.size === 0) {
    for (const r of plan.roles) missingRoles.push({ role: r.role, label: r.label });
    return {
      pages,
      attachmentRoles,
      sharedRoles,
      missingRoles,
      meta: { firecrawlMapUrls: mapLinks.length, sitemapUrls: sitemapLinks.length, candidatePoolSize: 0 },
    };
  }

  // Rank candidates: sitemap priority desc (when present), then 'both' > 'sitemap' > 'map'.
  const sourceRank = (s: Candidate['source']) => (s === 'both' ? 2 : s === 'sitemap' ? 1 : 0);
  const candidates = Array.from(pool.values()).sort((a, b) => {
    const ap = a.priority ?? -1;
    const bp = b.priority ?? -1;
    if (bp !== ap) return bp - ap;
    return sourceRank(b.source) - sourceRank(a.source);
  });

  const sortedRoles = [...plan.roles].sort((a, b) => a.priority - b.priority);

  // First pass: pick pages or attachments per role. Defer "missing" decisions
  // until after the whole pass so we can resolve sharesPageWith fallbacks.
  const unresolved: PageRole[] = [];

  for (const roleSpec of sortedRoles) {
    const wanted = roleSpec.maxCount ?? 1;
    const htmlMatches: string[] = [];
    const attachmentMatches: string[] = [];

    for (const cand of candidates) {
      if (htmlMatches.length >= wanted) break;
      if (pages.some((p) => p.url === cand.url) || htmlMatches.includes(cand.url)) continue;

      let path: string;
      try {
        path = new URL(cand.url).pathname || '/';
      } catch {
        continue;
      }

      if (roleSpec.pathExcludes?.some((rx) => rx.test(path))) continue;
      if (!roleSpec.pathPatterns.some((rx) => rx.test(path))) continue;

      if (NON_HTML_EXTENSION.test(path)) {
        attachmentMatches.push(cand.url);
      } else {
        htmlMatches.push(cand.url);
      }
    }

    if (htmlMatches.length > 0 && pages.length < maxTotal) {
      for (const url of htmlMatches) {
        if (pages.length >= maxTotal) break;
        pages.push({ role: roleSpec.role, label: roleSpec.label, url });
      }
    } else if (attachmentMatches.length > 0) {
      attachmentRoles.push({ role: roleSpec.role, label: roleSpec.label, url: attachmentMatches[0] });
    } else {
      unresolved.push(roleSpec);
    }
  }

  // Second pass: for each unresolved role, check sharesPageWith — if any host role
  // was picked, classify as shared. Otherwise truly missing.
  for (const roleSpec of unresolved) {
    let resolvedAsShared = false;
    if (roleSpec.sharesPageWith && roleSpec.sharesPageWith.length > 0) {
      for (const hostRole of roleSpec.sharesPageWith) {
        const hostPage = pages.find((p) => p.role === hostRole);
        if (hostPage) {
          sharedRoles.push({
            role: roleSpec.role,
            label: roleSpec.label,
            hostRole: hostPage.role,
            hostLabel: hostPage.label,
            hostUrl: hostPage.url,
          });
          resolvedAsShared = true;
          break;
        }
      }
    }
    if (!resolvedAsShared) {
      missingRoles.push({ role: roleSpec.role, label: roleSpec.label });
    }
  }

  return {
    pages,
    attachmentRoles,
    sharedRoles,
    missingRoles,
    meta: {
      firecrawlMapUrls: mapLinks.length,
      sitemapUrls: sitemapLinks.length,
      candidatePoolSize: candidates.length,
    },
  };
}

function normalizeUrl(u: string): string {
  try {
    const url = new URL(u);
    url.hash = '';
    if (url.pathname.length > 1 && url.pathname.endsWith('/')) {
      url.pathname = url.pathname.slice(0, -1);
    }
    return url.toString();
  } catch {
    return u;
  }
}
