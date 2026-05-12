import type { AuditInput, AuditReport } from './types';

// Orchestrates: scrape -> screenshot -> a11y scan -> research -> AI analysis.
// Each stage emits a progress event into Supabase so the frontend can stream status.
// TODO: implement.
export async function runAuditPipeline(_auditId: string, _input: AuditInput): Promise<AuditReport> {
  throw new Error('runAuditPipeline not implemented');
}
