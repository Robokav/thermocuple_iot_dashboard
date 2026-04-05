import React, { useState, useCallback, useMemo } from 'react';
import { Flame, Settings2, Save, RotateCcw, Target, Edit2, Check, X, LineChart as LineChartIcon } from 'lucide-react';
import { FurnaceData, SensorCalibration } from '../types';
import { StatusBadge } from './StatusBadge';
import { useMqtt } from '../contexts/MqttContext';
import { motion, AnimatePresence } from 'framer-motion';
import { HistoryChart } from './HistoryChart';

interface TempToggleProps {
  label: string;
  value: number | null | undefined;
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
const isDisconnected = value === -999;
  // 2. Check if sensor is sending the 'Disabled' code from ESP32
const isManuallyDisabled = value === -888 || !active;
  // 3. Define what counts as a valid temperature reading
const isValidNumber = typeof value === 'number' && value > -500 && value !== -888;
  // --- END OF LOGIC ---
return (
    <div className={`glass-panel px-3 py-3 rounded-lg flex items-center justify-between transition-all duration-500 ${
      // Dim the panel if either Disconnected OR Disabled
      (!active || isDisconnected || value === -888) 
        ? 'opacity-40 grayscale bg-black/20' 
        : 'border-cyan-500/30 bg-cyan-500/5 shadow-[0_0_15px_rgba(34,211,238,0.05)]'
    }`}>
      <div className="text-left flex-1 mr-2">
        <div className="flex items-center gap-1 group">
          {isEditing ? (
            <div className="flex items-center gap-1 w-full" onClick={e => e.stopPropagation()}>
              <input 
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSave(e)}
                className="bg-[#0f172a] border border-cyan-500/40 rounded px-1 py-0.5 text-[9px] font-bold text-cyan-400 outline-none w-full uppercase"
                autoFocus
              />
              <button onClick={handleSave} className="p-0.5 text-emerald-400 hover:bg-emerald-400/10 rounded"><Check className="w-3 h-3" /></button>
            </div>
          ) : (
            <>
              <p className="text-[9px] font-bold text-white/40 uppercase tracking-widest truncate max-w-[80px]">{label}</p>
              <button 
                onClick={(e) => { e.stopPropagation(); setIsEditing(true); }} 
                // Hide edit button if sensor is disconnected
                className={`opacity-0 group-hover:opacity-100 transition-opacity p-0.5 text-white/20 hover:text-cyan-400 ${isDisconnected ? 'hidden' : ''}`}
              >
                <Edit2 className="w-2.5 h-2.5" />
              </button>
            </>
          )}
        </div>
        
        <AnimatePresence mode="wait">
          <motion.p 
            // Key change forces animation when state swaps
            key={isDisconnected ? 'disc' : isManuallyDisabled ? 'off' : 'val'}
            initial={{ opacity: 0, y: 2 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -2 }}
            className={`font-mono text-[10px] mt-0.5 ${(!active || isDisconnected) ? 'text-white/20 italic' : 'text-cyan-400 font-bold'}`}
          >
            {isDisconnected ? (
              <span className="text-red-500/60 font-bold uppercase">Sensor Disconnected</span>
            ) : (isManuallyDisabled) ? (
              'DISABLED'
            ) : isValidNumber ? (
              <span className="text-emerald-400 drop-shadow-[0_0_5px_rgba(52,211,153,0.3)]">
                {value!.toFixed(2)}°C
              </span>
            ) : (
              <span className="animate-pulse text-cyan-500/60">INITIALIZING...</span>
            )}
          </motion.p>
        </AnimatePresence>
      </div>

      <button 
        onClick={onToggle} 
        // 4. PREVENT TOGGLE if hardware is missing (-999)
        disabled={isDisconnected}
        className={`w-8 h-4 rounded-full relative transition-all duration-300 ${
          isDisconnected ? 'bg-red-900/10 cursor-not-allowed' : (active ? 'bg-cyan-500/40' : 'bg-white/10')
        }`}
      >
        <motion.span 
          layout
          className={`absolute top-0.5 w-3 h-3 rounded-full shadow-sm ${
            isDisconnected ? 'left-0.5 bg-red-900/40' : (active ? 'right-0.5 bg-cyan-400' : 'left-0.5 bg-white/40')
          }`}
        />
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

  const [calib, setCalib] = useState<SensorCalibration>(furnace.calibrations[0]);

  const handleToggle = useCallback((idx: number) => {
    toggleSensor(furnace.chipId, idx, !furnace.enabledSensors[idx]);
  }, [furnace.chipId, furnace.enabledSensors, toggleSensor]);

  const handleSaveName = () => {
    updateFriendlyName(furnace.chipId, newName);
    setIsEditingName(false);
  };

  const calculateCalibration = useCallback(() => {
    const rawDiff = (calib.rawHigh - calib.rawLow) || 1;
    const targetDiff = (calib.targetHigh - calib.targetLow);
    const scale = targetDiff / rawDiff;
    const offset = calib.targetLow - (calib.rawLow * scale);
    
    calibrateSensor(furnace.chipId, selectedSensor, offset, scale);
    setCalib(prev => ({ ...prev, scale, offset }));
  }, [calib, furnace.chipId, selectedSensor, calibrateSensor]);

  const captureRaw = (type: 'low' | 'high') => {
    // Matches the Capital R keys from ESP32: { "raw": { "R1": 123.4 } }
    const rawKey = `t${selectedSensor + 1}`; 
    const rawVal = (furnace.rawTemps as any)[rawKey] || 0;
    setCalib(prev => ({
      ...prev,
      [type === 'low' ? 'rawLow' : 'rawHigh']: rawVal
    }));
  };

  const isLive = useMemo(() => Date.now() - furnace.lastSeen < 10000, [furnace.lastSeen]);

  return (
    <div className="bg-[#0f172a] rounded-xl border border-white/5 overflow-hidden shadow-2xl transition-all hover:border-cyan-500/20">
      <div className="bg-white/5 px-4 py-3 flex items-center justify-between border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Flame className={`${isLive ? 'text-cyan-400' : 'text-white/20'} w-5 h-5 transition-colors duration-500`} />
            {isLive && <span className="absolute -top-1 -right-1 w-2 h-2 bg-cyan-500 rounded-full animate-ping"></span>}
          </div>
          
          {isEditingName ? (
            <div className="flex items-center gap-1">
              <input 
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="bg-black/40 border border-cyan-500/40 rounded px-2 py-0.5 text-xs font-bold text-cyan-400 outline-none"
                autoFocus
              />
              <button onClick={handleSaveName} className="p-1 text-emerald-400"><Check className="w-3 h-3" /></button>
            </div>
          ) : (
            <div className="flex items-center gap-2 group">
              <h4 className="font-bold text-white uppercase tracking-wider text-[11px]">
                {furnace.name} <span className="text-[9px] text-white/20 font-mono ml-1">ID: {furnace.chipId.slice(-6)}</span>
              </h4>
              <button onClick={() => setIsEditingName(true)} className="opacity-0 group-hover:opacity-100 p-1 text-white/20 hover:text-cyan-400 transition-all">
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
              value={(furnace.temps as any)[`t${i+1}`]} 
              active={furnace.enabledSensors[i]}
              onToggle={() => handleToggle(i)}
              onNameChange={(newName) => updateSensorName(furnace.chipId, i, newName)}
            />
          ))}
        </div>

        <div className="flex gap-2">
          <button 
            onClick={() => { setIsHistoryOpen(!isHistoryOpen); setIsWizardOpen(false); }}
            className={`flex-1 py-2.5 flex items-center justify-center gap-2 font-bold text-[9px] uppercase tracking-widest rounded transition-all ${
              isHistoryOpen ? 'bg-cyan-500 text-white' : 'bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 hover:text-white'
            }`}
          >
            <LineChartIcon className="w-3.5 h-3.5" />
            {isHistoryOpen ? 'Hide Graphs' : 'View History'}
          </button>
          
          <button 
            onClick={() => { setIsWizardOpen(!isWizardOpen); setIsHistoryOpen(false); }}
            className={`flex-1 py-2.5 flex items-center justify-center gap-2 font-bold text-[9px] uppercase tracking-widest rounded transition-all ${
              isWizardOpen ? 'bg-cyan-500 text-white' : 'bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 hover:text-white'
            }`}
          >
            <Settings2 className="w-3.5 h-3.5" />
            {isWizardOpen ? 'Exit Setup' : 'Calibration'}
          </button>
        </div>

        <AnimatePresence mode="wait">
          {isHistoryOpen && (
            <motion.div 
              key="history"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden bg-black/20 rounded-lg border border-white/5"
            >
              <div className="p-2"><HistoryChart chipId={furnace.chipId} /></div>
            </motion.div>
          )}

          {isWizardOpen && (
            <motion.div 
              key="wizard"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden bg-black/40 rounded-lg border border-cyan-500/20"
            >
              <div className="p-4 space-y-4">
                <div className="flex bg-white/5 p-1 rounded-md">
                  {(furnace.sensorNames || ['T1', 'T2', 'T3', 'T4']).map((t, i) => (
                    <button 
                      key={i}
                      onClick={() => {
                        setSelectedSensor(i);
                        setCalib(furnace.calibrations[i]);
                      }}
                      className={`flex-1 py-1.5 text-[9px] font-bold uppercase tracking-widest rounded transition-all truncate px-1 ${
                        selectedSensor === i ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/20' : 'text-white/40 hover:text-white'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>

<div className="grid grid-cols-2 gap-4">
  <div className="space-y-3">
    {/* TARGET LOW */}
    <div className="space-y-1">
      <label className="text-[8px] uppercase font-bold text-white/40">Target Low (°C)</label>
      <input 
        type="number"
        value={calib.targetLow}
        onChange={(e) => setCalib(prev => ({ ...prev, targetLow: parseFloat(e.target.value) || 0 }))}
        className="w-full bg-black/40 border border-white/10 rounded px-2 py-2 text-xs font-mono text-cyan-400 outline-none"
      />
    </div>
    
    {/* RAW LOW - NOW EDITABLE */}
    <div className="space-y-1">
      <label className="text-[8px] uppercase font-bold text-white/40">Raw Low (ADC)</label>
      <div className="flex gap-1">
        <input 
          type="number"
          value={calib.rawLow} 
          onChange={(e) => setCalib(prev => ({ ...prev, rawLow: parseFloat(e.target.value) || 0 }))}
          className="flex-1 bg-black/20 border border-white/10 rounded px-2 py-2 text-xs font-mono text-emerald-400 outline-none focus:border-cyan-500/50" 
        />
        <button 
          onClick={() => captureRaw('low')} 
          className="px-2 bg-cyan-500/10 text-cyan-400 rounded border border-cyan-500/20 hover:bg-cyan-500/20"
          title="Capture Live"
        >
          <Target className="w-3 h-3" />
        </button>
      </div>
    </div>
  </div>

  <div className="space-y-3">
    {/* TARGET HIGH */}
    <div className="space-y-1">
      <label className="text-[8px] uppercase font-bold text-white/40">Target High (°C)</label>
      <input 
        type="number"
        value={calib.targetHigh}
        onChange={(e) => setCalib(prev => ({ ...prev, targetHigh: parseFloat(e.target.value) || 0 }))}
        className="w-full bg-black/40 border border-white/10 rounded px-2 py-2 text-xs font-mono text-cyan-400 outline-none"
      />
    </div>

    {/* RAW HIGH - NOW EDITABLE */}
    <div className="space-y-1">
      <label className="text-[8px] uppercase font-bold text-white/40">Raw High (ADC)</label>
      <div className="flex gap-1">
        <input 
          type="number"
          value={calib.rawHigh} 
          onChange={(e) => setCalib(prev => ({ ...prev, rawHigh: parseFloat(e.target.value) || 0 }))}
          className="flex-1 bg-black/20 border border-white/10 rounded px-2 py-2 text-xs font-mono text-emerald-400 outline-none focus:border-cyan-500/50" 
        />
        <button 
          onClick={() => captureRaw('high')} 
          className="px-2 bg-cyan-500/10 text-cyan-400 rounded border border-cyan-500/20 hover:bg-cyan-500/20"
          title="Capture Live"
        >
          <Target className="w-3 h-3" />
        </button>
      </div>
    </div>
  </div>
</div>

             <div className="flex gap-2 pt-2">
  {/* APPLY BUTTON */}
  <button 
    onClick={calculateCalibration}
    className="flex-[2] flex items-center justify-center gap-2 bg-emerald-500 text-white py-2 rounded text-[10px] font-bold uppercase tracking-widest hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/20"
  >
    <Save className="w-3.5 h-3.5" /> Apply Calibration
  </button>

  {/* RESET BUTTON (Scale 1, Offset 0) */}
  <button 
    onClick={() => {
      // 1. Update Local State
      setCalib(prev => ({ ...prev, scale: 1, offset: 0 }));
      // 2. Send Reset Command to ESP32
      calibrateSensor(furnace.chipId, selectedSensor, 0, 1);
    }}
    title="Reset to Raw (Scale: 1, Offset: 0)"
    className="flex-1 flex items-center justify-center gap-2 bg-red-500/10 border border-red-500/20 text-red-500 py-2 rounded text-[10px] font-bold uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all"
  >
    <RotateCcw className="w-3.5 h-3.5" /> Reset
  </button>

  {/* UNDO BUTTON (Back to last saved) */}
  <button 
    onClick={() => setCalib(furnace.calibrations[selectedSensor])}
    className="px-4 bg-white/5 text-white/40 rounded border border-white/10 hover:text-white transition-colors"
    title="Undo Changes"
  >
    <X className="w-3.5 h-3.5" />
  </button>
</div>
{/* RESULTS FOOTER (Moved inside the wizard) */}
                {calib.scale !== 1 && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-4 p-3 rounded bg-emerald-500/10 border border-emerald-500/20 flex justify-around items-center">
                    <div className="text-center">
                      <p className="text-[8px] uppercase font-bold text-emerald-500/60">Scale</p>
                      <p className="text-xs font-mono font-bold text-emerald-400">{calib.scale.toFixed(4)}</p>
                    </div>
                    <div className="w-px h-6 bg-emerald-500/20" />
                    <div className="text-center">
                      <p className="text-[8px] uppercase font-bold text-emerald-500/60">Offset</p>
                      <p className="text-xs font-mono font-bold text-emerald-400">{calib.offset.toFixed(2)}</p>
                    </div>
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        {/* RESULTS FOOTER */}

      </div>
    </div>
  );
};