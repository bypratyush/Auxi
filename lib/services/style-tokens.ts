// Declared-token extraction (Approach B), multi-page.
// Edge-runtime compatible: cheerio + postcss + fetch, no browser.
//
// Given the HTML of every page we scraped, this:
//   1. Parses each page with cheerio to collect inline <style> bodies,
//      inline style="" attributes, and <link rel=stylesheet> URLs
//   2. Deduplicates linked stylesheet URLs across all pages (most sites share
//      a global bundle) and fetches each unique stylesheet at most once
//   3. Parses every CSS string with postcss
//   4. Walks all declarations and tallies distinct values across the whole site
//
// We return one aggregate token summary the LLM can read directly.
// We don't interpret "this is a problem" here — that's the LLM's job; we count.

import * as cheerio from 'cheerio';
import postcss, { type Declaration } from 'postcss';

const LIMITS = {
  /** Max distinct linked stylesheets fetched across the whole audit. */
  maxStylesheets: 5,
  /** Max total CSS bytes (raw, before parse) across the whole audit. */
  maxTotalCssBytes: 400 * 1024,
  /** Per-stylesheet fetch timeout. */
  perFetchTimeoutMs: 6_000,
  /** Per-stylesheet size cap. */
  maxPerStylesheetBytes: 180 * 1024,
};

export interface TokenCount {
  value: string;
  count: number;
}

export interface DesignTokens {
  palette: TokenCount[];
  typography: {
    fontFamilies: TokenCount[];
    fontSizes: TokenCount[];
    fontWeights: TokenCount[];
    lineHeights: TokenCount[];
    letterSpacings: TokenCount[];
  };
  spacing: TokenCount[];
  borderRadii: TokenCount[];
  shadows: TokenCount[];
  meta: {
    pagesConsidered: number;
    stylesheetsConsidered: number;
    stylesheetsFetched: number;
    totalCssBytes: number;
    inlineStyleBlocks: number;
    inlineStyleAttributes: number;
    cssSourcesParsed: number;
    cssSourcesFailed: number;
    parseErrors: string[];
    distinctColors: number;
    distinctFontSizes: number;
    distinctSpacingValues: number;
  };
}

export interface PageHtml {
  /** Page URL — used as base for resolving relative stylesheet hrefs. */
  url: string;
  /** Raw HTML body of the page. */
  html: string;
}

/** Top-level entry. Safe-by-default: returns null if anything blows up. */
export async function extractStyleTokens(pages: PageHtml[]): Promise<DesignTokens | null> {
  if (pages.length === 0) return null;
  try {
    return await doExtract(pages);
  } catch (e) {
    console.warn('[style-tokens] extraction failed:', e);
    return null;
  }
}

async function doExtract(pages: PageHtml[]): Promise<DesignTokens> {
  const inlineStyleBlocks: string[] = [];
  const inlineStyleAttrs: string[] = [];
  // Map of absolute URL → null (placeholder). Deduped across all pages.
  const linkedStylesheetSet = new Set<string>();

  for (const { url, html } of pages) {
    const $ = cheerio.load(html);

    $('style').each((_, el) => {
      const text = $(el).text();
      if (text.trim().length > 0) inlineStyleBlocks.push(text);
    });

    $('[style]').each((_, el) => {
      const s = ($(el).attr('style') || '').trim();
      if (s) inlineStyleAttrs.push(s);
    });

    let baseUrl: URL | null = null;
    try {
      baseUrl = new URL(url);
    } catch {
      /* skip */
    }

    $('link[rel="stylesheet"], link[rel~="stylesheet"]').each((_, el) => {
      const href = $(el).attr('href');
      if (!href) return;
      try {
        const abs = baseUrl ? new URL(href, baseUrl).toString() : href;
        if (/^https?:\/\//i.test(abs)) linkedStylesheetSet.add(abs);
      } catch {
        /* skip malformed */
      }
    });
  }

  const linkedStylesheets = Array.from(linkedStylesheetSet);

  // Fetch unique stylesheets up to the global cap.
  const fetchedCss: string[] = [];
  let totalCssBytes = 0;
  let stylesheetsFetched = 0;
  for (const url of linkedStylesheets.slice(0, LIMITS.maxStylesheets)) {
    if (totalCssBytes >= LIMITS.maxTotalCssBytes) break;
    const remaining = LIMITS.maxTotalCssBytes - totalCssBytes;
    try {
      const css = await fetchCssCapped(url, Math.min(remaining, LIMITS.maxPerStylesheetBytes));
      if (css) {
        fetchedCss.push(css);
        totalCssBytes += css.length;
        stylesheetsFetched += 1;
      }
    } catch (e) {
      console.warn(`[style-tokens] failed to fetch ${url}:`, e);
    }
  }

  // Synthesize inline style="" attributes into parseable CSS rules
  const syntheticInlineCss =
    inlineStyleAttrs.length > 0
      ? inlineStyleAttrs.map((decls, i) => `._inline_${i} { ${decls} }`).join('\n')
      : '';

  // Parse each CSS source independently so one bad file doesn't kill the whole walk.
  const sources = [
    ...inlineStyleBlocks.map((s) => ({ label: 'inline-block', css: s })),
    ...(syntheticInlineCss ? [{ label: 'inline-attrs', css: syntheticInlineCss }] : []),
    ...fetchedCss.map((s, i) => ({ label: `stylesheet-${i}`, css: s })),
  ].filter((s) => s.css);

  const tally = newTallies();
  let cssSourcesParsed = 0;
  let cssSourcesFailed = 0;
  const parseErrors: string[] = [];

  for (const source of sources) {
    try {
      const root = postcss.parse(source.css);
      root.walkDecls((decl) => accumulate(decl, tally));
      cssSourcesParsed += 1;
    } catch (e) {
      cssSourcesFailed += 1;
      const msg = e instanceof Error ? e.message : String(e);
      parseErrors.push(`${source.label}: ${msg.slice(0, 120)}`);
    }
  }

  return {
    palette: rank(tally.colors, 24),
    typography: {
      fontFamilies: rank(tally.fontFamilies, 8),
      fontSizes: rank(tally.fontSizes, 24),
      fontWeights: rank(tally.fontWeights, 12),
      lineHeights: rank(tally.lineHeights, 12),
      letterSpacings: rank(tally.letterSpacings, 8),
    },
    spacing: rank(tally.spacings, 32),
    borderRadii: rank(tally.borderRadii, 12),
    shadows: rank(tally.shadows, 12),
    meta: {
      pagesConsidered: pages.length,
      stylesheetsConsidered: linkedStylesheets.length,
      stylesheetsFetched,
      totalCssBytes,
      inlineStyleBlocks: inlineStyleBlocks.length,
      inlineStyleAttributes: inlineStyleAttrs.length,
      cssSourcesParsed,
      cssSourcesFailed,
      parseErrors,
      distinctColors: tally.colors.size,
      distinctFontSizes: tally.fontSizes.size,
      distinctSpacingValues: tally.spacings.size,
    },
  };
}

async function fetchCssCapped(url: string, maxBytes: number): Promise<string | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), LIMITS.perFetchTimeoutMs);
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'text/css,*/*;q=0.5' },
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    const ct = res.headers.get('content-type') || '';
    if (!/css/i.test(ct) && !/text/i.test(ct)) return null;
    const text = await res.text();
    return text.length > maxBytes ? text.slice(0, maxBytes) : text;
  } finally {
    clearTimeout(timer);
  }
}

interface Tallies {
  colors: Map<string, number>;
  fontFamilies: Map<string, number>;
  fontSizes: Map<string, number>;
  fontWeights: Map<string, number>;
  lineHeights: Map<string, number>;
  letterSpacings: Map<string, number>;
  spacings: Map<string, number>;
  borderRadii: Map<string, number>;
  shadows: Map<string, number>;
}

function newTallies(): Tallies {
  return {
    colors: new Map(),
    fontFamilies: new Map(),
    fontSizes: new Map(),
    fontWeights: new Map(),
    lineHeights: new Map(),
    letterSpacings: new Map(),
    spacings: new Map(),
    borderRadii: new Map(),
    shadows: new Map(),
  };
}

function accumulate(decl: Declaration, t: Tallies) {
  const prop = decl.prop.toLowerCase();
  const val = decl.value.trim();
  if (!val || val === 'inherit' || val === 'initial' || val === 'unset' || val === 'transparent') return;

  if (prop === 'color' || /^(background-color|border-color|outline-color|fill|stroke)$/.test(prop)) {
    for (const c of extractColorTokens(val)) inc(t.colors, c);
    return;
  }
  if (prop === 'background') {
    for (const c of extractColorTokens(val)) inc(t.colors, c);
    return;
  }
  if (prop === 'font-family') {
    inc(t.fontFamilies, normalizeFontFamily(val));
    return;
  }
  if (prop === 'font-size') {
    inc(t.fontSizes, val);
    return;
  }
  if (prop === 'font-weight') {
    inc(t.fontWeights, val);
    return;
  }
  if (prop === 'line-height') {
    inc(t.lineHeights, val);
    return;
  }
  if (prop === 'letter-spacing') {
    inc(t.letterSpacings, val);
    return;
  }
  if (/^(margin|padding|gap|row-gap|column-gap)(-(top|right|bottom|left))?$/.test(prop)) {
    for (const v of splitShorthand(val)) inc(t.spacings, v);
    return;
  }
  if (prop === 'border-radius' || /^border-(top|bottom)-(left|right)-radius$/.test(prop)) {
    for (const v of splitShorthand(val)) inc(t.borderRadii, v);
    return;
  }
  if (prop === 'box-shadow' || prop === 'text-shadow') {
    inc(t.shadows, val);
    return;
  }
}

function inc(map: Map<string, number>, key: string) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function rank(map: Map<string, number>, max: number): TokenCount[] {
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([value, count]) => ({ value, count }));
}

function extractColorTokens(value: string): string[] {
  const out: string[] = [];
  const hexMatches = Array.from(value.matchAll(/#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})\b/gi));
  for (const m of hexMatches) out.push(m[0].toLowerCase());
  const fnMatches = Array.from(
    value.matchAll(/\b(?:rgb|rgba|hsl|hsla|lab|lch|oklab|oklch|color)\([^)]+\)/gi),
  );
  for (const m of fnMatches) out.push(m[0].replace(/\s+/g, '').toLowerCase());
  return out;
}

function normalizeFontFamily(value: string): string {
  return value.replace(/['"]/g, '').replace(/\s+/g, ' ').trim();
}

function splitShorthand(value: string): string[] {
  if (/\b(var|calc|env|min|max|clamp|attr)\(/i.test(value)) return [];
  return value
    .split(/\s+/)
    .map((v) => v.trim())
    .filter((v) => v.length > 0 && /^[-+]?\d*\.?\d+(?:px|rem|em|%|vw|vh|ch|ex|svh|dvh|lvh|pt|pc|in|cm|mm|0)?$|^0$/.test(v));
}
