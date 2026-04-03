import React from 'react';
import Dexie from 'dexie';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import { format } from 'date-fns';

// 1. DEFINE THE INTERFACE to fix TypeScript red squiggles
interface TelemetryRow {
  id?: number;
  chipId: string;
  timestamp: number;
  t1: number;
  t2: number;
  t3: number;
  t4: number;
}

interface HistoryChartProps {
  chipId: string;
}

export const HistoryChart: React.FC<HistoryChartProps> = ({ chipId }) => {
  const data = useLiveQuery(
    async () => {
      try {
        // 2. TELL DEXIE what type of data to expect using 'as TelemetryRow[]'
        const items = await db.telemetry
          .where('[chipId+timestamp]')
          .between([chipId, Dexie.minKey], [chipId, Dexie.maxKey])
          .reverse()
          .limit(60) 
          .toArray() as TelemetryRow[];

        // 3. MAP WITH TYPE SAFETY (no more red lines under item.t1)
        return items.reverse().map((item: TelemetryRow) => ({
          ...item,
          // If value is negative (error/disabled), treat as null to break the line
          t1: item.t1 > -500 ? item.t1 : null,
          t2: item.t2 > -500 ? item.t2 : null,
          t3: item.t3 > -500 ? item.t3 : null,
          t4: item.t4 > -500 ? item.t4 : null,
        }));
      } catch (error) {
        console.error("Failed to query telemetry data:", error);
        return [];
      }
    },
    [chipId]
  );

  if (!data || data.length === 0) {
    return (
      <div className="h-64 flex flex-col items-center justify-center bg-black/20 rounded-xl border border-white/5">
        <div className="animate-pulse text-cyan-500/50 text-[10px] font-mono mb-2 uppercase tracking-widest">
          Syncing Data Stream
        </div>
        <div className="text-white/20 text-[9px] font-mono uppercase">
          Waiting for first telemetry packet...
        </div>
      </div>
    );
  }

  const formatTime = (timestamp: number) => format(new Date(timestamp), 'HH:mm:ss');

  return (
    <div className="h-72 w-full mt-4 bg-[#0f172a]/40 p-4 rounded-xl border border-white/5 shadow-2xl">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: -25 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
          
          <XAxis 
            dataKey="timestamp" 
            tickFormatter={formatTime} 
            stroke="#ffffff20" 
            tick={{ fill: '#ffffff30', fontSize: 9, fontFamily: 'monospace' }}
            tickMargin={10}
            minTickGap={40}
          />
          
          <YAxis 
            stroke="#ffffff20" 
            tick={{ fill: '#ffffff30', fontSize: 9, fontFamily: 'monospace' }}
            domain={['auto', 'auto']}
            width={60}
            unit="°"
          />
          
          <Tooltip 
            contentStyle={{ 
              backgroundColor: '#1e293b', 
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px',
              fontFamily: 'monospace',
              fontSize: '11px'
            }}
            labelFormatter={(label) => `TIME: ${formatTime(label as number)}`}
            cursor={{ stroke: '#22d3ee', strokeWidth: 1, strokeDasharray: '4 4' }}
          />
          
          <Legend 
            verticalAlign="top" 
            align="right"
            iconType="circle"
            wrapperStyle={{ fontSize: '9px', fontFamily: 'monospace', paddingBottom: '15px', opacity: 0.7 }} 
          />
          
          {/* SENSOR LINES - connectNulls={false} ensures the line vanishes when sensor is OFF */}
          <Line 
            type="monotone" dataKey="t1" name="CORE" stroke="#f59e0b" 
            strokeWidth={2.5} dot={false} isAnimationActive={false} connectNulls={false}
          />
          <Line 
            type="monotone" dataKey="t2" name="UPPER" stroke="#10b981" 
            strokeWidth={2} dot={false} isAnimationActive={false} connectNulls={false}
          />
          <Line 
            type="monotone" dataKey="t3" name="LOWER" stroke="#3b82f6" 
            strokeWidth={2} dot={false} isAnimationActive={false} connectNulls={false}
          />
          <Line 
            type="monotone" dataKey="t4" name="EXHAUST" stroke="#a855f7" 
            strokeWidth={2} dot={false} isAnimationActive={false} connectNulls={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};