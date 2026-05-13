// Audit analysis — the LLM step.
//
// v0 is text-only: scraped markdown + research snippets → structured findings.
// Vision (passing the screenshot to the model) is a v0.5 add — most UX issues
// on a typical page are identifiable from the DOM/markdown alone.

import { converse } from '../services/llm';
import type { ScrapedPage } from '../services/firecrawl';
import type { ResearchHit } from '../services/tavily';
import type { SubToolModule } from '../sub-tools';
import type { AuditFinding, AuditInput, AuditReport } from './types';

const USE_MOCK = process.env.LLM_USE_MOCK === 'true';
const MAX_MARKDOWN_CHARS = 18000;

export interface AnalyzeInput {
  input: AuditInput;
  subTool: SubToolModule;
  scraped: ScrapedPage;
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
- Review the scraped page content (markdown) and provided research snippets.
- Produce 4 to 7 concrete, specific usability findings.
- Each finding must reference observable evidence from the page (not generic advice).
- Cite research only where it directly backs your observation — never pad with irrelevant sources.
- Calibrate severity honestly: 'critical' = blocks user goals; 'high' = significant friction; 'medium' = clear improvement opportunity; 'low' = nice-to-have polish.

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
      "observation": "what you actually saw on this specific page (be concrete)",
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

function buildUserPrompt({ input, scraped, research }: AnalyzeInput): string {
  const md = scraped.markdown.length > MAX_MARKDOWN_CHARS
    ? scraped.markdown.slice(0, MAX_MARKDOWN_CHARS) + '\n\n[…truncated]'
    : scraped.markdown;

  const researchBlock = research
    .map((r, i) => `[${i + 1}] ${r.title}\n    ${r.url}\n    ${r.snippet.slice(0, 280)}`)
    .join('\n\n');

  return `URL: ${input.url}
PAGE TITLE: ${scraped.title ?? '(none)'}
META DESCRIPTION: ${scraped.description ?? '(none)'}

----- SCRAPED PAGE CONTENT (markdown) -----
${md}
----- END PAGE CONTENT -----

----- RESEARCH SNIPPETS (cite when directly applicable) -----
${researchBlock || '(no research returned)'}
----- END RESEARCH -----

Produce the JSON audit now.`;
}

function parseReport(rawText: string): AuditReport {
  const jsonText = extractJson(rawText);
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch (e) {
    throw new Error(`LLM returned unparseable JSON: ${(e as Error).message}\n---\n${rawText.slice(0, 600)}`);
  }

  if (!isReportShape(parsed)) {
    throw new Error(`LLM JSON did not match expected shape. Got: ${JSON.stringify(parsed).slice(0, 400)}`);
  }

  // Clamp + sanitize.
  const validSeverities = new Set(['critical', 'high', 'medium', 'low']);
  const findings: AuditFinding[] = parsed.findings
    .filter((f) => validSeverities.has(f.severity))
    .map((f) => ({
      parameter: String(f.parameter).trim(),
      severity: f.severity as AuditFinding['severity'],
      observation: String(f.observation).trim(),
      research: (f.research ?? []).map((r) => ({
        claim: String(r.claim ?? '').trim(),
        source: String(r.source ?? '').trim(),
      })).filter((r) => r.claim && r.source),
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
  // Fallback: assume the whole response is JSON.
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

function mockAnalyze({ input, subTool, research }: AnalyzeInput): AuditReport {
  const pickedParams = subTool.parameters.slice(0, 4);
  const findings = pickedParams.map((parameter, i) => ({
    parameter,
    severity: (['critical', 'high', 'medium', 'low'] as const)[i % 4],
    observation: `[mock] The ${parameter} aspect of ${input.url} shows opportunities for improvement.`,
    research: research.slice(i * 2, i * 2 + 2).map((r) => ({
      claim: r.snippet.slice(0, 120),
      source: r.url,
    })),
    recommendation: `[mock] Address the ${parameter} issue.`,
  }));

  return {
    summary: `[mock] Initial audit of ${input.url} (${subTool.label}) for ${input.targetAudience}.`,
    score: 72,
    findings,
    generatedAt: new Date().toISOString(),
  };
}
