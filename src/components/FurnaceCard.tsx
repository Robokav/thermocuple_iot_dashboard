import React, { useState, useCallback, useMemo } from 'react';
import { Flame, Settings2, Save, RotateCcw, Target, Edit2, Check, X, LineChart as LineChartIcon } from 'lucide-react';
import { FurnaceData, SensorCalibration } from '../types';
import { StatusBadge } from './StatusBadge';
import { useMqtt } from '../contexts/MqttContext';
import { motion, AnimatePresence } from 'motion/react';
import { HistoryChart } from './HistoryChart';

interface TempToggleProps {
  label: string;
  value: number | null;
  active: boolean;
  onToggle: () => void;
  onNameChange: (newName: string) => void;
}

const TempToggle = React.memo(({ label, value, active, onToggle, onNameChange }: TempToggleProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(label);

  const handleSave = (e?: React.MouseEvent | React.KeyboardEvent) => {
    e?.stopPropagation();
    onNameChange(editName);
    setIsEditing(false);
  };

  return (
    <div className={`glass-panel px-3 py-3 rounded-lg flex items-center justify-between transition-all ${!active ? 'opacity-60 grayscale' : 'border-primary/20'}`}>
      <div className="text-left flex-1 mr-2">
        <div className="flex items-center gap-1 group">
          {isEditing ? (
            <div className="flex items-center gap-1 w-full" onClick={e => e.stopPropagation()}>
              <input 
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSave(e)}
                className="bg-surface-container-lowest border border-primary/40 rounded px-1 py-0.5 text-[9px] font-bold text-primary outline-none w-full uppercase"
                autoFocus
              />
              <button onClick={handleSave} className="p-0.5 text-emerald-400 hover:bg-emerald-400/10 rounded"><Check className="w-3 h-3" /></button>
              <button onClick={(e) => { e.stopPropagation(); setIsEditing(false); setEditName(label); }} className="p-0.5 text-error hover:bg-error/10 rounded"><X className="w-3 h-3" /></button>
            </div>
          ) : (
            <>
              <p className="text-[9px] font-bold text-on-surface-variant uppercase tracking-widest truncate max-w-[80px]" title={label}>{label}</p>
              <button onClick={(e) => { e.stopPropagation(); setIsEditing(true); }} className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 text-on-surface-variant hover:text-primary">
                <Edit2 className="w-2.5 h-2.5" />
              </button>
            </>
          )}
        </div>
        <p className={`font-mono text-xs ${!active ? 'text-on-surface-variant italic' : 'text-primary font-bold'}`}>
          {value !== null ? `${value.toFixed(1)}°C` : 'OFFLINE'}
        </p>
      </div>
      <button onClick={onToggle} className={`w-8 h-4 rounded-full relative transition-colors flex-shrink-0 ${active ? 'bg-primary/40' : 'bg-surface-variant'}`}>
        <span className={`absolute top-0.5 w-3 h-3 rounded-full shadow-sm transition-all ${active ? 'right-0.5 bg-primary' : 'left-0.5 bg-outline'}`}></span>
      </button>
    </div>
  );
});

interface FurnaceCardProps {
  furnace: FurnaceData;
}

export const FurnaceCard: React.FC<FurnaceCardProps> = ({ furnace }) => {
  const { toggleSensor, calibrateSensor, updateFriendlyName, updateSensorName } = useMqtt();
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState(furnace.name);
  const [selectedSensor, setSelectedSensor] = useState(0);

  // Calibration state
  const [calib, setCalib] = useState<SensorCalibration>(furnace.calibrations[0]);

  const handleToggle = useCallback((idx: number) => {
    toggleSensor(furnace.chipId, idx, !furnace.enabledSensors[idx]);
  }, [furnace.chipId, furnace.enabledSensors, toggleSensor]);

  const handleSaveName = () => {
    updateFriendlyName(furnace.chipId, newName);
    setIsEditingName(false);
  };

  const calculateCalibration = useCallback(() => {
    const scale = (calib.targetHigh - calib.targetLow) / (calib.rawHigh - calib.rawLow);
    const offset = calib.targetLow - (calib.rawLow * scale);
    
    calibrateSensor(furnace.chipId, selectedSensor, offset, scale);
    
    // Update local state for visual feedback
    setCalib(prev => ({ ...prev, scale, offset }));
  }, [calib, furnace.chipId, selectedSensor, calibrateSensor]);

  const captureRaw = (type: 'low' | 'high') => {
    const rawVal = Object.values(furnace.rawTemps)[selectedSensor];
    setCalib(prev => ({
      ...prev,
      [type === 'low' ? 'rawLow' : 'rawHigh']: rawVal
    }));
  };

  const isLive = useMemo(() => {
    return Date.now() - furnace.lastSeen < 5000;
  }, [furnace.lastSeen]);

  return (
    <div className="bg-surface-container-low rounded-xl border border-outline-variant/20 overflow-hidden shadow-xl transition-all hover:border-primary/30">
      <div className="bg-surface-container-high px-4 py-3 flex items-center justify-between border-b border-outline-variant/10">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Flame className={`${isLive ? 'text-primary' : 'text-on-surface-variant'} w-5 h-5`} />
            {isLive && (
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-primary rounded-full animate-ping"></span>
            )}
          </div>
          
          {isEditingName ? (
            <div className="flex items-center gap-1">
              <input 
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="bg-surface-container-lowest border border-primary/40 rounded px-2 py-0.5 text-xs font-bold text-primary outline-none"
                autoFocus
              />
              <button onClick={handleSaveName} className="p-1 text-emerald-400 hover:bg-emerald-400/10 rounded"><Check className="w-3 h-3" /></button>
              <button onClick={() => setIsEditingName(false)} className="p-1 text-error hover:bg-error/10 rounded"><X className="w-3 h-3" /></button>
            </div>
          ) : (
            <div className="flex items-center gap-2 group">
              <h4 className="font-headline font-bold text-on-surface uppercase tracking-wide text-xs">
                {furnace.name} <span className="text-[9px] text-on-surface-variant font-mono opacity-60 ml-1">ID: {furnace.chipId.slice(-6)}</span>
              </h4>
              <button onClick={() => setIsEditingName(true)} className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-on-surface-variant hover:text-primary">
                <Edit2 className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
        <StatusBadge status={furnace.status} />
      </div>

      <div className="p-4 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          {(furnace.sensorNames || ['T1', 'T2', 'T3', 'T4']).map((label, i) => (
            <TempToggle 
              key={i}
              label={label} 
              value={Object.values(furnace.temps)[i]} 
              active={furnace.enabledSensors[i]}
              onToggle={() => handleToggle(i)}
              onNameChange={(newName) => updateSensorName(furnace.chipId, i, newName)}
            />
          ))}
        </div>

        <div className="flex gap-2">
          <button 
            onClick={() => { setIsHistoryOpen(!isHistoryOpen); setIsWizardOpen(false); }}
            className={`flex-1 py-2.5 flex items-center justify-center gap-2 font-bold font-body text-[10px] uppercase tracking-widest rounded transition-all ${
              isHistoryOpen ? 'bg-primary text-on-primary' : 'bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20'
            }`}
          >
            <LineChartIcon className="w-4 h-4" />
            {isHistoryOpen ? 'Close History' : 'View History'}
          </button>
          
          <button 
            onClick={() => { setIsWizardOpen(!isWizardOpen); setIsHistoryOpen(false); }}
            className={`flex-1 py-2.5 flex items-center justify-center gap-2 font-bold font-body text-[10px] uppercase tracking-widest rounded transition-all ${
              isWizardOpen ? 'bg-primary text-on-primary' : 'bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20'
            }`}
          >
            <Settings2 className="w-4 h-4" />
            {isWizardOpen ? 'Close Wizard' : 'Calibration'}
          </button>
        </div>

        <AnimatePresence mode="wait">
          {isHistoryOpen && (
            <motion.div 
              key="history"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden bg-surface-container-lowest rounded-lg border border-outline-variant/30"
            >
              <div className="p-4">
                <HistoryChart chipId={furnace.chipId} />
              </div>
            </motion.div>
          )}

          {isWizardOpen && (
            <motion.div 
              key="wizard"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden bg-surface-container-lowest rounded-lg border border-outline-variant/30"
            >
              <div className="p-4 space-y-4">
                <div className="flex bg-surface-container-high p-1 rounded-md">
                  {(furnace.sensorNames || ['T1', 'T2', 'T3', 'T4']).map((t, i) => (
                    <button 
                      key={i}
                      onClick={() => setSelectedSensor(i)}
                      className={`flex-1 py-1.5 text-[9px] font-bold uppercase tracking-widest rounded transition-all truncate px-1 ${
                        selectedSensor === i ? 'bg-primary text-on-primary shadow-lg' : 'text-on-surface-variant hover:text-on-surface'
                      }`}
                      title={t}
                    >
                      {t}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-[8px] uppercase font-bold text-on-surface-variant">Target Low (°C)</label>
                      <input 
                        type="number"
                        value={calib.targetLow}
                        onChange={(e) => setCalib(prev => ({ ...prev, targetLow: parseFloat(e.target.value) }))}
                        className="w-full bg-surface-container-low border border-outline-variant/40 rounded px-2 py-2 text-xs font-mono text-primary outline-none focus:border-primary"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[8px] uppercase font-bold text-on-surface-variant">Raw Low (ADC)</label>
                      <div className="flex gap-1">
                        <input 
                          readOnly
                          value={calib.rawLow.toFixed(2)}
                          className="flex-1 bg-surface-container-low border border-outline-variant/40 rounded px-2 py-2 text-xs font-mono text-on-surface-variant outline-none"
                        />
                        <button onClick={() => captureRaw('low')} className="px-2 bg-primary/10 text-primary rounded border border-primary/20 hover:bg-primary/20"><Target className="w-3 h-3" /></button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-[8px] uppercase font-bold text-on-surface-variant">Target High (°C)</label>
                      <input 
                        type="number"
                        value={calib.targetHigh}
                        onChange={(e) => setCalib(prev => ({ ...prev, targetHigh: parseFloat(e.target.value) }))}
                        className="w-full bg-surface-container-low border border-outline-variant/40 rounded px-2 py-2 text-xs font-mono text-primary outline-none focus:border-primary"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[8px] uppercase font-bold text-on-surface-variant">Raw High (ADC)</label>
                      <div className="flex gap-1">
                        <input 
                          readOnly
                          value={calib.rawHigh.toFixed(2)}
                          className="flex-1 bg-surface-container-low border border-outline-variant/40 rounded px-2 py-2 text-xs font-mono text-on-surface-variant outline-none"
                        />
                        <button onClick={() => captureRaw('high')} className="px-2 bg-primary/10 text-primary rounded border border-primary/20 hover:bg-primary/20"><Target className="w-3 h-3" /></button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-outline-variant/10">
                  <div className="flex flex-col">
                    <span className="text-[8px] uppercase text-on-surface-variant font-bold">Calculated Scale</span>
                    <span className="text-xs font-mono text-tertiary">x{calib.scale.toFixed(4)}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[8px] uppercase text-on-surface-variant font-bold">Calculated Offset</span>
                    <span className="text-xs font-mono text-tertiary">{calib.offset.toFixed(2)}°C</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button 
                    onClick={calculateCalibration}
                    className="flex-1 flex items-center justify-center gap-2 bg-emerald-500 text-on-primary py-2.5 rounded text-[10px] font-bold uppercase tracking-widest active:scale-[0.98] transition-all shadow-lg shadow-emerald-500/20"
                  >
                    <Save className="w-4 h-4" /> Apply Calibration
                  </button>
                  <button className="px-4 bg-surface-container-high text-on-surface-variant rounded border border-outline-variant/30 hover:bg-surface-container-highest transition-all">
                    <RotateCcw className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
