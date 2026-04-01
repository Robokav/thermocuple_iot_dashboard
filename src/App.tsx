import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  Activity, 
  Bell, 
  Settings, 
  Zap, 
  User, 
  Wifi, 
  Clock, 
  AlertTriangle, 
  RotateCcw, 
  Network, 
  Search,
  Flame,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Info,
  Download,
  Trash2,
  Database,
  Layers,
  TrendingUp,
  UploadCloud,
  Lock,
  History,
  Target
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Dashboard } from './components/Dashboard';
import { Alarms } from './components/Alarms';
import { Analytics } from './components/Analytics';
import { SettingsScreen } from './components/SettingsScreen';

import { MqttProvider } from './contexts/MqttContext';

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'analytics' | 'alarms' | 'settings'>('dashboard');

  return (
    <MqttProvider>
      <div className="min-h-screen bg-background text-on-surface font-body pb-24">
      {/* Top Navigation Bar */}
      <header className="w-full top-0 sticky bg-background border-b border-outline-variant/20 shadow-[0_10px_30px_-10px_rgba(123,208,255,0.1)] flex items-center justify-between px-6 py-4 z-50">
        <div className="flex items-center gap-3">
          <Zap className="text-primary w-6 h-6" />
          <h1 className="text-xl font-black text-primary tracking-tighter font-headline uppercase">KINETIC COMMAND</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-primary-container flex items-center justify-center border border-primary/30 overflow-hidden">
            <User className="text-primary w-4 h-4" />
          </div>
        </div>
      </header>

      <main className="p-4 max-w-7xl mx-auto">
        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && <Dashboard key="dashboard" />}
          {activeTab === 'alarms' && <Alarms key="alarms" />}
          {activeTab === 'analytics' && <Analytics key="analytics" />}
          {activeTab === 'settings' && <SettingsScreen key="settings" />}
        </AnimatePresence>
      </main>

      {/* Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 w-full z-50 flex justify-around items-center h-20 px-4 pb-safe bg-surface-container/80 backdrop-blur-lg border-t border-outline-variant/30 shadow-[0_-10px_30px_-10px_rgba(123,208,255,0.1)]">
        {[
          { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
          { id: 'analytics', icon: Activity, label: 'Analytics' },
          { id: 'alarms', icon: Bell, label: 'Alarms' },
          { id: 'settings', icon: Settings, label: 'Settings' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex flex-col items-center justify-center rounded-lg px-3 py-1 transition-all ${
              activeTab === tab.id 
                ? 'bg-emerald-500/10 text-emerald-400' 
                : 'text-slate-400 opacity-70 hover:text-primary'
            }`}
          >
            <tab.icon className={`w-6 h-6 ${activeTab === tab.id ? 'fill-current' : ''}`} />
            <span className="font-body text-[11px] font-medium tracking-wide uppercase">{tab.label}</span>
          </button>
        ))}
      </nav>
    </div>
    </MqttProvider>
  );
}
