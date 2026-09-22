import React, { useRef } from 'react';
import { DaySummary } from '@shared/types.js';
import { standupStatusLabel } from '../../lib/labels.js';

interface DayStripProps {
  days: DaySummary[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
}

function dayLabel(date: string, dayOfWeek: string): string {
  const short = dayOfWeek.slice(0, 3);
  const dayNum = date.slice(8).replace(/^0/, '');
  return `${short} ${dayNum}`;
}

export const DayStrip: React.FC<DayStripProps> = ({ days, selectedDate, onSelectDate }) => {
  const listRef = useRef<HTMLDivElement>(null);

  const moveSelection = (delta: number) => {
    const idx = days.findIndex(d => d.date === selectedDate);
    if (idx < 0) return;
    const next = days[idx + delta];
    if (next) onSelectDate(next.date);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      moveSelection(-1);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      moveSelection(1);
    }
  };

  return (
    <div>
      <div
        ref={listRef}
        role="listbox"
        aria-label="Recent days"
        onKeyDown={onKeyDown}
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${days.length}, 1fr)`,
          gap: '6px',
          marginBottom: '8px'
        }}
      >
        {days.map(d => {
          const isSelected = d.date === selectedDate;
          let dotClass = 'status-dot-neutral';
          let label: string = standupStatusLabel(d.status);

          if (d.status === 'submitted') {
            dotClass = 'status-dot-ok';
            label = `${d.doneCount}/${d.plannedCount}`;
          } else if (d.status === 'on leave') {
            dotClass = 'status-dot-warning';
            label = 'Leave';
          } else if (d.status === 'not submitted') {
            dotClass = 'status-dot-danger';
            label = 'Missing';
          } else if (d.status === 'weekend' || d.status === 'holiday') {
            dotClass = 'status-dot-neutral';
            label = standupStatusLabel(d.status);
          }

          return (
            <button
              key={d.date}
              type="button"
              role="option"
              aria-selected={isSelected}
              onClick={() => onSelectDate(d.date)}
              className={`day-strip-day${isSelected ? ' day-strip-day-selected' : ''}`}
              style={{
                background: isSelected ? 'var(--surface-2)' : 'var(--surface-1)',
                border: isSelected ? '1px solid var(--accent)' : '1px solid var(--border-default)',
                borderRadius: 'var(--radius-control)',
                padding: '8px 10px',
                textAlign: 'left',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                cursor: 'pointer',
                height: 'auto',
                position: 'relative'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  {dayLabel(d.date, d.dayOfWeek)}
                </span>
                <span className={`status-dot ${dotClass}`} aria-hidden />
              </div>

              <div className="tabular-nums" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                {label}
              </div>
            </button>
          );
        })}
      </div>

      <div
        className="day-strip-legend"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '12px',
          fontSize: '11px',
          color: 'var(--text-muted)',
          marginBottom: '16px'
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <span className="status-dot status-dot-ok" aria-hidden /> Submitted
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <span className="status-dot status-dot-danger" aria-hidden /> Missing
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <span className="status-dot status-dot-warning" aria-hidden /> Leave
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <span className="status-dot status-dot-neutral" aria-hidden /> Weekend / holiday
        </span>
      </div>
    </div>
  );
};
