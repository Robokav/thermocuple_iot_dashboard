import React from 'react';
import { 
  Wifi, 
  Clock, 
  AlertTriangle, 
  RotateCcw, 
  Network, 
  Search, 
  ArrowRight,
  ShieldCheck,
  Activity,
  CheckCircle2,
  XCircle,
  Loader2
} from 'lucide-react';
import { useMqtt } from '../contexts/MqttContext';
import { FurnaceCard } from './FurnaceCard';
import { FurnaceData } from '../types';

export const Dashboard: React.FC = () => {
  const { furnaces, pipeline, client, clearNodes } = useMqtt();
  const furnaceList = Object.values(furnaces) as FurnaceData[];

  const getStatusIcon = (status: 'idle' | 'loading' | 'success' | 'error') => {
    switch (status) {
      case 'loading': return <Loader2 className="w-4 h-4 text-primary animate-spin" />;
      case 'success': return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
      case 'error': return <XCircle className="w-4 h-4 text-error" />;
      default: return <Activity className="w-4 h-4 text-on-surface-variant opacity-30" />;
    }
  };

  const getStatusColor = (status: 'idle' | 'loading' | 'success' | 'error') => {
    switch (status) {
      case 'loading': return 'text-primary';
      case 'success': return 'text-emerald-400';
      case 'error': return 'text-error';
      default: return 'text-on-surface-variant opacity-40';
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Connection Pipeline Visualizer */}
      <section>
        <div className="glass-panel rounded-xl p-5 border border-outline-variant/20 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg border border-primary/20">
                <ShieldCheck className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-headline text-sm font-bold uppercase tracking-widest text-on-surface">Secure Pipeline</h3>
                <p className="text-[9px] font-mono text-on-surface-variant uppercase tracking-tighter">Serial Monitor Replacement // v2.4.0</p>
              </div>
            </div>
            <div className="flex items-center gap-2 px-3 py-1 bg-surface-container-highest rounded-full border border-outline-variant/30">
              <div className={`w-2 h-2 rounded-full ${client?.connected ? 'bg-emerald-400 animate-pulse' : 'bg-error'}`}></div>
              <span className="text-[9px] font-bold font-mono text-on-surface uppercase">{client?.connected ? 'Broker Connected' : 'Disconnected'}</span>
            </div>
          </div>

          <div className="relative flex justify-between items-center px-4">
            {/* Connection Lines */}
            <div className="absolute top-1/2 left-0 w-full h-[1px] bg-outline-variant/20 -translate-y-1/2 z-0"></div>
            
            {[
              { id: 'wifi', label: 'WiFi', icon: Wifi, status: pipeline.wifi },
              { id: 'ntp', label: 'NTP Sync', icon: Clock, status: pipeline.ntp },
              { id: 'mqtts', label: 'MQTTS', icon: Network, status: pipeline.mqtts },
              { id: 'discovery', label: 'Discovery', icon: Search, status: pipeline.discovery }
            ].map((stage, i) => (
              <div key={stage.id} className="relative z-10 flex flex-col items-center gap-3 group">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-500 border-2 ${
                  stage.status === 'success' ? 'bg-emerald-500/10 border-emerald-500/40 shadow-[0_0_15px_rgba(52,211,153,0.2)]' :
                  stage.status === 'error' ? 'bg-error/10 border-error/40 shadow-[0_0_15px_rgba(239,68,68,0.2)]' :
                  stage.status === 'loading' ? 'bg-primary/10 border-primary/40 animate-pulse' :
                  'bg-surface-container-highest border-outline-variant/40'
                }`}>
                  <stage.icon className={`w-6 h-6 ${
                    stage.status === 'success' ? 'text-emerald-400' :
                    stage.status === 'error' ? 'text-error' :
                    stage.status === 'loading' ? 'text-primary' :
                    'text-on-surface-variant opacity-40'
                  }`} />
                </div>
                <div className="flex flex-col items-center gap-1">
                  <span className={`text-[9px] font-bold uppercase tracking-widest ${getStatusColor(stage.status)}`}>{stage.label}</span>
                  {getStatusIcon(stage.status)}
                </div>
                
                {/* Tooltip for Error */}
                {stage.status === 'error' && (
                  <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-error text-on-error text-[8px] font-bold px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                    {stage.id === 'mqtts' ? 'Broker Unreachable' : stage.id === 'wifi' ? 'Signal Lost' : 'Handshake Failed'}
                  </div>
                )}
              </div>
            ))}
          </div>
          
          <div className="mt-8 pt-4 border-t border-outline-variant/10 flex justify-between items-center">
            <div className="flex items-center gap-4">
              <div className="flex flex-col">
                <span className="text-[8px] uppercase text-on-surface-variant font-bold">Latency</span>
                <span className="text-[10px] font-mono text-primary">24ms</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[8px] uppercase text-on-surface-variant font-bold">Uptime</span>
                <span className="text-[10px] font-mono text-primary">12:45:01</span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[8px] uppercase text-on-surface-variant font-bold">Active Nodes</span>
              <span className="text-[10px] font-mono text-emerald-400 block">{furnaceList.length} Discovered</span>
            </div>
          </div>
        </div>
      </section>

      {/* System Commands */}
      <section>
        <div className="flex items-center justify-between mb-4 px-1">
          <h3 className="font-headline text-base font-bold tracking-tight text-on-surface uppercase border-l-4 border-primary pl-3">System Commands</h3>
          <span className="text-[9px] font-mono text-on-surface-variant">GLOBAL_ADMIN</span>
        </div>
        <div className="grid grid-cols-1 gap-3">
          <button className="group relative overflow-hidden flex items-center gap-4 p-5 bg-error-container/10 border border-error/20 rounded-lg active:scale-95 active:bg-error-container/20 transition-all">
            <AlertTriangle className="w-8 h-8 text-error" />
            <span className="font-headline font-black uppercase text-error tracking-wider text-sm">Emergency Stop</span>
            <div className="absolute inset-0 shimmer opacity-10"></div>
          </button>
          <div className="grid grid-cols-3 gap-3">
            {[
              { icon: RotateCcw, label: 'Clear Nodes', action: clearNodes },
              { icon: Network, label: 'Reconnect', action: () => window.location.reload() },
              { icon: Search, label: 'Discovery', action: () => {} }
            ].map((cmd, i) => (
              <button key={i} onClick={cmd.action} className="flex flex-col items-center justify-center gap-2 p-4 glass-panel rounded-lg active:scale-95 transition-all hover:bg-surface-container-highest">
                <cmd.icon className="w-6 h-6 text-primary" />
                <span className="font-headline font-bold uppercase text-[9px] text-on-surface text-center">{cmd.label}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Furnaces */}
      <section className="space-y-6">
        {furnaceList.length > 0 ? (
          furnaceList.map(furnace => (
            <FurnaceCard key={furnace.chipId} furnace={furnace} />
          ))
        ) : (
          <div className="glass-panel p-12 rounded-xl border-2 border-dashed border-outline-variant/20 flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-surface-container-highest flex items-center justify-center">
              <Search className="w-8 h-8 text-on-surface-variant opacity-20 animate-pulse" />
            </div>
            <div>
              <h4 className="font-headline text-on-surface font-bold uppercase tracking-widest">No Nodes Discovered</h4>
              <p className="text-on-surface-variant text-[10px] mt-1 uppercase tracking-tighter">Scanning for hardware on discovery/nodes...</p>
            </div>
          </div>
        )}
      </section>

      {/* Thermal Scan */}
      <section>
        <div className="relative aspect-[16/9] rounded-xl overflow-hidden border border-outline-variant/20 shadow-xl">
          <img 
            alt="Industrial furnace interior" 
            className="w-full h-full object-cover grayscale brightness-[0.3]" 
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuCQ4PnH4SmpeAs2JD-7PhQaaXNc_0qJn-aCa6XzVcc9zzJiBwjqWOrYTFgjdn4jvhY7DqnbwjWPDGfwDi0xERdZCnPqila6baLlbKm4UthYBmrr7XsmKAPGZvoFKaw4WX6nzfcyYIQG5iUYuOWdBNMM-qlaiQ9fsEBnbjI2H1NK9aiDolq04rCqdjbBEXVRkwyQsbkGJ4h_8HT9FOrtPye39DvB015wXWjBMt-ukeauwQejGyVRXdYDJrOdFMz82llDwwf4Vdf7Cfc"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent opacity-80"></div>
          <div className="absolute bottom-4 left-4">
            <h5 className="text-white font-headline font-bold text-lg uppercase tracking-tight">Thermal Scan</h5>
            <p className="text-primary text-[10px] font-mono">NODE_ALPHA_01_FEED_ACTIVE</p>
          </div>
        </div>
      </section>
    </div>
  );
};
