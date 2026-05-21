// Audit analysis — the LLM step.
//
// Multi-page: each audit scrapes the homepage plus category-critical pages
// (pricing, checkout, etc.). The LLM sees them tagged by role and produces
// findings that can be page-specific or cross-page.
//
// v0 is text-only (scraped markdown + research). Vision is a v0.5 add.

import { converse } from '../services/llm';
import type { ScrapedPage } from '../services/firecrawl';
import type { ResearchHit } from '../services/tavily';
import type { SubToolModule } from '../sub-tools';
import type { AuditFinding, AuditInput, AuditReport } from './types';

const USE_MOCK = process.env.LLM_USE_MOCK === 'true';
// Per-page cap — 5 pages × 10k chars ≈ 12.5k tokens, comfortable for Nova Pro.
const MAX_MARKDOWN_CHARS_PER_PAGE = 10000;

export interface AnalyzePage {
  role: string;
  label: string;
  url: string;
  scraped: ScrapedPage;
}

export interface AnalyzeInput {
  input: AuditInput;
  subTool: SubToolModule;
  pages: AnalyzePage[];
  attachmentRoles: { role: string; label: string; url: string }[];
  missingRoles: { role: string; label: string }[];
  screenshotUrl: string | null;
  research: ResearchHit[];
}

export async function analyze(args: AnalyzeInput): Promise<AuditReport> {
  if (USE_MOCK) return mockAnalyze(args);

  const system = buildSystemPrompt(args.subTool, args.input);
  const user = buildUserPrompt(args);

  const result = await converse({
    system,
    messages: [{ role: 'user', content: [{ text: user }] }],
    maxTokens: 4096,
    temperature: 0.3,
  });

  return parseReport(result.text);
}

function buildSystemPrompt(subTool: SubToolModule, input: AuditInput): string {
  const technicalityHint = {
    technical: 'The audience is technically literate; jargon is acceptable.',
    mixed: 'The audience is a mix; explain technical concepts only where needed.',
    non_technical: 'The audience is non-technical; avoid jargon and explain plainly.',
  }[input.technicality];

  return `You are Auxi, a senior UX auditor producing research-grounded usability findings.

DOMAIN: ${subTool.label}
${subTool.systemPrompt}

AUDIENCE FRAMING: ${input.targetAudience}. ${technicalityHint}

YOUR JOB
- You are given several pages from one website, each tagged with a ROLE (home, pricing, checkout, etc.).
- Review all of them together. Findings may be specific to one page or span multiple pages
  (e.g. "the value proposition on the homepage doesn't match the pricing tiers").
- Produce 4 to 7 concrete, specific usability findings.
- Each finding must reference observable evidence from the pages — name the page/role when relevant.
- Cite research only where it directly backs your observation — never pad with irrelevant sources.
- Calibrate severity honestly: 'critical' = blocks user goals; 'high' = significant friction;
  'medium' = clear improvement opportunity; 'low' = nice-to-have polish.

HANDLING PAGES NOT SCRAPED
- "PAGES FOUND ONLY AS DOWNLOADS": the content exists but is behind a file download (e.g. a PDF resume).
  Do NOT treat this as missing. Judge whether forcing a download is appropriate friction for this
  audience and category — it is often a minor/medium issue, rarely critical.
- "PAGES NOT FOUND": no such page exists on the site. Assess whether its absence is a genuine
  usability problem for this category before flagging it (some categories don't need every page).

OUTPUT FORMAT
Respond with ONLY a valid JSON object matching this exact shape, wrapped in a single \`\`\`json code block:

\`\`\`json
{
  "summary": "2-3 sentence high-level take on the audit",
  "score": 0,
  "findings": [
    {
      "parameter": "one of the focus parameters for this domain",
      "severity": "critical | high | medium | low",
      "observation": "what you actually saw — name the page/role when relevant",
      "research": [
        { "claim": "the relevant research finding in one sentence", "source": "https://..." }
      ],
      "recommendation": "specific, implementable fix — not generic advice"
    }
  ]
}
\`\`\`

- "score" is an overall usability score 0-100 (40 = serious problems, 70 = solid, 90 = exceptional).
- Each finding's "research" array can be empty if no provided snippet directly applies.
- Do NOT output anything outside the json block. No preamble, no follow-up commentary.`;
}

function buildUserPrompt({
  input,
  pages,
  attachmentRoles,
  missingRoles,
  research,
}: AnalyzeInput): string {
  const pageBlocks = pages
    .map((p) => {
      const md =
        p.scraped.markdown.length > MAX_MARKDOWN_CHARS_PER_PAGE
          ? p.scraped.markdown.slice(0, MAX_MARKDOWN_CHARS_PER_PAGE) + '\n\n[…truncated]'
          : p.scraped.markdown;
      return `═══ PAGE [role: ${p.role}] ${p.label}
URL: ${p.url}
TITLE: ${p.scraped.title ?? '(none)'}
META: ${p.scraped.description ?? '(none)'}

${md}`;
    })
    .join('\n\n');

  const attachmentBlock =
    attachmentRoles.length > 0
      ? attachmentRoles.map((a) => `- ${a.label}: ${a.url}`).join('\n')
      : '(none)';

  const missingBlock =
    missingRoles.length > 0
      ? missingRoles.map((m) => `- ${m.label}`).join('\n')
      : '(none)';

  const researchBlock = research
    .map((r, i) => `[${i + 1}] ${r.title}\n    ${r.url}\n    ${r.snippet.slice(0, 280)}`)
    .join('\n\n');

  return `SITE AUDITED: ${input.url}
PAGES SCRAPED: ${pages.length}

${pageBlocks}

----- PAGES FOUND ONLY AS DOWNLOADS (content exists, but behind a file) -----
${attachmentBlock}

----- PAGES NOT FOUND ON THE SITE -----
${missingBlock}

----- RESEARCH SNIPPETS (cite when directly applicable) -----
${researchBlock || '(no research returned)'}

Produce the JSON audit now.`;
}

function parseReport(rawText: string): AuditReport {
  const jsonText = extractJson(rawText);
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch (e) {
    throw new Error(
      `LLM returned unparseable JSON: ${(e as Error).message}\n---\n${rawText.slice(0, 600)}`,
    );
  }

  if (!isReportShape(parsed)) {
    throw new Error(`LLM JSON did not match expected shape. Got: ${JSON.stringify(parsed).slice(0, 400)}`);
  }

  const validSeverities = new Set(['critical', 'high', 'medium', 'low']);
  const findings: AuditFinding[] = parsed.findings
    .filter((f) => validSeverities.has(f.severity))
    .map((f) => ({
      parameter: String(f.parameter).trim(),
      severity: f.severity as AuditFinding['severity'],
      observation: String(f.observation).trim(),
      research: (f.research ?? [])
        .map((r) => ({
          claim: String(r.claim ?? '').trim(),
          source: String(r.source ?? '').trim(),
        }))
        .filter((r) => r.claim && r.source),
      recommendation: String(f.recommendation).trim(),
    }));

  return {
    summary: String(parsed.summary ?? '').trim(),
    score: clamp(Math.round(Number(parsed.score) || 0), 0, 100),
    findings,
    generatedAt: new Date().toISOString(),
  };
}

function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced && fenced[1]) return fenced[1].trim();
  return text.trim();
}

interface ReportShape {
  summary: unknown;
  score: unknown;
  findings: Array<{
    parameter: unknown;
    severity: string;
    observation: unknown;
    recommendation: unknown;
    research?: Array<{ claim?: unknown; source?: unknown }>;
  }>;
}

function isReportShape(x: unknown): x is ReportShape {
  if (!x || typeof x !== 'object') return false;
  const o = x as Record<string, unknown>;
  return Array.isArray(o.findings) && 'summary' in o && 'score' in o;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function mockAnalyze({ input, subTool, pages, research }: AnalyzeInput): AuditReport {
  const pickedParams = subTool.parameters.slice(0, 4);
  const findings = pickedParams.map((parameter, i) => ({
    parameter,
    severity: (['critical', 'high', 'medium', 'low'] as const)[i % 4],
    observation: `[mock] The ${parameter} aspect shows opportunities for improvement across ${pages.length} scanned page(s).`,
    research: research.slice(i * 2, i * 2 + 2).map((r) => ({
      claim: r.snippet.slice(0, 120),
      source: r.url,
    })),
    recommendation: `[mock] Address the ${parameter} issue.`,
  }));

  return {
    summary: `[mock] Initial audit of ${input.url} (${subTool.label}) for ${input.targetAudience}, ${pages.length} page(s) scanned.`,
    score: 72,
    findings,
    generatedAt: new Date().toISOString(),
  };
}
