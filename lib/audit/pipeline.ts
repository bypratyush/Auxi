import { scrapePage } from '../services/firecrawl';
import { captureScreenshot } from '../services/screenshotone';
import { searchResearchBatch, type ResearchHit } from '../services/tavily';
import { subTools } from '../sub-tools';
import {
  createAudit,
  finalizeAudit,
  updateAuditStatus,
  writeFindings,
  writePageArtifacts,
  writeProgressEvent,
  writeResearchSources,
} from '../supabase/audits';
import { analyze } from './analyze';
import type { AuditFinding, AuditInput, AuditReport, AuditStatus } from './types';

export type StreamEvent =
  | { type: 'audit_id'; id: string }
  | { type: 'stage'; stage: AuditStatus; message?: string }
  | { type: 'complete'; auditId: string; report: AuditReport }
  | { type: 'error'; message: string };

export interface PipelineOptions {
  input: AuditInput;
  sessionId: string;
  send: (event: StreamEvent) => void;
}

export async function runAuditPipeline({ input, sessionId, send }: PipelineOptions): Promise<void> {
  // 1. Create audit row
  let auditId: string | null = null;
  try {
    const audit = await createAudit(input, sessionId);
    auditId = audit.id;
    send({ type: 'audit_id', id: audit.id });
  } catch (e) {
    send({ type: 'error', message: `Failed to create audit row: ${String(e)}` });
    return;
  }

  const subTool = subTools[input.websiteType];

  try {
    // 2. Parallel: scrape + screenshot + research
    send({ type: 'stage', stage: 'scraping', message: 'reading the page…' });
    await writeProgressEvent(auditId, 'scraping');
    await updateAuditStatus(auditId, 'scraping');

    const queries = buildResearchQueries(subTool.parameters, input.targetAudience);

    const [scraped, screenshot, research] = await Promise.all([
      scrapePage(input.url),
      captureScreenshot(input.url).catch((e) => {
        console.warn('Screenshot failed, continuing without it:', e);
        return null;
      }),
      (async () => {
        send({ type: 'stage', stage: 'researching', message: 'gathering relevant studies…' });
        await writeProgressEvent(auditId!, 'researching');
        return searchResearchBatch(queries, subTool.researchSources);
      })(),
    ]);

    await writePageArtifacts(auditId, scraped, screenshot?.url ?? null);

    // 3. LLM analysis
    send({ type: 'stage', stage: 'analyzing', message: 'reasoning through the findings…' });
    await writeProgressEvent(auditId, 'analyzing');
    await updateAuditStatus(auditId, 'analyzing');

    const report = await analyze({
      input,
      subTool,
      scraped,
      screenshotUrl: screenshot?.url ?? null,
      research,
    });

    // 4. Persist findings + sources
    const findingRows = await writeFindings(auditId, report.findings);
    // For v0 we attach all research sources to the audit, not per-finding.
    // The LLM analyze step can later return finding-specific source links.
    await writeResearchSources(auditId, research, null);
    void findingRows; // future: map sources to findings via finding_id

    await finalizeAudit(auditId, report.summary, report.score);
    await writeProgressEvent(auditId, 'complete');

    send({ type: 'complete', auditId, report });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (auditId) {
      await updateAuditStatus(auditId, 'failed', message).catch(() => {});
      await writeProgressEvent(auditId, 'failed', message).catch(() => {});
    }
    send({ type: 'error', message });
  }
}

function buildResearchQueries(parameters: string[], audience: string): string[] {
  // For v0: one query per parameter, plus one audience-specific query.
  // Later: Claude-generated queries from the scraped content.
  const base = parameters.slice(0, 4).map((p) => `${p} usability research`);
  base.push(`UX best practices for ${audience}`);
  return base;
}
