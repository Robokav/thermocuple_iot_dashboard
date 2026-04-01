import React from 'react';

interface StatusBadgeProps {
  status: string;
}

export const StatusBadge = ({ status }: StatusBadgeProps) => {
  const colors = {
    online: 'bg-tertiary/10 text-tertiary border-tertiary/20',
    idle: 'bg-secondary-container text-secondary border-outline-variant/30',
    standby: 'bg-secondary-container/20 text-on-surface-variant border-outline-variant/20',
    offline: 'bg-surface-variant text-on-surface-variant opacity-60',
  };
  return (
    <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded border uppercase tracking-widest ${colors[status as keyof typeof colors]}`}>
      {status}
    </span>
  );
};
