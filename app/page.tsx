'use client';

import { Fragment, useEffect, useRef, useState } from 'react';
import { Mascot, type MascotPose } from './components/Mascot';
import { Report } from './components/Report';
import type { AuditReport, AuditStatus, Technicality, WebsiteType } from '@/lib/audit/types';
import type { StreamEvent } from '@/lib/audit/pipeline';

function getSessionId(): string {
  if (typeof window === 'undefined') return '';
  let id = window.localStorage.getItem('auxi-session');
  if (!id) {
    id = `s-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
    window.localStorage.setItem('auxi-session', id);
  }
  return id;
}

const STAGE_COPY: Record<AuditStatus, string> = {
  queued: 'queued',
  scraping: 'reading the page',
  researching: 'gathering studies',
  analyzing: 'reasoning through findings',
  complete: 'done',
  failed: 'failed',
};

type Tone = 'non' | 'mixed' | 'tech';

const CATEGORIES: { id: WebsiteType; label: string; hint: string }[] = [
  { id: 'ecommerce', label: 'E-commerce', hint: 'shop · checkout' },
  { id: 'saas', label: 'SaaS', hint: 'app · dashboard' },
  { id: 'landing', label: 'Marketing', hint: 'landing page' },
  { id: 'docs', label: 'Documentation', hint: 'reference · api' },
  { id: 'blog', label: 'Content', hint: 'blog · magazine' },
  { id: 'portfolio', label: 'Portfolio', hint: 'personal · studio' },
  { id: 'nonprofit', label: 'Non-profit', hint: 'charity · mission' },
  { id: 'news', label: 'News / Media', hint: 'editorial · press' },
];

const STEPS: { num: string; label: string; pose: MascotPose }[] = [
  { num: '01', label: 'URL', pose: 'wave' },
  { num: '02', label: 'Category', pose: 'scan' },
  { num: '03', label: 'Audience', pose: 'think' },
  { num: '04', label: 'Tone', pose: 'stand' },
];

const COPY: Record<number, { h: string; s: string }> = {
  1: {
    h: 'Audit any website.\nAsk it questions.',
    s: "Paste a URL. I'll read the page, run accessibility checks, and write a report grounded in research for your category.",
  },
  2: {
    h: 'What kind of site\nare we looking at?',
    s: 'Each category loads its own research base — Baymard for e-commerce, NN/g for content, WCAG for everyone.',
  },
  3: {
    h: 'Who is the\ntarget audience?',
    s: 'Audience framing changes which heuristics get weighted most heavily in the audit.',
  },
  4: {
    h: 'How technical\nare they?',
    s: 'Adjusts the language complexity and jargon thresholds the auditor will tolerate.',
  },
};

const TONE_TO_TECHNICALITY: Record<Tone, Technicality> = {
  non: 'non_technical',
  mixed: 'mixed',
  tech: 'technical',
};

const CALLOUTS: Record<number, string> = {
  1: "Hi! I'm Auxi. I'll help you find what's quietly hurting your site's UX.",
  2: 'Every genre has its own UX gospel. Pick the closest match — I’ll load the rest.',
  3: "Who's actually landing here? Be specific — “everyone” helps no one.",
  4: 'Jargon meter check. How much nerd-speak can they handle?',
};

export default function Home() {
  const [step, setStep] = useState(1);
  const [url, setUrl] = useState('');
  const [category, setCategory] = useState<WebsiteType | ''>('');
  const [audience, setAudience] = useState('');
  const [tone, setTone] = useState<Tone | ''>('');
  const [submitted, setSubmitted] = useState(false);
  const [auditStage, setAuditStage] = useState<AuditStatus | null>(null);
  const [stageMessage, setStageMessage] = useState<string | null>(null);
  const [report, setReport] = useState<AuditReport | null>(null);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [auditId, setAuditId] = useState<string | null>(null);
  const auditAbortRef = useRef<AbortController | null>(null);

  const validUrl = /^([\w-]+\.)+[\w-]{2,}(\/.*)?$/i.test(url.trim());
  const canAdvance =
    (step === 1 && validUrl) ||
    (step === 2 && !!category) ||
    (step === 3 && audience.trim().length >= 3) ||
    (step === 4 && !!tone);

  const copy = COPY[step];

  // Headline reveals word-by-word (blur-fade). Sub dissolves in after headline finishes.
  const headlineWords = copy.h.split(/\s+/).filter(Boolean).length;
  const HEADLINE_STAGGER = 80;
  const HEADLINE_WORD_DUR = 600;
  const headlineTotalMs = headlineWords * HEADLINE_STAGGER + HEADLINE_WORD_DUR;

  function next() {
    if (!canAdvance) return;
    if (step < 4) setStep(step + 1);
    else {
      setSubmitted(true);
      void runAudit();
    }
  }
  function back() {
    if (step > 1 && !submitted) setStep(step - 1);
  }

  async function runAudit() {
    if (!category || !tone) return;
    setAuditError(null);
    setReport(null);
    setAuditStage('queued');
    setStageMessage(null);
    setAuditId(null);

    const controller = new AbortController();
    auditAbortRef.current = controller;

    try {
      const res = await fetch('/api/audits', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-auxi-session': getSessionId(),
        },
        body: JSON.stringify({
          url: url.startsWith('http') ? url : `https://${url}`,
          websiteType: category,
          targetAudience: audience,
          technicality: TONE_TO_TECHNICALITY[tone],
        }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const errBody = await res.text().catch(() => '');
        throw new Error(`Audit request failed (${res.status}): ${errBody.slice(0, 200)}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          let evt: StreamEvent;
          try {
            evt = JSON.parse(trimmed);
          } catch {
            continue;
          }
          if (evt.type === 'audit_id') {
            setAuditId(evt.id);
          } else if (evt.type === 'stage') {
            setAuditStage(evt.stage);
            setStageMessage(evt.message ?? null);
          } else if (evt.type === 'complete') {
            setAuditStage('complete');
            setReport(evt.report);
            setAuditId(evt.auditId);
          } else if (evt.type === 'error') {
            setAuditError(evt.message);
            setAuditStage('failed');
          }
        }
      }
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      setAuditError(e instanceof Error ? e.message : String(e));
      setAuditStage('failed');
    }
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Enter' && !submitted) {
        const el = document.activeElement;
        if (el && el.tagName === 'BUTTON') return;
        e.preventDefault();
        next();
      }
      if (e.key === 'Escape') {
        auditAbortRef.current?.abort();
        setStep(1);
        setUrl('');
        setCategory('');
        setAudience('');
        setTone('');
        setSubmitted(false);
        setAuditStage(null);
        setStageMessage(null);
        setReport(null);
        setAuditError(null);
        setAuditId(null);
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  const currentStep = STEPS[step - 1];
  const categoryLabel = CATEGORIES.find((c) => c.id === category)?.label ?? '';

  return (
    <div className="page">
      <header className="top">
        <div className="brand">
          <span className="brand-mark">▣</span>
          <span className="brand-name">AUXI</span>
        </div>
        <div className="meta">
          <span className="step">
            {currentStep.num} · {currentStep.label}
          </span>
          <span>
            <span className="dot" />
            v0.1
          </span>
        </div>
      </header>

      <main className="main">
        {report ? (
          <div className="col col-report">
            <Report
              report={report}
              url={url.startsWith('http') ? url : `https://${url}`}
              websiteTypeLabel={categoryLabel}
              websiteType={category as WebsiteType}
              audience={audience}
              technicality={tone ? TONE_TO_TECHNICALITY[tone] : 'mixed'}
              auditId={auditId}
              onRestart={() => {
                auditAbortRef.current?.abort();
                setStep(1);
                setUrl('');
                setCategory('');
                setAudience('');
                setTone('');
                setSubmitted(false);
                setAuditStage(null);
                setStageMessage(null);
                setReport(null);
                setAuditError(null);
                setAuditId(null);
              }}
            />
          </div>
        ) : (
        <div className="col">
          <section className="intro">
            <div className="mascot-row">
              <Mascot pose={currentStep.pose} />
              <div className="callout" role="note" aria-label="Auxi callout">
                <span className="callout-tag">AUXI</span>
                <p className="callout-text" key={step}>
                  {CALLOUTS[step]}
                </p>
              </div>
            </div>

            <h1 className="headline">
              {(() => {
                let wordIdx = 0;
                return copy.h.split('\n').map((line, lineI, arr) => {
                  const words = line.split(' ');
                  return (
                    <Fragment key={`${step}-l${lineI}`}>
                      {words.map((word, wi) => {
                        const delay = wordIdx * HEADLINE_STAGGER;
                        wordIdx += 1;
                        return (
                          <span
                            key={`${step}-l${lineI}-w${wi}`}
                            className="word-reveal"
                            style={{ animationDelay: `${delay}ms` }}
                          >
                            {word}
                            {wi < words.length - 1 ? ' ' : ''}
                          </span>
                        );
                      })}
                      {lineI < arr.length - 1 && <br />}
                    </Fragment>
                  );
                });
              })()}
            </h1>

            <p className="sub">
              <span
                key={`sub-${step}`}
                className="dissolve"
                style={{ animationDelay: `${headlineTotalMs}ms` }}
              >
                {copy.s}
              </span>
            </p>
          </section>

          {!submitted ? (
            <form
              key={step}
              className="form"
              onSubmit={(e) => {
                e.preventDefault();
                next();
              }}
            >
              <div className="step-meta">
                <span>step {String(step).padStart(2, '0')} of 04</span>
                <span className="step-bar">
                  {STEPS.map((_, i) => (
                    <span key={i} className={'step-tick ' + (i < step ? 'on' : '')} />
                  ))}
                </span>
              </div>

              {step === 1 && (
                <div className="input-wrap">
                  <span className="input-prefix">›</span>
                  <input
                    autoFocus
                    type="text"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="your-website.com"
                    className="input"
                  />
                  <span className="input-status">{validUrl ? '✓' : url ? '·' : ''}</span>
                </div>
              )}

              {step === 2 && (
                <div className="options">
                  {CATEGORIES.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className={'opt ' + (category === c.id ? 'opt-on' : '')}
                      onClick={() => setCategory(c.id)}
                    >
                      <span className="opt-row1">
                        <span className="opt-mark">{category === c.id ? '●' : '○'}</span>
                        <span>{c.label}</span>
                      </span>
                      <span className="opt-hint">{c.hint}</span>
                    </button>
                  ))}
                </div>
              )}

              {step === 3 && (
                <div className="input-wrap">
                  <span className="input-prefix">›</span>
                  <input
                    autoFocus
                    type="text"
                    value={audience}
                    onChange={(e) => setAudience(e.target.value)}
                    placeholder="e.g. first-time visitors aged 25–40"
                    className="input"
                  />
                  <span className="input-status">{audience.trim().length >= 3 ? '✓' : ''}</span>
                </div>
              )}

              {step === 4 && (
                <div className="segs">
                  {(
                    [
                      { v: 'non', label: 'non-technical' },
                      { v: 'mixed', label: 'mixed' },
                      { v: 'tech', label: 'technical' },
                    ] as { v: Tone; label: string }[]
                  ).map((o) => (
                    <button
                      key={o.v}
                      type="button"
                      onClick={() => setTone(o.v)}
                      className={'seg ' + (tone === o.v ? 'seg-on' : '')}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              )}

              <div className="actions">
                <button
                  type="button"
                  className="btn btn-back"
                  onClick={back}
                  disabled={step === 1}
                >
                  ← back
                </button>
                <button
                  type="submit"
                  className={'btn btn-primary ' + (canAdvance ? '' : 'is-disabled')}
                  disabled={!canAdvance}
                >
                  {step < 4 ? 'continue' : 'run audit'}
                  <span className="btn-arrow">→</span>
                </button>
              </div>
            </form>
          ) : (
            <div className="receipt">
              <div className="r-title">
                <span>
                  <span className="blink">●</span>{' '}
                  {auditError
                    ? 'audit failed'
                    : report
                      ? 'audit complete'
                      : auditStage
                        ? STAGE_COPY[auditStage]
                        : 'starting…'}
                </span>
                {!report && !auditError && <span>~25s</span>}
              </div>

              <div className="r-row">
                <span>url</span>
                <span className="r-val">{url}</span>
              </div>
              <div className="r-row">
                <span>category</span>
                <span className="r-val">{categoryLabel}</span>
              </div>

              {stageMessage && !report && !auditError && (
                <div className="r-row">
                  <span>step</span>
                  <span className="r-val">{stageMessage}</span>
                </div>
              )}

              {auditError && (
                <div className="r-row">
                  <span>error</span>
                  <span className="r-val">{auditError}</span>
                </div>
              )}

            </div>
          )}
        </div>
        )}
      </main>

      <footer className="foot">
        <span>auxi · 2026</span>
        <span>esc to reset</span>
      </footer>
    </div>
  );
}
