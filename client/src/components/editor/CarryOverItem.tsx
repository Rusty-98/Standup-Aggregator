import React from 'react';
import { CarryOverItem as CarryOverItemType } from '@shared/types.js';
import { X } from 'lucide-react';

interface CarryOverItemProps {
  item: CarryOverItemType;
  onRemove: (id: string) => void;
}

export const CarryOverItem: React.FC<CarryOverItemProps> = ({ item, onRemove }) => {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '3px 8px',
        background: 'var(--surface-2)',
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-control)',
        fontSize: '12px',
        color: 'var(--text-primary)',
        marginRight: '6px',
        marginBottom: '6px'
      }}
    >
      <span className="badge badge-warning" style={{ fontSize: '10px', height: '16px', padding: '0 4px' }}>
        carried over
      </span>
      <span>{item.text}</span>
      <button
        type="button"
        onClick={() => onRemove(item.id)}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '2px',
          height: 'auto',
          color: 'var(--text-muted)'
        }}
        title="Remove item"
      >
        <X size={12} />
      </button>
    </div>
  );
};
