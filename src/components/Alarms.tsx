import React from 'react';
import { 
  Bell, 
  CheckCircle2, 
  Search, 
  XCircle, 
  AlertTriangle, 
  Info 
} from 'lucide-react';
import { LogEntry, Severity } from '../types';
import { LogEntryCard } from './LogEntryCard';

export const Alarms: React.FC = () => {
  const logs: LogEntry[] = [
    { id: '1', timestamp: '2023-10-27 14:22:01.442', source: 'FURNACE_01', severity: 'critical', message: 'TEMP_THRESHOLD_REACHED: Core temperature exceeds 1450°C. Emergency venting initiated.' },
    { id: '2', timestamp: '2023-10-27 14:18:55.012', source: 'NETWORK_HUB', severity: 'warning', message: 'LATENCY_SPIKE: Communication delay detected on Node_7b. Check ethernet bridge.' },
    { id: '3', timestamp: '2023-10-27 14:15:22.901', source: 'FURNACE_02', severity: 'info', message: 'BATCH_COMPLETE: Heating cycle 04-A finished successfully. Entering cooling phase.' },
    { id: '4', timestamp: '2023-10-27 14:10:04.221', source: 'NETWORK_CORE', severity: 'critical', message: 'DB_CONNECTION_LOST: Remote historian unreachable. Buffering data locally.' },
    { id: '5', timestamp: '2023-10-27 13:58:12.776', source: 'FURNACE_01', severity: 'warning', message: 'PRESSURE_LOW: Gas intake pressure dropping below optimal range. Valve B check suggested.' }
  ];

  const severityIcons = {
    critical: <XCircle className="text-error w-5 h-5" />,
    warning: <AlertTriangle className="text-amber-400 w-5 h-5" />,
    info: <Info className="text-primary w-5 h-5" />
  };

  const severityBorders = {
    critical: 'border-error',
    warning: 'border-amber-400',
    info: 'border-primary'
  };

  return (
    <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="font-headline text-3xl font-black text-on-surface tracking-tight uppercase">Alarms & System Logs</h2>
          <p className="text-on-surface-variant font-body text-sm mt-1">Real-time telemetry monitoring and fault detection system</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="bg-primary border border-primary/40 text-on-primary px-4 py-2 flex items-center gap-2 hover:bg-primary-dim transition-all font-bold text-xs uppercase tracking-wider shadow-[0_0_15px_rgba(123,208,255,0.3)]">
            <Bell className="w-4 h-4" />
            Create Custom Alert
          </button>
          <button className="bg-primary/10 border border-primary/20 text-primary px-4 py-2 flex items-center gap-2 hover:bg-primary/20 transition-all font-medium text-sm">
            <CheckCircle2 className="w-4 h-4" />
            Clear All
          </button>
        </div>
      </div>

      {/* Filters */}
      <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-surface-container p-4 rounded-lg">
          <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-2 tracking-widest">Severity Level</label>
          <div className="flex gap-2">
            <button className="flex-1 py-1.5 px-2 bg-error-container/20 border border-error/30 text-error text-[10px] font-bold transition-all">CRITICAL</button>
            <button className="flex-1 py-1.5 px-2 bg-surface-container-high border border-outline-variant/40 text-on-surface-variant text-[10px] font-bold hover:border-primary/50">WARN</button>
            <button className="flex-1 py-1.5 px-2 bg-surface-container-high border border-outline-variant/40 text-on-surface-variant text-[10px] font-bold hover:border-primary/50">INFO</button>
          </div>
        </div>
        <div className="bg-surface-container p-4 rounded-lg">
          <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-2 tracking-widest">Timeframe</label>
          <div className="relative">
            <input className="w-full bg-surface-container-lowest border border-outline-variant/30 text-on-surface text-sm py-1.5 px-3 focus:ring-1 focus:ring-primary focus:border-primary outline-none rounded" type="text" defaultValue="Last 24 Hours" />
          </div>
        </div>
        <div className="bg-surface-container p-4 rounded-lg">
          <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-2 tracking-widest">Source Node</label>
          <select className="w-full bg-surface-container-lowest border border-outline-variant/30 text-on-surface text-sm py-1.5 px-3 focus:ring-1 focus:ring-primary focus:border-primary outline-none appearance-none rounded">
            <option>All Systems</option>
            <option>Furnace #01</option>
            <option>Furnace #02</option>
            <option>Network Core</option>
          </select>
        </div>
        <div className="bg-surface-container p-4 rounded-lg">
          <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-2 tracking-widest">Log Search</label>
          <div className="relative">
            <input className="w-full bg-surface-container-lowest border border-outline-variant/30 text-on-surface text-sm py-1.5 px-3 focus:ring-1 focus:ring-primary focus:border-primary outline-none rounded" placeholder="Filter messages..." type="text" />
            <Search className="absolute right-2 top-2 text-on-surface-variant w-4 h-4" />
          </div>
        </div>
      </section>

      {/* Log List */}
      <div className="space-y-2">
        {logs.map(log => (
          <LogEntryCard 
            key={log.id} 
            log={log} 
            severityIcons={severityIcons} 
            severityBorders={severityBorders} 
          />
        ))}
      </div>

      <div className="flex justify-center">
        <button className="bg-surface-container border border-outline-variant/30 text-on-surface-variant px-8 py-2 text-xs font-bold uppercase tracking-widest hover:text-primary hover:border-primary transition-all rounded">
          Load History (120+ Records)
        </button>
      </div>
    </div>
  );
};
