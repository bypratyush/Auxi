'use client';

import { useEffect } from 'react';
import type { ReactNode } from 'react';
import type { AuditFinding } from '@/lib/audit/types';

export interface ExpandedFloppyProps {
  tag: string;
  title: string;
  severity?: AuditFinding['severity'];
  date?: string;
  diskNumber: number;
  totalDisks: number;
  researchCount?: number;
  children: ReactNode;
  onClose: () => void;
}

export function ExpandedFloppy({
  tag,
  title,
  severity,
  date,
  diskNumber,
  totalDisks,
  researchCount,
  children,
  onClose,
}: ExpandedFloppyProps) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    }
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  return (
    <div
      className="expanded-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={`${tag} — ${title}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="expanded-floppy">
        <div className="expanded-floppy-shell">
          <div className="floppy-slider">
            <div className="floppy-slider-cover" />
            <div className="floppy-slider-window" />
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

          <div className="floppy-led is-on" aria-hidden="true" />
          <div className="floppy-indent" aria-hidden="true" />
          <div className="floppy-notch" aria-hidden="true" />
          <div className="floppy-serial" aria-hidden="true">
            AUXI-{String(diskNumber).padStart(2, '0')}/{String(totalDisks).padStart(2, '0')}
          </div>

          <div className="expanded-floppy-body">{children}</div>

          <button
            type="button"
            className="expanded-close"
            onClick={onClose}
            aria-label="Close expanded view"
          >
            ✕ EJECT
          </button>
        </div>
      </div>
    </div>
  );
}
