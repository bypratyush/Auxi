// Supabase data-layer helpers using direct REST/fetch (Edge-runtime compatible).
// We don't use @supabase/supabase-js here because it's flaky in Vercel Edge.

import type { AuditFinding, AuditInput, AuditStatus } from '../audit/types';
import type { ResearchHit } from '../services/tavily';
import type { ScrapedPage } from '../services/firecrawl';

function baseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set');
  return `${url.replace(/\/$/, '')}/rest/v1`;
}

function authHeaders(): Record<string, string> {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  };
}

async function pgPost<T = unknown>(
  table: string,
  rows: Record<string, unknown> | Record<string, unknown>[],
  opts: { returning?: 'representation' | 'minimal' } = {},
): Promise<T> {
  const headers: Record<string, string> = { ...authHeaders() };
  if (opts.returning === 'representation') {
    headers.Prefer = 'return=representation';
  } else if (opts.returning === 'minimal') {
    headers.Prefer = 'return=minimal';
  }
  const res = await fetch(`${baseUrl()}/${table}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(rows),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`${table} insert ${res.status}: ${body.slice(0, 300)}`);
  }
  if (opts.returning === 'minimal') {
    return undefined as unknown as T;
  }
  return (await res.json()) as T;
}

async function pgPatch(
  table: string,
  filter: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const res = await fetch(`${baseUrl()}/${table}?${filter}`, {
    method: 'PATCH',
    headers: { ...authHeaders(), Prefer: 'return=minimal' },
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`${table} patch ${res.status}: ${body.slice(0, 300)}`);
  }
}

export interface AuditRow {
  id: string;
  session_id: string;
  url: string;
  website_type: string;
  target_audience: string;
  technicality: string;
  status: AuditStatus;
  summary: string | null;
  score: number | null;
  error: string | null;
}

export async function createAudit(input: AuditInput, sessionId: string): Promise<AuditRow> {
  const rows = await pgPost<AuditRow[]>(
    'audits',
    {
      session_id: sessionId,
      url: input.url,
      website_type: input.websiteType,
      target_audience: input.targetAudience,
      technicality: input.technicality,
      status: 'queued',
    },
    { returning: 'representation' },
  );
  if (!rows || rows.length === 0) throw new Error('createAudit: no row returned');
  return rows[0];
}

export async function updateAuditStatus(
  auditId: string,
  status: AuditStatus,
  error?: string,
): Promise<void> {
  const patch: Record<string, unknown> = { status };
  if (error) patch.error = error;
  await pgPatch('audits', `id=eq.${auditId}`, patch);
}

export async function finalizeAudit(
  auditId: string,
  summary: string,
  score: number,
): Promise<void> {
  await pgPatch('audits', `id=eq.${auditId}`, {
    status: 'complete',
    summary,
    score,
  });
}

export async function writePageArtifacts(
  auditId: string,
  scraped: ScrapedPage,
  screenshotUrl: string | null,
): Promise<void> {
  const wordCount = scraped.markdown.trim().split(/\s+/).length;
  await pgPost(
    'page_artifacts',
    {
      audit_id: auditId,
      scraped_markdown: scraped.markdown,
      scraped_html: scraped.html,
      screenshot_url: screenshotUrl,
      page_title: scraped.title,
      meta_description: scraped.description,
      word_count: wordCount,
    },
    { returning: 'minimal' },
  );
}

export async function writeFindings(
  auditId: string,
  findings: AuditFinding[],
): Promise<{ id: string; ordinal: number }[]> {
  if (findings.length === 0) return [];
  const rows = findings.map((f, i) => ({
    audit_id: auditId,
    ordinal: i,
    parameter: f.parameter,
    severity: f.severity,
    observation: f.observation,
    recommendation: f.recommendation,
  }));
  const inserted = await pgPost<{ id: string; ordinal: number }[]>(
    'findings',
    rows,
    { returning: 'representation' },
  );
  return inserted;
}

export async function writeResearchSources(
  auditId: string,
  sources: ResearchHit[],
  findingId: string | null = null,
): Promise<void> {
  if (sources.length === 0) return;
  const rows = sources.map((s) => ({
    audit_id: auditId,
    finding_id: findingId,
    title: s.title,
    url: s.url,
    snippet: s.snippet,
    query: s.query,
  }));
  await pgPost('research_sources', rows, { returning: 'minimal' });
}

export async function writeProgressEvent(
  auditId: string,
  stage: AuditStatus,
  message?: string,
): Promise<void> {
  await pgPost(
    'progress_events',
    {
      audit_id: auditId,
      stage,
      message: message ?? null,
    },
    { returning: 'minimal' },
  );
}
