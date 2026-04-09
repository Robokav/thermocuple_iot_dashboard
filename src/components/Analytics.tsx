import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Layers, TrendingUp, Download, Trash2, UploadCloud, Database,
  Calendar, Clock as ClockIcon, FileSpreadsheet, Activity, X, 
  RefreshCw, RotateCcw, CheckSquare, Square, ChevronLeft, ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement,
  LineElement, Title, Tooltip, Legend, Filler, ChartOptions, ChartData
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import Papa from 'papaparse';
import { useMqtt } from '../contexts/MqttContext';
import { FurnaceData } from '../types';
import { queryHistoricalData, purgeHistoricalData, fetchLiveBackfill} from '../lib/influx';
import { HistoryChart } from './HistoryChart';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

export const Analytics: React.FC = () => {
  const { furnaces, telemetryHistory, clearHistory } = useMqtt();
  const [backfillData, setBackfillData] = useState<any[]>([]);
  useEffect(() => {
    const loadPersistence = async () => {
      // Fetch last 30 minutes of real data from Influx
      const history = await fetchLiveBackfill("-30m"); 
      
      // Convert Influx format to match your FurnaceData type
      const formatted =(history as any[]).map((row: any) => ({
        timestamp: new Date(row._time).getTime(),
        temps: [row.t1, row.t2, row.t3, row.t4]
      }));
      
      setBackfillData(formatted);
    };

    loadPersistence();
  }, []);
  
  // View State
  const [view, setView] = useState<'live' | 'historical'>('live');
  const [isLoading, setIsLoading] = useState(false);
  
  // Live View State
  const [selectedSensor, setSelectedSensor] = useState<number>(0);
  const [isOverlayActive, setIsOverlayActive] = useState(false);
  const [csvOverlay, setCsvOverlay] = useState<any[]>([]);
  const [hoverInfo, setHoverInfo] = useState<{ x: string, y: number } | null>(null);
  
  // Historical/Export State
  const [startDate, setStartDate] = useState('2026-04-01');
  const [endDate, setEndDate] = useState('2026-04-06');
  const [queryResults, setQueryResults] = useState<any[]>([]);
  const [selectedFields, setSelectedFields] = useState<string[]>([]);

  // Helpers
  const activeFurnace = Object.values(furnaces)[0] as FurnaceData;
  const sensorNames = useMemo(() => 
    activeFurnace?.sensorNames || ['T1_CORE', 'T2_UPPER', 'T3_LOWER', 'T4_EXHAUST'], 
  [activeFurnace]);

  const chartRef = useRef<any>(null);

  // Initialize selected fields for historical view
  useEffect(() => {
    if (selectedFields.length === 0) setSelectedFields([sensorNames[0]]);
  }, [sensorNames]);

  const [isExplorerMode, setIsExplorerMode] = useState(false);

  // --- LOGIC: RELATIVE TIME (0s Start) ---
  const liveHistory = useMemo(() => {
if (!activeFurnace) return [];
  
  // 1. Get the volatile MQTT history
  const mqttData = telemetryHistory[activeFurnace.chipId] || [];
  
  // 2. Determine when MQTT data starts so we don't overlap
  const firstMqttTime = mqttData.length > 0 ? mqttData[0].timestamp : Infinity;
  
  // 3. Filter backfill to only include things before MQTT started
  const filteredBackfill = backfillData.filter(d => d.timestamp < firstMqttTime);

  // 4. Merge them!
  const combined = [...filteredBackfill, ...mqttData];
  
  // 5. Keep the window manageable (last 100 points)
  return combined.slice(-100);
}, [activeFurnace, telemetryHistory, backfillData]);
  
  const latestData = liveHistory[liveHistory.length - 1];
  const currentTemp = latestData?.temps[selectedSensor];
  const hasValidData = typeof currentTemp === 'number' && currentTemp !== null;

// Determine status text
const displayValue = hasValidData 
  ? currentTemp.toFixed(2) 
  : backfillData.length > 0 ? "STALE" : "DISCONNECTED";
  const liveLabels = useMemo(() => {
    if (liveHistory.length === 0) return [];
    const startTime = liveHistory[0].timestamp;
    return liveHistory.map(d => `${Math.floor((d.timestamp - startTime) / 1000)}s`);
  }, [liveHistory]);

  // --- LOGIC: CHART DATA MAPPING ---
  const liveChartData: ChartData<'line'> = useMemo(() => {
    const datasets: any[] = [];
    const colors = ['#7BD0FF', '#34D399', '#FBBF24', '#F87171'];

    if (isOverlayActive) {
      sensorNames.forEach((label, i) => {
        datasets.push({
          label,
          data: liveHistory.map(d => d.temps[i]),
          borderColor: colors[i],
          borderWidth: 2, pointRadius: 0, tension: 0.4,
        });
      });
    } else {
      datasets.push({
        label: sensorNames[selectedSensor],
        data: liveHistory.map(d => d.temps[selectedSensor]),
        borderColor: '#7BD0FF',
        backgroundColor: 'rgba(123, 208, 255, 0.05)',
        fill: true, borderWidth: 3, pointRadius: 0, tension: 0.4,
      });
    }

    if (csvOverlay.length > 0) {
      datasets.push({
        label: 'CSV Reference',
        data: csvOverlay.map(d => d.temp),
        borderColor: 'rgba(255,255,255,0.2)',
        borderDash: [5, 5], borderWidth: 1, pointRadius: 0,
      });
    }
    return { labels: liveLabels, datasets };
  }, [liveHistory, liveLabels, isOverlayActive, selectedSensor, csvOverlay, sensorNames]);

  // --- ACTIONS ---
const handleRunQuery = async (e?: React.FormEvent) => {
  if (e) e.preventDefault(); // Prevents the page from refreshing
  
  if (selectedFields.length === 0) {
    alert("Please select at least one sensor.");
    return;
  }

  setIsLoading(true);
  console.log("Querying InfluxDB...", { startDate, endDate, selectedFields });
  // Convert "2026-04-01" to "2026-04-01T00:00:00Z"
  const startISO = new Date(startDate).toISOString();
  const endISO = new Date(endDate).toISOString();

  try {
    // We pass the dates and fields to our library
    const data = await queryHistoricalData(startISO, endISO, selectedFields);
    
    if (!data || data.length === 0) {
      console.warn("No data found for the selected range.");
      alert("No data found for this period.");
    } else {
      console.log(`Success! Fetched ${data.length} rows.`);
      setQueryResults(data);
    }
  } catch (err) {
    console.error("Database Query Error:", err);
    alert("Query failed. Check your InfluxDB connection and Token.");
  } finally {
    setIsLoading(false);
  }
};

const handlePurge = async () => {
  const confirmed = window.confirm("Are you sure? This will permanently delete the data for the selected range.");
  if (!confirmed) return;

  const result = await purgeHistoricalData(startDate, endDate);
  if (result.success) {
    alert("Data Purged Successfully!");
    setQueryResults([]); // Clear the table/graph locally so the user sees it's gone
  } else {
    alert("Purge failed. Check console for details.");
  }
};

const handleExportCSV = () => {
  if (queryResults.length === 0) {
    alert("No data available to export. Please run a query first.");
    return;
  }

  const firstTimestamp = new Date(queryResults[0]._time).getTime();

  const formattedData = queryResults.map(row => {
    const currentTime = new Date(row._time).getTime();
    const elapsedSeconds = Math.floor((currentTime - firstTimestamp) / 1000);

    // Start with the standard columns
    const rowData: any = {
      "Date_Time": new Date(row._time).toLocaleString('en-GB', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false
      }).replace(',', ''),
      "Elapsed_Seconds": elapsedSeconds,
    };

    // 2. DYNAMIC FILTER: Only add columns that are SELECTED in the UI
    selectedFields.forEach(field => {
      // Maps 'T1CORE' -> 't1' to match your InfluxDB keys
      const dataKey = field.toLowerCase().split('_')[0]; 
      // Add to the CSV row object
      rowData[field] = row[dataKey] !== undefined ? row[dataKey] : 0;
    });

    return rowData;
  });

  const csv = Papa.unparse(formattedData);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const fileDate = new Date().toISOString().split('T')[0];
  
  link.href = URL.createObjectURL(blob);
  link.setAttribute('download', `Furnace_Analytical_Report_${fileDate}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
// UPDATED: Defining the chart options using the imported type
const chartOptions: ChartOptions<'line'> = {
  responsive: true,
  maintainAspectRatio: false,
  spanGaps: false, // Set to false to show a "Break" in the line when offlin
  animation: {
    duration: 0 // Crucial for smooth real-time MQTT sliding
  },
  plugins: {
    legend: { display: false },
    tooltip: {
      enabled: false, // We use your custom hoverInfo UI instead
    }
  },
  scales: {
    x: {
      grid: { display: false },
      ticks: { 
        color: '#94A3B8', 
        font: { size: 8, family: 'JetBrains Mono' },
        autoSkip: true,
        maxTicksLimit: 10
      }
    },
    y: {
      beginAtZero: false, // Keeps the graph zoomed in on real temperatures
      suggestedMin: 20,
      grid: { color: 'rgba(255, 255, 255, 0.03)' },
      ticks: { 
        color: '#94A3B8', 
        font: { size: 8, family: 'JetBrains Mono' } 
      }
    }
  }
};
  // --- UI COMPONENTS ---
  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4">
      {/* VIEW TOGGLE */}
      <nav className="flex bg-[#0f172a] p-1 rounded-xl border border-white/5 max-w-[320px] mx-auto shadow-2xl">
        <button
          onClick={() => setIsExplorerMode(false)}
          className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
            !isExplorerMode 
              ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/20' 
              : 'text-slate-400 hover:text-white'
          }`}
        >
          LIVE
        </button>
        <button
          onClick={() => setIsExplorerMode(true)}
          className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
            isExplorerMode 
              ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' 
              : 'text-slate-400 hover:text-white'
          }`}
        >
         Data EXPLORER
        </button>
      </nav>
      

     <AnimatePresence mode="wait">
        {!isExplorerMode ? (
          /* --- LIVE VIEW --- */
          <motion.div key="live" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
            <section className="bg-[#0f172a] rounded-2xl p-8 border border-white/5 relative overflow-hidden shadow-2xl min-h[650px] flex flex-col">
              <div className="flex flex-wrap gap-2 mb-10">
                {sensorNames.map((name, i) => (
                  <button key={i} onClick={() => setSelectedSensor(i)} className={`px-4 py-1.5 text-[9px] font-bold rounded-full border transition-all ${selectedSensor === i ? 'bg-cyan-500 text-[#0f172a] border-cyan-400' : 'bg-white/5 text-white/40 border-white/5 hover:border-white/20'}`}>{name}</button>
                ))}
                <div className="flex-1" />
                <button onClick={() => setIsOverlayActive(!isOverlayActive)} className={`px-4 py-1.5 text-[9px] font-bold rounded-full flex items-center gap-2 border transition-all ${isOverlayActive ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' : 'bg-white/5 text-white/40 border-white/5'}`}><Layers className="w-3 h-3" /> OVERLAY</button>
                <button onClick={() => clearHistory(activeFurnace.chipId)} className="px-4 py-1.5 text-[9px] font-bold rounded-full bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500 hover:text-white transition-all"><RotateCcw className="w-3 h-3 inline mr-1" /> RESET 0s</button>
              </div>

              <div className="flex justify-between items-end mb-12">
                <div>
                  <h2 className="text-3xl font-black text-white tracking-tighter uppercase italic leading-none">Thermal Kinetics</h2>
                  <p className="text-[10px] font-mono text-cyan-500/40 mt-2 uppercase tracking-[0.3em] flex items-center gap-2"><Activity className="w-3 h-3" /> REAL-TIME MQTT STREAM</p>
                </div>
                <div className="text-right">
                  <div className="text-7xl font-black tracking-tighter flex items-baseline">
                    <span className={`uppercase ${!hasValidData ? 'text-red-500/40 text-4xl italic' : 'text-white'}`}>{displayValue}</span>
                    {hasValidData && <span className="text-2xl text-cyan-400/30 ml-2">°C</span>}
                  </div>
                </div>
              </div>

              <div className="flex-1 min-h-[400px] w-full mt-4">
                <Line data={liveChartData} options={{ responsive: true, maintainAspectRatio: false, animation: { duration: 0 }, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false }, ticks: { color: '#ffffff10', font: { size: 8 } } }, y: { grid: { color: '#ffffff05' }, ticks: { color: '#ffffff10', font: { size: 8 } } } } }} />
              </div>
            </section>
          </motion.div>
        ) : (
          /* --- HISTORICAL VIEW --- */
          <motion.div key="historical" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            {/* QUERY BUILDER SECTION */}
            <section className="bg-[#0f172a] rounded-2xl p-8 border border-white/5 shadow-2xl grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-6">
                <h3 className="flex items-center gap-3 font-bold text-white uppercase tracking-widest text-sm"><Database className="text-indigo-400" /> Query Builder</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[9px] font-bold text-white/20 uppercase tracking-widest">Start Time</label>
                    <input type="datetime-local" value={startDate} onClick={(e) => (e.target as any).showPicker()} onChange={e => setStartDate(e.target.value)} className="w-full bg-black/40 border border-white/10 p-3 rounded-xl text-xs text-white outline-none focus:border-indigo-500" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[9px] font-bold text-white/20 uppercase tracking-widest">End Date</label>
                    <input type="datetime-local" value={endDate} onClick={(e) => (e.target as any).showPicker()} onChange={e => setEndDate(e.target.value)} className="w-full bg-black/40 border border-white/10 p-3 rounded-xl text-xs text-white outline-none focus:border-indigo-500" />
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="text-[9px] font-bold text-white/20 uppercase tracking-widest block">Select Sensors</label>
                  <div className="flex flex-wrap gap-2">
                    {sensorNames.map(name => (
                      <button key={name} onClick={() => setSelectedFields(prev => prev.includes(name) ? prev.filter(f => f !== name) : [...prev, name])} className={`px-4 py-2 rounded-lg text-[10px] font-bold border transition-all ${selectedFields.includes(name) ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/40' : 'bg-white/5 text-white/20 border-white/5'}`}>{name}</button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="bg-indigo-500/5 border border-indigo-500/10 p-6 rounded-2xl flex flex-col justify-center space-y-4">
                <button onClick={handleRunQuery} disabled={isLoading} className="w-full bg-[#6366f1] hover:bg-[#5558e6] py-5 rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all shadow-xl shadow-indigo-500/20 disabled:opacity-50">
                  {isLoading ? <div className="flex items-center justify-center gap-2"><RefreshCw className="animate-spin w-4 h-4" /><span>FETCHING...</span></div> : 'Execute Flux Query'}
                </button>
                <div className="flex gap-2">
                  <button onClick={handleExportCSV} className="flex-1 bg-white/5 hover:bg-white/10 py-3 rounded-xl text-[9px] font-bold text-white/60 uppercase border border-white/5"><Download className="w-3 h-3 inline mr-1" /> Export CSV</button>
                  <button onClick={handlePurge} className="flex-1 bg-red-500/10 hover:bg-red-500/20 py-3 rounded-xl text-[9px] font-bold text-red-500 uppercase border border-red-500/10"><Trash2 className="w-3 h-3 inline mr-1" /> Purge</button>
                </div>
              </div>
            </section>

            {/* HISTORICAL TREND CHART */}
            <section className="bg-[#0f172a] rounded-2xl p-8 border border-white/5 shadow-2xl min-h-[400px]">
              <h3 className="flex items-center gap-3 font-bold text-white uppercase tracking-widest text-sm mb-6"><TrendingUp className="text-cyan-400 w-4 h-4" /> Historical Trend</h3>
              {queryResults.length > 0 ? (
                <div className="h-[350px]">
                  <HistoryChart data={queryResults} />
                </div>
              ) : (
                <div className="h-[300px] flex flex-col items-center justify-center text-slate-500 italic opacity-20 border-2 border-dashed border-white/5 rounded-xl">
                  <Database className="w-12 h-12 mb-2" />
                  <p>Execute a Flux Query to visualize historical data</p>
                </div>
              )}
            </section>

            {/* RESULTS TABLE */}
            {queryResults.length > 0 && (
              <section className="bg-[#0f172a] rounded-2xl border border-white/5 overflow-hidden shadow-2xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
<thead className="text-[10px] uppercase tracking-wider text-white/40 border-b border-white/10">
  <tr>
    <th className="p-4 text-left">Time</th>
    {/* Only create headers for selected fields */}
    {selectedFields.map(field => (
      <th key={field} className="p-4 text-left">{field}</th>
    ))}
  </tr>
</thead>
                    <tbody className="text-[11px] font-mono text-white/60">
  {queryResults.slice(0, 50).map((row, i) => (
    <tr key={i} className="border-b border-white/5 hover:bg-white/5 transition-colors">
      <td className="p-4">{new Date(row._time).toLocaleString()}</td>
      
{selectedFields.map(field => {
        const dataKey = field.toLowerCase().split('_')[0]; // Converts T1CORE to t1
        return (
          <td key={field} className="p-4 text-cyan-400">
            {row[dataKey] !== undefined ? row[dataKey].toFixed(2) : '--'}
          </td>
        );
      })}
    </tr>
  ))}
</tbody>
                  </table>
                </div>
              </section>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};