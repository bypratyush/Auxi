'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Floppy } from './Floppy';
import { ExpandedFloppy } from './ExpandedFloppy';
import {
  isMuted,
  playClose,
  playEject,
  playInsert,
  playLed,
  playLoad,
  playWhirr,
  setMuted,
  unlockAudio,
} from '@/lib/sound/floppy';
import type { AuditFinding } from '@/lib/audit/types';

export interface CarouselItem {
  kind: 'finding' | 'eject';
  tag: string;
  title: string;
  severity?: AuditFinding['severity'];
  researchCount?: number;
  date?: string;
  /** Compact body shown in the carousel. */
  body: React.ReactNode;
  /** Optional full-detail content shown in the expanded overlay. */
  expanded?: React.ReactNode;
}

export interface FloppyCarouselProps {
  items: CarouselItem[];
  totalDisks: number;
}

// Transition phase durations (ms) — must match CSS keyframes
const T_EJECT = 90;
const T_READ = 220;
const T_INSERT = 200;
const T_LOCK = 70;

export function FloppyCarousel({ items, totalDisks }: FloppyCarouselProps) {
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<'idle' | 'ejecting' | 'reading' | 'inserting'>('idle');
  const [dir, setDir] = useState<1 | -1>(1);
  const [muted, setMutedState] = useState(false);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const lockedRef = useRef(false);

  const openExpanded = useCallback((i: number) => {
    unlockAudio();
    playLoad();
    setExpandedIdx(i);
  }, []);
  const closeExpanded = useCallback(() => {
    playClose();
    setExpandedIdx(null);
  }, []);

  useEffect(() => {
    setMutedState(isMuted());
  }, []);

  const total = items.length;

  const goTo = useCallback(
    (next: number) => {
      if (lockedRef.current) return;
      const clamped = Math.max(0, Math.min(total - 1, next));
      if (clamped === index) return;
      lockedRef.current = true;
      setDir(clamped > index ? 1 : -1);

      // Phase 1: eject pop
      unlockAudio();
      playEject();
      setPhase('ejecting');

      window.setTimeout(() => {
        // Phase 2: reading — slide out + overlay
        playWhirr();
        setPhase('reading');

        window.setTimeout(() => {
          // commit the new index (incoming floppy now occupies center)
          setIndex(clamped);

          // Phase 3: inserting — slide in
          setPhase('inserting');

          window.setTimeout(() => {
            // lock-down + LED confirm
            playInsert();

            window.setTimeout(() => {
              playLed();
              setPhase('idle');
              lockedRef.current = false;
            }, T_LOCK);
          }, T_INSERT);
        }, T_READ);
      }, T_EJECT);
    },
    [index, total],
  );

  const next = useCallback(() => goTo(index + 1), [index, goTo]);
  const prev = useCallback(() => goTo(index - 1), [index, goTo]);

  // keyboard navigation
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        next();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        prev();
      } else if (e.key === 'Home') {
        e.preventDefault();
        goTo(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        goTo(total - 1);
      } else if (/^[1-9]$/.test(e.key)) {
        e.preventDefault();
        goTo(parseInt(e.key, 10) - 1);
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [next, prev, goTo, total]);

  function toggleMute() {
    const newMuted = !muted;
    setMuted(newMuted);
    setMutedState(newMuted);
    if (!newMuted) {
      unlockAudio();
      playLed();
    }
  }

  // Render three slots — prev / current / next — so transitions have a from/to.
  const slots = [-1, 0, 1].map((offset) => {
    const slotIdx = index + offset;
    if (slotIdx < 0 || slotIdx >= total) return null;
    const item = items[slotIdx];
    const position: 'left' | 'center' | 'right' = offset === -1 ? 'left' : offset === 0 ? 'center' : 'right';
    return (
      <Floppy
        key={slotIdx}
        kind={item.kind}
        tag={item.tag}
        title={item.title}
        severity={item.severity}
        researchCount={item.researchCount}
        date={item.date}
        diskNumber={slotIdx + 1}
        totalDisks={totalDisks}
        position={position}
        active={offset === 0}
        ejecting={offset === 0 && phase === 'ejecting'}
        reading={offset === 0 && phase === 'reading'}
        inserting={offset === 0 && phase === 'inserting'}
        expandable={Boolean(item.expanded)}
        onExpand={() => openExpanded(slotIdx)}
      >
        {item.body}
      </Floppy>
    );
  });

  return (
    <div className="floppy-carousel" data-dir={dir > 0 ? 'next' : 'prev'} data-phase={phase}>
      <div className="floppy-stage">{slots}</div>

      <div className="floppy-nav">
        <button
          type="button"
          className="floppy-btn"
          aria-label="Previous disk"
          onClick={prev}
          disabled={index === 0 || phase !== 'idle'}
        >
          <span className="floppy-btn-arrow">◀</span>
        </button>

        <div className="floppy-counter">
          DISK <span className="floppy-counter-current">{String(index + 1).padStart(2, '0')}</span> /{' '}
          {String(total).padStart(2, '0')}
        </div>

        <button
          type="button"
          className="floppy-btn"
          aria-label="Next disk"
          onClick={next}
          disabled={index === total - 1 || phase !== 'idle'}
        >
          <span className="floppy-btn-arrow">▶</span>
        </button>

        <button
          type="button"
          className="floppy-mute"
          aria-label={muted ? 'Unmute sounds' : 'Mute sounds'}
          aria-pressed={muted}
          onClick={toggleMute}
        >
          {muted ? '🔇' : '🔊'}
        </button>
      </div>

      <div className="floppy-track" role="tablist" aria-label="Disk position">
        {items.map((it, i) => (
          <button
            key={i}
            type="button"
            role="tab"
            aria-selected={i === index}
            aria-label={`${it.tag} — ${it.title}`}
            className={'track-dot ' + (i === index ? 'on' : '')}
            onClick={() => goTo(i)}
            disabled={phase !== 'idle'}
          />
        ))}
      </div>

      {expandedIdx !== null && items[expandedIdx] && items[expandedIdx].expanded && (
        <ExpandedFloppy
          tag={items[expandedIdx].tag}
          title={items[expandedIdx].title}
          severity={items[expandedIdx].severity}
          researchCount={items[expandedIdx].researchCount}
          date={items[expandedIdx].date}
          diskNumber={expandedIdx + 1}
          totalDisks={totalDisks}
          onClose={closeExpanded}
        >
          {items[expandedIdx].expanded}
        </ExpandedFloppy>
      )}
    </div>
  );
}
