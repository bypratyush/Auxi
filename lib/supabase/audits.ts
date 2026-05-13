// Typed Supabase helpers for the audit data model.
// All writes go through the service-role client (server-side only).

import { createSupabaseAdminClient } from './admin';
import type { AuditFinding, AuditInput, AuditStatus } from '../audit/types';
import type { ResearchHit } from '../services/tavily';
import type { ScrapedPage } from '../services/firecrawl';

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
  const db = createSupabaseAdminClient();
  const { data, error } = await db
    .from('audits')
    .insert({
      session_id: sessionId,
      url: input.url,
      website_type: input.websiteType,
      target_audience: input.targetAudience,
      technicality: input.technicality,
      status: 'queued',
    })
    .select('*')
    .single();
  if (error) throw new Error(`createAudit: ${error.message}`);
  return data as AuditRow;
}

export async function updateAuditStatus(auditId: string, status: AuditStatus, error?: string) {
  const db = createSupabaseAdminClient();
  const patch: Record<string, unknown> = { status };
  if (error) patch.error = error;
  const { error: err } = await db.from('audits').update(patch).eq('id', auditId);
  if (err) throw new Error(`updateAuditStatus: ${err.message}`);
}

export async function finalizeAudit(auditId: string, summary: string, score: number) {
  const db = createSupabaseAdminClient();
  const { error } = await db
    .from('audits')
    .update({ status: 'complete', summary, score })
    .eq('id', auditId);
  if (error) throw new Error(`finalizeAudit: ${error.message}`);
}

export async function writePageArtifacts(
  auditId: string,
  scraped: ScrapedPage,
  screenshotUrl: string | null,
) {
  const db = createSupabaseAdminClient();
  const wordCount = scraped.markdown.trim().split(/\s+/).length;
  const { error } = await db.from('page_artifacts').insert({
    audit_id: auditId,
    scraped_markdown: scraped.markdown,
    scraped_html: scraped.html,
    screenshot_url: screenshotUrl,
    page_title: scraped.title,
    meta_description: scraped.description,
    word_count: wordCount,
  });
  if (error) throw new Error(`writePageArtifacts: ${error.message}`);
}

export async function writeFindings(
  auditId: string,
  findings: AuditFinding[],
): Promise<{ id: string; ordinal: number }[]> {
  const db = createSupabaseAdminClient();
  const rows = findings.map((f, i) => ({
    audit_id: auditId,
    ordinal: i,
    parameter: f.parameter,
    severity: f.severity,
    observation: f.observation,
    recommendation: f.recommendation,
  }));
  const { data, error } = await db.from('findings').insert(rows).select('id, ordinal');
  if (error) throw new Error(`writeFindings: ${error.message}`);
  return data as { id: string; ordinal: number }[];
}

export async function writeResearchSources(
  auditId: string,
  sources: ResearchHit[],
  findingId: string | null = null,
) {
  if (sources.length === 0) return;
  const db = createSupabaseAdminClient();
  const rows = sources.map((s) => ({
    audit_id: auditId,
    finding_id: findingId,
    title: s.title,
    url: s.url,
    snippet: s.snippet,
    query: s.query,
  }));
  const { error } = await db.from('research_sources').insert(rows);
  if (error) throw new Error(`writeResearchSources: ${error.message}`);
}

export async function writeProgressEvent(auditId: string, stage: AuditStatus, message?: string) {
  const db = createSupabaseAdminClient();
  const { error } = await db
    .from('progress_events')
    .insert({ audit_id: auditId, stage, message: message ?? null });
  if (error) throw new Error(`writeProgressEvent: ${error.message}`);
}
