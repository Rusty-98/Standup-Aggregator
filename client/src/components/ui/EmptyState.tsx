import React from 'react';

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ title, description, action }) => (
  <div className="empty-state">
    <h3>{title}</h3>
    {description ? <p>{description}</p> : null}
    {action}
  </div>
);
