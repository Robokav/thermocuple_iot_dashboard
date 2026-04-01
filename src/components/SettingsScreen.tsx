import React from 'react';
import { Database, Wifi, Bell, Lock } from 'lucide-react';

export const SettingsScreen: React.FC = () => (
  <div className="space-y-8 animate-in slide-in-from-right-4 duration-500">
    <h2 className="font-headline text-3xl font-black text-on-surface tracking-tight uppercase">System Settings</h2>
    <div className="glass-panel p-6 rounded-xl space-y-6">
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-full border-2 border-primary overflow-hidden">
          <img 
            alt="Operator" 
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuAE403k-lkDd40yRLN5HFiAozATBBdjaFeHPqjiaMnQI9o6DbXsH1bsFMRZGUD9PNgTSPz5GWyBeV0rrCG4t1TiBMSTu8P622mY0L6_v0NZ6KZYNfkShg4puxc1-ySHOJBTcgmea4UPcYJczMOYL7bVHqQ2klsPn2f-rXDF_j2BrOXAdjqECJkywF7huaMUX0HIqmkh7ZaRy1EiX54n1GiI3G7AbAppXDmwtmZZfOaGFspojFoIdgI6dzZIOIXRtxIxYmlw53RSBQA" 
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
        </div>
        <div>
          <p className="text-lg font-bold text-on-surface">Kavin Bavisi</p>
          <p className="text-xs text-on-surface-variant font-mono uppercase tracking-widest">Senior Systems Engineer</p>
        </div>
      </div>
      <div className="space-y-4">
        {[
          { icon: Database, label: 'Database Configuration', desc: 'Manage InfluxDB and MQTT connections' },
          { icon: Wifi, label: 'Network Protocols', desc: 'WiFi, Ethernet, and Handshake settings' },
          { icon: Bell, label: 'Notification Rules', desc: 'Thresholds and alert broadcast settings' },
          { icon: Lock, label: 'Security & Access', desc: 'RBAC and global lock controls' }
        ].map((item, i) => (
          <button key={i} className="w-full flex items-center gap-4 p-4 bg-surface-container-low border border-outline-variant/10 rounded-lg hover:bg-surface-container transition-colors text-left">
            <div className="p-2 bg-primary/10 rounded">
              <item.icon className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-bold text-on-surface uppercase tracking-wide">{item.label}</p>
              <p className="text-[10px] text-on-surface-variant">{item.desc}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  </div>
);
