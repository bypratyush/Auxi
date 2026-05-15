'use client';

import type { ReactNode } from 'react';
import type { AuditFinding } from '@/lib/audit/types';

type Position = 'left' | 'center' | 'right' | 'far';

export interface FloppyCommonProps {
  position: Position;
  active: boolean;
  ejecting?: boolean;
  reading?: boolean;
  inserting?: boolean;
}

interface FloppyShellProps extends FloppyCommonProps {
  kind: 'finding' | 'eject';
  tag: string;
  title: string;
  diskNumber: number;
  totalDisks: number;
  severity?: AuditFinding['severity'];
  researchCount?: number;
  date?: string;
  expandable?: boolean;
  onExpand?: () => void;
  children: ReactNode;
}

export function Floppy({
  position,
  active,
  ejecting,
  reading,
  inserting,
  kind,
  tag,
  title,
  diskNumber,
  totalDisks,
  severity,
  researchCount,
  date,
  expandable,
  onExpand,
  children,
}: FloppyShellProps) {
  const classes = [
    'floppy',
    `pos-${position}`,
    active ? 'is-active' : '',
    ejecting ? 'is-ejecting' : '',
    reading ? 'is-reading' : '',
    inserting ? 'is-inserting' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes} data-kind={kind} data-severity={severity ?? 'none'} aria-hidden={!active}>
      <div className="floppy-shell">
        <div className="floppy-slider">
          <div className="floppy-slider-cover" />
          <div className="floppy-slider-window" />
          <div className="floppy-disk-num">
            #{String(diskNumber).padStart(2, '0')}
          </div>
        </div>

        <div className="floppy-label" data-severity={severity ?? 'none'}>
          <div className="label-band" data-severity={severity ?? 'none'} />
          <div className="label-row">
            <span className="label-tag">{tag}</span>
            <span className="label-rev">REV.01</span>
          </div>
          <div className="label-title">{title}</div>
          <div className="label-row-bottom">
            {severity && (
              <span className="label-sev" data-severity={severity}>
                {severity}
              </span>
            )}
            {date && <span className="label-date">{date}</span>}
            {researchCount !== undefined && researchCount > 0 && (
              <span className="label-stamp">RESEARCH ×{researchCount}</span>
            )}
          </div>
        </div>

        <div className="floppy-led" aria-hidden="true" />
        <div className="floppy-indent" aria-hidden="true" />
        <div className="floppy-notch" aria-hidden="true" />
        <div className="floppy-serial" aria-hidden="true">
          AUXI-{String(diskNumber).padStart(2, '0')}/{String(totalDisks).padStart(2, '0')}
        </div>

        <div className="floppy-body">
          {reading && (
            <div className="floppy-reading-overlay" role="status">
              <span>READING</span>
              <span className="reading-dots">
                <span>.</span>
                <span>.</span>
                <span>.</span>
              </span>
            </div>
          )}
          <div className="floppy-content">{children}</div>
          {expandable && active && onExpand && (
            <button
              type="button"
              className="floppy-expand-btn"
              onClick={onExpand}
              aria-label="Expand finding for full details"
            >
              ▾ READ DETAILS
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
