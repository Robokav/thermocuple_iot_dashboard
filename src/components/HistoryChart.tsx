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

interface HistoryChartProps {
  chipId: string;
}

export const HistoryChart: React.FC<HistoryChartProps> = ({ chipId }) => {
  const data = useLiveQuery(
    async () => {
      try {
        const items = await db.telemetry
          .where('[chipId+timestamp]')
          .between([chipId, Dexie.minKey], [chipId, Dexie.maxKey])
          .reverse()
          .limit(50)
          .toArray();
        return items.reverse();
      } catch (error) {
        console.error("Failed to query telemetry data:", error);
        return [];
      }
    },
    [chipId]
  );

  if (!data || data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-on-surface-variant text-sm font-mono">
        No historical data available.
      </div>
    );
  }

  const formatTime = (timestamp: number) => format(new Date(timestamp), 'HH:mm:ss');

  return (
    <div className="h-64 w-full mt-4">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff15" vertical={false} />
          <XAxis 
            dataKey="timestamp" 
            tickFormatter={formatTime} 
            stroke="#ffffff50" 
            tick={{ fill: '#ffffff50', fontSize: 10, fontFamily: 'monospace' }}
            tickMargin={10}
          />
          <YAxis 
            stroke="#ffffff50" 
            tick={{ fill: '#ffffff50', fontSize: 10, fontFamily: 'monospace' }}
            domain={['auto', 'auto']}
            width={40}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: '#1a1b1e', 
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
              fontFamily: 'monospace',
              fontSize: '12px'
            }}
            labelFormatter={(label) => formatTime(label as number)}
          />
          <Legend wrapperStyle={{ fontSize: '11px', fontFamily: 'monospace', paddingTop: '10px' }} />
          <Line type="monotone" dataKey="t1" name="T1" stroke="#F27D26" strokeWidth={2} dot={false} isAnimationActive={false} />
          <Line type="monotone" dataKey="t2" name="T2" stroke="#4ade80" strokeWidth={2} dot={false} isAnimationActive={false} />
          <Line type="monotone" dataKey="t3" name="T3" stroke="#60a5fa" strokeWidth={2} dot={false} isAnimationActive={false} />
          <Line type="monotone" dataKey="t4" name="T4" stroke="#c084fc" strokeWidth={2} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};
