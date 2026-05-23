import { scrapePage } from '../services/firecrawl';
import { captureScreenshot } from '../services/screenshotone';
import { searchResearchBatch } from '../services/tavily';
import { extractStyleTokens } from '../services/style-tokens';
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
import { analyze, type AnalyzePage } from './analyze';
import { discoverPages } from './page-discovery';
import type { AuditInput, AuditReport, AuditStatus } from './types';

export type StreamEvent =
  | { type: 'audit_id'; id: string }
  | { type: 'stage'; stage: AuditStatus; message?: string }
  | { type: 'complete'; auditId: string; report: AuditReport; screenshotUrl: string | null }
  | { type: 'error'; message: string };

export interface PipelineOptions {
  input: AuditInput;
  userId: string;
  send: (event: StreamEvent) => void;
}

const MAX_PAGES = 5;

export async function runAuditPipeline({ input, userId, send }: PipelineOptions): Promise<void> {
  // 1. Create audit row
  let auditId: string | null = null;
  try {
    const audit = await createAudit(input, userId);
    auditId = audit.id;
    send({ type: 'audit_id', id: audit.id });
  } catch (e) {
    send({ type: 'error', message: `Failed to create audit row: ${String(e)}` });
    return;
  }

  const subTool = subTools[input.websiteType];

  try {
    // 2. Discover which pages to scan
    send({ type: 'stage', stage: 'scraping', message: 'mapping the site…' });
    await writeProgressEvent(auditId, 'scraping');
    await updateAuditStatus(auditId, 'scraping');

    const discovery = await discoverPages(input.url, subTool.discoveryPlan, MAX_PAGES);
    const pageCount = discovery.pages.length;
    send({
      type: 'stage',
      stage: 'scraping',
      message: pageCount > 1 ? `reading ${pageCount} pages…` : 'reading the page…',
    });

    // 3. Parallel: scrape every discovered page + screenshot home + research
    const queries = buildResearchQueries(subTool.parameters, input.targetAudience);

    const [scrapedPages, screenshot, research] = await Promise.all([
      Promise.all(
        discovery.pages.map(async (p): Promise<AnalyzePage | null> => {
          try {
            const scraped = await scrapePage(p.url);
            return { role: p.role, label: p.label, url: p.url, scraped };
          } catch (e) {
            console.warn(`[pipeline] scrape failed for ${p.role} (${p.url}):`, e);
            return null;
          }
        }),
      ),
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

    const pages = scrapedPages.filter((p): p is AnalyzePage => p !== null);
    if (pages.length === 0) {
      throw new Error('Could not scrape any pages from this site.');
    }

    // 4. Declared-token extraction across all scraped pages (deduped stylesheets).
    //    Returns null on failure — non-fatal, the LLM just won't see the token block.
    const styleTokens = await extractStyleTokens(
      pages.map((p) => ({ url: p.url, html: p.scraped.html })),
    );

    // 5. Persist page artifacts (one row per scraped page; screenshot attached to home)
    await writePageArtifacts(
      auditId,
      pages.map((p) => ({
        role: p.role,
        url: p.url,
        scraped: p.scraped,
        screenshotUrl: p.role === 'home' ? (screenshot?.url ?? null) : null,
      })),
    );

    // 6. LLM analysis over all pages
    send({ type: 'stage', stage: 'analyzing', message: 'reasoning through the findings…' });
    await writeProgressEvent(auditId, 'analyzing');
    await updateAuditStatus(auditId, 'analyzing');

    const report = await analyze({
      input,
      subTool,
      pages,
      attachmentRoles: discovery.attachmentRoles,
      sharedRoles: discovery.sharedRoles,
      missingRoles: discovery.missingRoles,
      screenshotUrl: screenshot?.url ?? null,
      research,
      styleTokens,
    });

    // 6. Persist findings + sources
    await writeFindings(auditId, report.findings);
    await writeResearchSources(auditId, research, null);

    await finalizeAudit(auditId, report.summary, report.score);
    await writeProgressEvent(auditId, 'complete');

    send({ type: 'complete', auditId, report, screenshotUrl: screenshot?.url ?? null });
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
  const base = parameters.slice(0, 4).map((p) => `${p} usability research`);
  base.push(`UX best practices for ${audience}`);
  return base;
}
