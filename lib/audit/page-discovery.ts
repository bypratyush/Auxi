// Page discovery: take a starting URL + a category's DiscoveryPlan,
// call Firecrawl /v2/map, classify the URL list into three buckets:
//   • pages           — real HTML pages we'll scrape
//   • attachmentRoles  — role exists, but only as a downloadable file (PDF/doc/…)
//   • missingRoles     — role has no match anywhere
// Always includes the submitted URL as 'home'.

import { mapSite, type MappedLink } from '../services/firecrawl';

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
  /** Roles with no match at all — surfaced to the LLM as a usability signal. */
  missingRoles: { role: string; label: string }[];
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
  const missingRoles: { role: string; label: string }[] = [];

  // Landing pages (and any plan with no roles) are single-page by design.
  if (plan.roles.length === 0) {
    return { pages, attachmentRoles, missingRoles };
  }

  let allLinks: MappedLink[] = [];
  try {
    allLinks = await mapSite(rootUrl, 200);
  } catch (e) {
    console.warn('[discovery] mapSite failed, falling back to home-only:', e);
    for (const r of plan.roles) missingRoles.push({ role: r.role, label: r.label });
    return { pages, attachmentRoles, missingRoles };
  }

  let rootHost: string;
  try {
    rootHost = new URL(rootUrl).hostname.replace(/^www\./, '');
  } catch {
    return { pages, attachmentRoles, missingRoles };
  }

  // Keep internal links (both HTML and attachments). Exclude the home URL itself.
  const homeNormalized = normalizeUrl(rootUrl);
  const internal: MappedLink[] = allLinks
    .filter((l) => {
      try {
        const u = new URL(l.url);
        const host = u.hostname.replace(/^www\./, '');
        return host === rootHost && normalizeUrl(l.url) !== homeNormalized;
      } catch {
        return false;
      }
    })
    .map((l) => {
      try {
        return { ...l, url: normalizeUrl(l.url) };
      } catch {
        return l;
      }
    });

  const sortedRoles = [...plan.roles].sort((a, b) => a.priority - b.priority);

  for (const roleSpec of sortedRoles) {
    const wanted = roleSpec.maxCount ?? 1;
    const htmlMatches: string[] = [];
    const attachmentMatches: string[] = [];

    for (const link of internal) {
      if (htmlMatches.length >= wanted) break;
      if (pages.some((p) => p.url === link.url) || htmlMatches.includes(link.url)) continue;

      let path: string;
      try {
        path = new URL(link.url).pathname || '/';
      } catch {
        continue;
      }

      if (roleSpec.pathExcludes?.some((rx) => rx.test(path))) continue;
      if (!roleSpec.pathPatterns.some((rx) => rx.test(path))) continue;

      if (NON_HTML_EXTENSION.test(path)) {
        attachmentMatches.push(link.url);
      } else {
        htmlMatches.push(link.url);
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
      missingRoles.push({ role: roleSpec.role, label: roleSpec.label });
    }
  }

  return { pages, attachmentRoles, missingRoles };
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
