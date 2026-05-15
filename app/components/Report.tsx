'use client';

import { FloppyCarousel, type CarouselItem } from './FloppyCarousel';
import { Mascot } from './Mascot';
import type { AuditFinding, AuditReport, Technicality, WebsiteType } from '@/lib/audit/types';

export interface ReportProps {
  report: AuditReport;
  url: string;
  websiteTypeLabel: string;
  websiteType: WebsiteType;
  audience: string;
  technicality: Technicality;
  auditId: string | null;
  onRestart: () => void;
}

const SEVERITY_ORDER: AuditFinding['severity'][] = ['critical', 'high', 'medium', 'low'];

const TECHNICALITY_LABEL: Record<Technicality, string> = {
  non_technical: 'non-technical',
  mixed: 'mixed',
  technical: 'technical',
};

export function Report({
  report,
  url,
  websiteTypeLabel,
  audience,
  technicality,
  auditId,
  onRestart,
}: ReportProps) {
  const counts = SEVERITY_ORDER.reduce<Record<AuditFinding['severity'], number>>(
    (acc, s) => {
      acc[s] = report.findings.filter((f) => f.severity === s).length;
      return acc;
    },
    { critical: 0, high: 0, medium: 0, low: 0 },
  );

  const generated = new Date(report.generatedAt);
  const dateStr = formatDate(generated);
  const displayHost = (() => {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return url;
    }
  })();

  const totalDisks = report.findings.length + 1; // findings + eject

  const items: CarouselItem[] = [
    ...report.findings.map<CarouselItem>((f, i) => ({
      kind: 'finding',
      tag: `FINDING ${String(i + 1).padStart(2, '0')}`,
      title: f.parameter,
      severity: f.severity,
      researchCount: f.research.length,
      date: dateStr,
      body: <FindingPreview finding={f} />,
      expanded: <FindingBody finding={f} />,
    })),
    {
      kind: 'eject',
      tag: 'EJECT',
      title: 'audit complete',
      date: dateStr,
      body: (
        <EjectBody
          auditId={auditId}
          generated={generated}
          findingsCount={report.findings.length}
          onRestart={onRestart}
        />
      ),
    },
  ];

  return (
    <article className="report-deck">
      <section className="deck-summary">
        <div className="deck-summary-mascot">
          <Mascot pose="stand" />
        </div>
        <div className="deck-summary-body">
          <div className="deck-summary-head">
            <div className="deck-summary-tag">
              AUDIT · {dateStr} · {formatTime(generated)}
            </div>
            <h2 className="deck-summary-title">{displayHost}</h2>
            <div className="deck-summary-meta">
              <span>{websiteTypeLabel}</span>
              <span className="dot-sep">·</span>
              <span>{audience}</span>
              <span className="dot-sep">·</span>
              <span>{TECHNICALITY_LABEL[technicality]}</span>
            </div>
          </div>

          <div className="deck-summary-score-row">
            <div className="deck-score">
              <span className="deck-score-num">{report.score}</span>
              <span className="deck-score-of">/ 100</span>
            </div>
            <div className="deck-distribution">
              {SEVERITY_ORDER.map((s) => (
                <div key={s} className="dist-pip" data-severity={s}>
                  <span className="dist-pip-num">{counts[s]}</span>
                  <span className="dist-pip-label">{s}</span>
                </div>
              ))}
            </div>
          </div>

          <p className="deck-summary-text">{report.summary}</p>
        </div>
      </section>

      <FloppyCarousel items={items} totalDisks={totalDisks} />
    </article>
  );
}

function FindingPreview({ finding }: { finding: AuditFinding }) {
  const headline = firstSentence(finding.observation);
  return (
    <div className="finding-preview">
      <span className="section-label-sm">Observation</span>
      <p className="finding-preview-headline">{headline}</p>
      <div className="finding-preview-meta">
        <span>{finding.research.length} source{finding.research.length === 1 ? '' : 's'}</span>
        <span className="dot-sep">·</span>
        <span>has recommendation</span>
      </div>
    </div>
  );
}

function firstSentence(text: string, maxChars = 160): string {
  const t = text.trim();
  // Try to split on sentence-ending punctuation
  const match = t.match(/^.+?[.!?](?=\s|$)/);
  let sentence = match ? match[0] : t;
  if (sentence.length > maxChars) {
    sentence = sentence.slice(0, maxChars - 1).replace(/\s+\S*$/, '') + '…';
  }
  return sentence;
}

function FindingBody({ finding }: { finding: AuditFinding }) {
  return (
    <div className="finding-body">
      <section className="finding-section">
        <span className="section-label-sm">Observation</span>
        <p>{finding.observation}</p>
      </section>
      <section className="finding-section">
        <span className="section-label-sm">Recommendation</span>
        <p>{finding.recommendation}</p>
      </section>
      {finding.research.length > 0 && (
        <section className="finding-section">
          <span className="section-label-sm">Research</span>
          <ul className="finding-research">
            {finding.research.map((r, i) => (
              <li key={i}>
                <p className="research-claim">“{r.claim}”</p>
                <a
                  href={r.source}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="research-source"
                >
                  {hostnameOf(r.source)} ↗
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function EjectBody({
  auditId,
  generated,
  findingsCount,
  onRestart,
}: {
  auditId: string | null;
  generated: Date;
  findingsCount: number;
  onRestart: () => void;
}) {
  return (
    <div className="eject-body">
      <p className="eject-line">
        That&apos;s the deck — <strong>{findingsCount}</strong> findings in your pocket.
      </p>
      <dl className="eject-meta">
        {auditId && (
          <div>
            <dt>id</dt>
            <dd>{auditId.slice(0, 8)}</dd>
          </div>
        )}
        <div>
          <dt>saved</dt>
          <dd>{generated.toLocaleString()}</dd>
        </div>
      </dl>
      <button type="button" className="eject-btn" onClick={onRestart}>
        ↺ new audit
      </button>
    </div>
  );
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function formatTime(d: Date): string {
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}
function hostnameOf(u: string): string {
  try {
    return new URL(u).hostname.replace(/^www\./, '');
  } catch {
    return u;
  }
}
