import React from 'react';
import { DaySummary } from '@shared/types.js';

interface DayStripProps {
  days: DaySummary[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
}

export const DayStrip: React.FC<DayStripProps> = ({ days, selectedDate, onSelectDate }) => {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${days.length}, 1fr)`,
        gap: '6px',
        marginBottom: '20px'
      }}
    >
      {days.map(d => {
        const isSelected = d.date === selectedDate;
        let dotClass = 'status-dot-neutral';
        let label: string = d.status;

        if (d.status === 'submitted') {
          dotClass = 'status-dot-ok';
          label = `${d.doneCount}/${d.plannedCount}`;
        } else if (d.status === 'on leave') {
          dotClass = 'status-dot-warning';
          label = 'leave';
        } else if (d.status === 'not submitted') {
          dotClass = 'status-dot-danger';
          label = 'missing';
        } else if (d.status === 'weekend' || d.status === 'holiday') {
          dotClass = 'status-dot-neutral';
          label = d.status;
        }

        return (
          <button
            key={d.date}
            type="button"
            onClick={() => onSelectDate(d.date)}
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
              height: 'auto'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                {d.dayOfWeek}
              </span>
              <span className={`status-dot ${dotClass}`} />
            </div>

            <div className="tabular-nums" style={{ fontSize: '13px', fontWeight: 600 }}>
              {d.date.slice(8)}
            </div>

            <div className="tabular-nums" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              {label}
            </div>
          </button>
        );
      })}
    </div>
  );
};
