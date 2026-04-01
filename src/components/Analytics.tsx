import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Layers, 
  TrendingUp, 
  Download, 
  Trash2, 
  UploadCloud, 
  Target, 
  History, 
  Lock, 
  Database,
  Calendar,
  Clock as ClockIcon,
  FileSpreadsheet,
  Activity,
  X,
  RefreshCw,
  CheckSquare,
  Square
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  ChartOptions,
  ChartData
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import Papa from 'papaparse';
import { useMqtt } from '../contexts/MqttContext';
import { FurnaceData } from '../types';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export const Analytics: React.FC = () => {
  const { furnaces, telemetryHistory } = useMqtt();
  const [view, setView] = useState<'live' | 'historical'>('live');
  const [selectedSensor, setSelectedSensor] = useState<number>(0); // 0=T1, 1=T2, etc.
  const [isOverlayActive, setIsOverlayActive] = useState(false);
  const [exportSensors, setExportSensors] = useState<number[]>([0]);
  const [csvData, setCsvData] = useState<any[]>([]);
  const [hoverInfo, setHoverInfo] = useState<{ x: string, y: number } | null>(null);
  
  const furnaceList = Object.values(furnaces) as FurnaceData[];
  const activeFurnace = furnaceList[0]; // For demo, use first furnace

  const sensorNames = activeFurnace?.sensorNames || ['T1_CORE', 'T2_UPPER', 'T3_LOWER', 'T4_EXHAUST'];

  const [historicalFields, setHistoricalFields] = useState<string[]>([sensorNames[0], sensorNames[1]]);
  const [historicalSensors, setHistoricalSensors] = useState<string[]>([sensorNames[0], sensorNames[1]]);

  // Update state when sensorNames change
  useEffect(() => {
    if (activeFurnace?.sensorNames) {
      setHistoricalFields(prev => prev.map(f => activeFurnace.sensorNames.includes(f) ? f : activeFurnace.sensorNames[0]));
      setHistoricalSensors(prev => prev.map(f => activeFurnace.sensorNames.includes(f) ? f : activeFurnace.sensorNames[0]));
    }
  }, [activeFurnace?.sensorNames]);

  const mockTableData = [
    { timestamp: '2023-11-24T14:20:00Z', sensorId: sensorNames[0], value: 1142.5, color: 'text-[#7BD0FF]' },
    { timestamp: '2023-11-24T14:19:00Z', sensorId: sensorNames[1], value: 1141.8, color: 'text-[#34D399]' },
    { timestamp: '2023-11-24T14:18:00Z', sensorId: sensorNames[0], value: 982.4, color: 'text-[#7BD0FF]' },
    { timestamp: '2023-11-24T14:17:00Z', sensorId: sensorNames[1], value: 1140.2, color: 'text-[#34D399]' },
    { timestamp: '2023-11-24T14:16:00Z', sensorId: sensorNames[3], value: 981.1, color: 'text-[#F87171]' },
  ];

  const historicalChartData: ChartData<'line'> = {
    labels: ['08:00', '12:00', '16:00', '20:00', '00:00', '04:00', 'NOW'],
    datasets: [
      {
        label: sensorNames[0],
        data: [1000, 1100, 1150, 1120, 1080, 1050, 1142.5],
        borderColor: '#7BD0FF',
        backgroundColor: 'transparent',
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.4,
      },
      {
        label: sensorNames[1],
        data: [900, 950, 980, 970, 950, 940, 982.4],
        borderColor: '#34D399',
        borderDash: [5, 5],
        backgroundColor: 'transparent',
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.4,
      }
    ]
  };

  const chartRef = useRef<any>(null);

  const liveHistory = useMemo(() => {
    if (!activeFurnace || !telemetryHistory[activeFurnace.chipId]) return [];
    return telemetryHistory[activeFurnace.chipId];
  }, [activeFurnace, telemetryHistory]);

  const labels = useMemo(() => {
    return liveHistory.map(d => new Date(d.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
  }, [liveHistory]);

  const chartData: ChartData<'line'> = useMemo(() => {
    const datasets: any[] = [];

    if (isOverlayActive) {
      // Show all 4 sensors
      sensorNames.forEach((label, i) => {
        datasets.push({
          label,
          data: liveHistory.map(d => d.temps[i]),
          borderColor: i === 0 ? '#7BD0FF' : i === 1 ? '#34D399' : i === 2 ? '#FBBF24' : '#A78BFA',
          backgroundColor: 'transparent',
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.4,
        });
      });
    } else {
      datasets.push({
        label: sensorNames[selectedSensor],
        data: liveHistory.map(d => d.temps[selectedSensor]),
        borderColor: '#7BD0FF',
        backgroundColor: (context: any) => {
          const ctx = context.chart.ctx;
          const gradient = ctx.createLinearGradient(0, 0, 0, 400);
          gradient.addColorStop(0, 'rgba(123, 208, 255, 0.2)');
          gradient.addColorStop(1, 'rgba(123, 208, 255, 0)');
          return gradient;
        },
        fill: true,
        borderWidth: 3,
        pointRadius: 0,
        tension: 0.4,
      });
    }

    // Add CSV Overlay if exists
    if (csvData.length > 0) {
      datasets.push({
        label: 'CSV Reference',
        data: csvData.map(d => d.temp),
        borderColor: '#94A3B8',
        borderDash: [5, 5],
        borderWidth: 1,
        pointRadius: 0,
        tension: 0,
      });
    }

    return { labels, datasets };
  }, [liveHistory, labels, isOverlayActive, selectedSensor, csvData]);

  const chartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        enabled: false,
        external: (context) => {
          const { tooltip } = context;
          if (tooltip.opacity === 0) {
            setHoverInfo(null);
            return;
          }
          setHoverInfo({
            x: tooltip.title[0],
            y: parseFloat(tooltip.body[0].lines[0].split(': ')[1])
          });
        }
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: '#94A3B8', font: { size: 8, family: 'JetBrains Mono' } }
      },
      y: {
        grid: { color: 'rgba(148, 163, 184, 0.1)' },
        ticks: { color: '#94A3B8', font: { size: 8, family: 'JetBrains Mono' } }
      }
    },
    interaction: {
      intersect: false,
      mode: 'index',
    },
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      Papa.parse(file, {
        header: true,
        dynamicTyping: true,
        complete: (results) => {
          setCsvData(results.data.filter((d: any) => d.temp !== undefined));
        }
      });
    }
  };

  const toggleExportSensor = (idx: number) => {
    setExportSensors(prev => 
      prev.includes(idx) ? prev.filter(s => s !== idx) : [...prev, idx]
    );
  };

  return (
    <div className="space-y-8 animate-in zoom-in-95 duration-500">
      {/* Historical Toggle */}
      <section className="flex bg-surface-container-low p-1 rounded-lg border border-outline-variant/20 max-w-md mx-auto">
        <button 
          onClick={() => setView('live')}
          className={`flex-1 py-2 text-xs font-bold uppercase tracking-widest rounded-md transition-all ${view === 'live' ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20' : 'text-on-surface-variant opacity-60'}`}
        >
          Live (MQTT)
        </button>
        <button 
          onClick={() => setView('historical')}
          className={`flex-1 py-2 text-xs font-bold uppercase tracking-widest rounded-md transition-all ${view === 'historical' ? 'text-primary bg-primary/10 border border-primary/20' : 'text-on-surface-variant opacity-60'}`}
        >
          Historical (InfluxDB)
        </button>
      </section>

      <AnimatePresence mode="wait">
        {view === 'live' ? (
          <motion.div 
            key="live-view"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-8"
          >
            {/* Chart Section */}
            <section className="bg-surface-container-high rounded-xl p-5 relative overflow-hidden data-grid-dots border border-outline-variant/10 shadow-2xl">
              <div className="flex gap-2 mb-6 overflow-x-auto pb-1 no-scrollbar">
                {sensorNames.map((t, i) => (
                  <button 
                    key={i} 
                    onClick={() => setSelectedSensor(i)}
                    className={`flex-none px-4 py-1.5 text-[10px] font-bold rounded-full border transition-all truncate max-w-[120px] ${selectedSensor === i ? 'bg-primary text-on-primary border-primary/20 shadow-lg shadow-primary/20' : 'bg-surface-container-highest text-on-surface-variant border-outline-variant/30 hover:border-primary/50'}`}
                    title={t}
                  >
                    {t}
                  </button>
                ))}
                <button 
                  onClick={() => setIsOverlayActive(!isOverlayActive)}
                  className={`flex-none px-4 py-1.5 text-[10px] font-bold rounded-full flex items-center gap-2 transition-all border ${isOverlayActive ? 'bg-tertiary text-on-tertiary border-tertiary/20' : 'bg-tertiary-container/20 text-tertiary border-tertiary/20'}`}
                >
                  <Layers className="w-3 h-3" /> {isOverlayActive ? 'OVERLAY ON' : 'OVERLAY'}
                </button>
              </div>

              <div className="flex justify-between items-end mb-8">
                <div>
                  <h2 className="font-headline text-primary text-2xl font-bold uppercase tracking-tighter">Thermal Kinetics</h2>
                  <p className="text-[10px] font-mono text-on-surface-variant/80 uppercase tracking-widest">
                    {isOverlayActive ? 'MULTI-NODE OVERLAY' : `NODE_${sensorNames[selectedSensor]}_ACTIVE`} // v4.1.0
                  </p>
                </div>
                <div className="text-right">
                  <span className="font-mono text-3xl font-bold text-tertiary">
                    {liveHistory.length > 0 ? (liveHistory[liveHistory.length - 1].temps[selectedSensor]?.toFixed(1) || '--') : '--'}°C
                  </span>
                  <div className="flex items-center justify-end text-[10px] text-tertiary mt-1">
                    <TrendingUp className="w-3 h-3 mr-1" /> +2.4%
                  </div>
                </div>
              </div>

              <div className="h-64 w-full relative group">
                {/* Custom Hover Crosshair UI */}
                {hoverInfo && (
                  <div className="absolute top-0 left-0 w-full h-full pointer-events-none z-20">
                    <div className="absolute top-0 bottom-0 w-[1px] bg-primary/30 border-l border-dashed border-primary/50" style={{ left: `${chartRef.current?.tooltip?.caretX}px` }}></div>
                    <div className="absolute left-0 right-0 h-[1px] bg-tertiary/30 border-t border-dashed border-tertiary/50" style={{ top: `${chartRef.current?.tooltip?.caretY}px` }}></div>
                    <div 
                      className="absolute bg-surface-container-highest border border-primary/30 px-3 py-1.5 rounded shadow-2xl text-[10px] font-mono z-30"
                      style={{ 
                        left: `${chartRef.current?.tooltip?.caretX + 10}px`, 
                        top: `${chartRef.current?.tooltip?.caretY - 40}px` 
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-primary font-bold">{hoverInfo.y.toFixed(2)}°C</span>
                        <span className="text-on-surface-variant opacity-40">|</span>
                        <span className="text-on-surface-variant">{hoverInfo.x}</span>
                      </div>
                    </div>
                  </div>
                )}
                
                <Line 
                  ref={chartRef}
                  data={chartData} 
                  options={chartOptions} 
                />
              </div>

              <div className="flex justify-between mt-6 pt-4 border-t border-outline-variant/10 text-[9px] font-mono text-on-surface-variant uppercase tracking-tighter">
                <div className="flex gap-4">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-primary"></div>
                    <span>Live Stream</span>
                  </div>
                  {csvData.length > 0 && (
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full bg-slate-400"></div>
                      <span>CSV Reference</span>
                    </div>
                  )}
                </div>
                <span className="text-primary animate-pulse flex items-center gap-1">
                  <Activity className="w-3 h-3" /> Real-time Telemetry
                </span>
              </div>
            </section>

            {/* Data Export */}
            <section className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-xs font-bold font-headline uppercase tracking-widest text-on-surface-variant">Data Export & Logs</h3>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
                  <span className="text-[9px] font-mono text-emerald-400">DB_CONNECTED</span>
                </div>
              </div>
              
              <div className="bg-surface-container rounded-xl p-5 border border-outline-variant/10 space-y-6 shadow-lg">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <label className="flex items-center gap-2 text-[9px] uppercase text-on-surface-variant font-bold">
                      <Calendar className="w-3 h-3" /> Date Range
                    </label>
                    <div className="flex gap-2">
                      <input className="flex-1 bg-surface-container-lowest border border-outline-variant/40 rounded px-3 py-2 text-xs font-mono text-primary focus:border-primary outline-none transition-all" type="date" defaultValue="2023-11-20" />
                      <input className="flex-1 bg-surface-container-lowest border border-outline-variant/40 rounded px-3 py-2 text-xs font-mono text-primary focus:border-primary outline-none transition-all" type="date" defaultValue="2023-11-21" />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <label className="flex items-center gap-2 text-[9px] uppercase text-on-surface-variant font-bold">
                      <ClockIcon className="w-3 h-3" /> Time Range
                    </label>
                    <div className="flex gap-2">
                      <input className="flex-1 bg-surface-container-lowest border border-outline-variant/40 rounded px-3 py-2 text-xs font-mono text-primary focus:border-primary outline-none transition-all" type="time" defaultValue="08:00" />
                      <input className="flex-1 bg-surface-container-lowest border border-outline-variant/40 rounded px-3 py-2 text-xs font-mono text-primary focus:border-primary outline-none transition-all" type="time" defaultValue="17:00" />
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[9px] uppercase text-on-surface-variant font-bold">Select Thermocouples</label>
                  <div className="flex flex-wrap gap-2">
                    {sensorNames.map((t, i) => (
                      <button 
                        key={i}
                        onClick={() => toggleExportSensor(i)}
                        className={`px-5 py-2 rounded text-[10px] font-bold uppercase tracking-widest border transition-all truncate max-w-[100px] ${exportSensors.includes(i) ? 'bg-primary/10 text-primary border-primary/30 shadow-lg shadow-primary/10' : 'bg-surface-container-lowest text-on-surface-variant border-outline-variant/40 opacity-60'}`}
                        title={t}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button className="flex-[2] flex items-center justify-center gap-2 bg-primary text-on-primary py-3 rounded text-[10px] font-bold uppercase tracking-widest active:scale-[0.98] transition-all shadow-lg shadow-primary/20">
                    <Download className="w-4 h-4" /> Download CSV
                  </button>
                  <button className="flex-1 flex items-center justify-center gap-2 bg-error/10 text-error border border-error/20 py-3 rounded text-[10px] font-bold uppercase tracking-widest hover:bg-error/20 transition-all">
                    <Trash2 className="w-4 h-4" /> Purge
                  </button>
                </div>
              </div>
            </section>

            {/* Historical Comparison / CSV Overlay */}
            <section className="bg-surface-container border-2 border-dashed border-outline-variant/30 rounded-xl p-8 flex flex-col items-center justify-center space-y-4 group hover:border-primary/40 transition-all">
              <input 
                type="file" 
                id="csv-upload" 
                className="hidden" 
                accept=".csv"
                onChange={handleFileUpload}
              />
              <label 
                htmlFor="csv-upload"
                className="cursor-pointer flex flex-col items-center space-y-4"
              >
                <div className="w-16 h-16 rounded-full bg-surface-container-highest flex items-center justify-center border border-outline-variant/40 shadow-inner group-hover:bg-primary/10 transition-all">
                  <UploadCloud className="text-primary w-8 h-8" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-bold font-headline text-on-surface uppercase tracking-widest">Historical Overlay</p>
                  <p className="text-[10px] text-on-surface-variant mt-1 uppercase tracking-tighter">Upload reference CSV to compare with live data</p>
                </div>
                <div className="px-6 py-2 bg-surface-container-highest text-primary text-[10px] font-bold uppercase rounded border border-primary/20 hover:bg-primary/10 transition-all flex items-center gap-2">
                  <FileSpreadsheet className="w-3 h-3" /> {csvData.length > 0 ? 'Change Reference' : 'Select Reference'}
                </div>
              </label>
              
              {csvData.length > 0 && (
                <div className="flex items-center gap-3 pt-2">
                  <span className="text-[9px] font-mono text-emerald-400 uppercase tracking-widest">File Loaded: {csvData.length} Points</span>
                  <button onClick={() => setCsvData([])} className="text-error hover:underline text-[9px] font-bold uppercase">Remove</button>
                </div>
              )}
            </section>
          </motion.div>
        ) : (
          <motion.div 
            key="historical-view"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="space-y-8"
          >
            {/* Top Chart */}
            <section className="bg-surface-container-high rounded-xl p-6 border border-outline-variant/10 shadow-2xl">
              <div className="mb-6">
                <h2 className="font-headline text-on-surface text-xl font-bold uppercase tracking-widest">Furnace Thermocouple Analysis</h2>
                <p className="text-[10px] font-mono text-on-surface-variant/80 uppercase tracking-widest mt-1">
                  Thermocouple Comparison • 24h Window • Resolution: 1m
                </p>
              </div>
              
              {/* Legend Checkboxes */}
              <div className="flex flex-wrap gap-6 mb-8 bg-surface-container-lowest/50 p-4 rounded-lg border border-outline-variant/20 inline-flex">
                {[
                  { id: sensorNames[0], color: 'bg-[#7BD0FF]' },
                  { id: sensorNames[1], color: 'bg-[#34D399]' },
                  { id: sensorNames[2], color: 'bg-[#FBBF24]' },
                  { id: sensorNames[3], color: 'bg-[#F87171]' }
                ].map((sensor) => (
                  <label key={sensor.id} className="flex items-center gap-2 cursor-pointer group">
                    <div className="relative flex items-center justify-center">
                      <input 
                        type="checkbox" 
                        className="peer sr-only"
                        checked={historicalSensors.includes(sensor.id)}
                        onChange={() => {
                          setHistoricalSensors(prev => 
                            prev.includes(sensor.id) ? prev.filter(s => s !== sensor.id) : [...prev, sensor.id]
                          );
                        }}
                      />
                      <div className={`w-4 h-4 rounded border transition-all ${historicalSensors.includes(sensor.id) ? 'bg-surface-container-highest border-outline-variant/40' : 'bg-transparent border-outline-variant/40 group-hover:border-primary/50'}`}></div>
                      {historicalSensors.includes(sensor.id) && <CheckSquare className="w-4 h-4 text-on-surface-variant absolute pointer-events-none" />}
                    </div>
                    <div className={`w-2 h-2 rounded-full ${sensor.color}`}></div>
                    <span className="text-[10px] font-mono text-on-surface-variant uppercase tracking-widest">{sensor.id}</span>
                  </label>
                ))}
              </div>

              {/* Chart */}
              <div className="h-64 w-full">
                <Line 
                  data={historicalChartData} 
                  options={{
                    ...chartOptions,
                    scales: {
                      ...chartOptions.scales,
                      x: { ...chartOptions.scales?.x, grid: { display: false }, ticks: { color: '#94A3B8', font: { size: 10, family: 'JetBrains Mono' } } }
                    }
                  }} 
                />
              </div>
            </section>

            {/* Query Builder */}
            <section className="bg-surface-container-high rounded-xl p-6 border border-outline-variant/10 shadow-2xl">
              <h3 className="flex items-center gap-3 font-headline text-lg font-bold text-on-surface uppercase tracking-widest mb-6">
                <Database className="w-5 h-5 text-primary" /> Query Builder
              </h3>
              
              <div className="space-y-6">
                {/* Bucket */}
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-2">Bucket</label>
                  <select className="w-full bg-surface-container-lowest border border-outline-variant/40 rounded p-3 text-sm font-mono text-on-surface focus:border-primary outline-none appearance-none">
                    <option>industrial_telemetry</option>
                  </select>
                </div>
                
                {/* Measurement */}
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-2">Measurement</label>
                  <select className="w-full bg-surface-container-lowest border border-outline-variant/40 rounded p-3 text-sm font-mono text-on-surface focus:border-primary outline-none appearance-none">
                    <option>furnace_metrics</option>
                  </select>
                </div>

                {/* Fields */}
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-2">Fields (Multi-Select)</label>
                  <div className="flex flex-wrap gap-3">
                    {historicalFields.map(field => (
                      <span key={field} className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 text-primary border border-primary/30 rounded text-xs font-mono">
                        {field} 
                        <button onClick={() => setHistoricalFields(prev => prev.filter(f => f !== field))} className="hover:text-on-primary hover:bg-primary rounded-full p-0.5 transition-colors">
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                    <button 
                      onClick={() => {
                        const available = sensorNames.filter(f => !historicalFields.includes(f));
                        if (available.length > 0) {
                          setHistoricalFields(prev => [...prev, available[0]]);
                        }
                      }}
                      className="px-4 py-1.5 bg-surface-container-lowest text-on-surface-variant border border-outline-variant/40 rounded text-xs font-mono hover:bg-surface-container-highest transition-colors flex items-center gap-2"
                    >
                      + Add Field
                    </button>
                  </div>
                </div>

                {/* Time Range */}
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-2">Time Range</label>
                  <select className="w-full bg-surface-container-lowest border border-outline-variant/40 rounded p-3 text-sm font-mono text-on-surface focus:border-primary outline-none appearance-none">
                    <option>Last 7 Days</option>
                    <option>Last 24 Hours</option>
                    <option>Last 1 Hour</option>
                  </select>
                </div>

                {/* Buttons */}
                <div className="pt-4 space-y-3">
                  <button className="w-full py-4 bg-[#7BD0FF] text-surface-container-highest font-bold text-sm uppercase tracking-widest rounded hover:bg-[#7BD0FF]/90 transition-colors shadow-lg shadow-[#7BD0FF]/20">
                    Execute Query
                  </button>
                  <button className="w-full py-4 bg-surface-container-lowest text-error border border-error/20 font-bold text-sm uppercase tracking-widest rounded hover:bg-error/10 transition-colors flex items-center justify-center gap-2">
                    <Trash2 className="w-4 h-4" /> Clear History
                  </button>
                </div>
              </div>
            </section>

            {/* Query Results */}
            <section className="bg-surface-container-high rounded-xl p-6 border border-outline-variant/10 shadow-2xl">
              <div className="flex justify-between items-center mb-6">
                <h3 className="flex items-center gap-3 font-headline text-lg font-bold text-on-surface uppercase tracking-widest">
                  <FileSpreadsheet className="w-5 h-5 text-primary" /> Query Results
                </h3>
                <div className="flex items-center gap-4 text-on-surface-variant">
                  <button className="hover:text-primary transition-colors"><Download className="w-5 h-5" /></button>
                  <button className="hover:text-primary transition-colors"><RefreshCw className="w-5 h-5" /></button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-outline-variant/20 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">
                      <th className="pb-4 font-mono w-1/2">Timestamp</th>
                      <th className="pb-4 font-mono w-1/4">Sensor ID</th>
                      <th className="pb-4 font-mono w-1/4">Value (°C)</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm font-mono">
                    {mockTableData.map((row, i) => (
                      <tr key={i} className="border-b border-outline-variant/10 hover:bg-surface-container-highest/50 transition-colors">
                        <td className="py-4 text-on-surface-variant">
                          {row.timestamp.split('T')[0]}<br/>
                          {row.timestamp.split('T')[1]}
                        </td>
                        <td className={`py-4 font-bold ${row.color}`}>{row.sensorId}</td>
                        <td className="py-4 text-on-surface">{row.value.toFixed(1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {/* Pagination */}
              <div className="flex justify-center items-center gap-2 mt-8">
                <button className="w-8 h-8 flex items-center justify-center rounded border border-outline-variant/20 text-on-surface-variant hover:bg-surface-container-highest text-xs font-mono">1</button>
                <button className="w-8 h-8 flex items-center justify-center rounded bg-[#7BD0FF] text-surface-container-highest font-bold text-xs font-mono shadow-lg shadow-[#7BD0FF]/20">2</button>
                <button className="w-8 h-8 flex items-center justify-center rounded border border-outline-variant/20 text-on-surface-variant hover:bg-surface-container-highest text-xs font-mono">3</button>
                <span className="text-on-surface-variant px-2">...</span>
                <button className="w-8 h-8 flex items-center justify-center rounded border border-outline-variant/20 text-on-surface-variant hover:bg-surface-container-highest text-xs font-mono">14</button>
              </div>
            </section>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
