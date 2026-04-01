import React from 'react';
import { LogEntry, Severity } from '../types';

interface LogEntryCardProps {
  log: LogEntry;
  severityIcons: Record<Severity, React.ReactNode>;
  severityBorders: Record<Severity, string>;
}

export const LogEntryCard: React.FC<LogEntryCardProps> = ({ log, severityIcons, severityBorders }) => (
  <div className={`glass-panel group border-l-4 ${severityBorders[log.severity]} hover:bg-surface-container-highest/60 transition-all rounded-lg overflow-hidden`}>
    <div className="grid grid-cols-1 md:grid-cols-12 items-center gap-4 px-6 py-4">
      <div className="col-span-1 flex items-center gap-2">
        {severityIcons[log.severity]}
        <span className="md:hidden font-bold text-xs uppercase" style={{ color: `var(--color-${log.severity === 'warning' ? 'amber-400' : log.severity})` }}>{log.severity}</span>
      </div>
      <div className="col-span-2 font-mono text-xs text-on-surface-variant">{log.timestamp}</div>
      <div className="col-span-2">
        <span className={`text-[10px] px-2 py-0.5 font-bold border rounded ${log.severity === 'critical' ? 'bg-error/10 text-error border-error/20' : 'bg-surface-container-high text-on-secondary-container border-outline-variant/30'}`}>
          {log.source}
        </span>
      </div>
      <div className="col-span-5">
        <p className="text-sm font-medium text-on-surface tracking-tight">{log.message}</p>
      </div>
      <div className="col-span-2 flex justify-end">
        {log.severity === 'info' ? (
          <span className="text-[10px] font-bold text-on-surface-variant uppercase px-3 py-1 italic opacity-50">Auto-Logged</span>
        ) : (
          <button className="text-[10px] font-bold text-primary uppercase border border-primary/30 px-3 py-1 hover:bg-primary/10 transition-colors rounded">Acknowledge</button>
        )}
      </div>
    </div>
  </div>
);
