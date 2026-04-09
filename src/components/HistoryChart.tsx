import React, { useMemo } from 'react';
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

// Define what the incoming data looks like
interface HistoryChartProps {
  data: any[]; 
}

export const HistoryChart: React.FC<HistoryChartProps> = ({ data }) => {
  // 1. Format the raw InfluxDB rows into a format Recharts understands
  const chartData = useMemo(() => {
    return data.map(row => ({
      // Convert Influx _time string to a Javascript timestamp
      timestamp: new Date(row._time|| row.time).getTime(),
   // If t1 is 0, make it null so the line just skips it instead of diving to the bottom
    t1: row.t1 === 0 ? null : row.t1,
    t2: row.t2 === 0 ? null : row.t2,
    t3: row.t3 === 0 ? null : row.t3,
    t4: row.t4 === 0 ? null : row.t4
    }));
  }, [data]);

  // 2. If there's no data yet, show a clean message
  if (!data || data.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-slate-500 italic border-2 border-dashed border-white/5 rounded-xl">
        No data available to plot. Run a query above.
      </div>
    );
  }

  return (
    <div className="h-full w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
          
          <XAxis 
            dataKey="timestamp" 
            type="number"
            domain={['dataMin', 'dataMax']}
            tickFormatter={(unix) => format(unix, 'HH:mm')} 
            stroke="#475569"
            fontSize={10}
            minTickGap={30}
          />
          
          <YAxis 
            stroke="#475569" 
            fontSize={10} 
            domain={['auto', 'auto']} 
            tickFormatter={(val) => `${val}°C`}
          />
          
          <Tooltip 
            contentStyle={{ 
              backgroundColor: '#0f172a', 
              border: '1px solid rgba(255,255,255,0.1)', 
              borderRadius: '8px',
              fontSize: '12px'
            }}
            labelFormatter={(unix) => format(unix, 'PPpp')}
            itemStyle={{ padding: '2px 0' }}
          />
          
          <Legend 
            verticalAlign="top" 
            align="right" 
            height={36} 
            iconType="circle"
            wrapperStyle={{ fontSize: '10px', textTransform: 'uppercase' }}
          />
          
          {/* Historical Lines */}
          <Line 
            type="monotone" 
            dataKey="t1" 
            stroke="#22d3ee" 
            dot={false} 
            strokeWidth={2} 
            name="T1 Core" 
            connectNulls 
            animationDuration={500}
          />
          <Line 
            type="monotone" 
            dataKey="t2" 
            stroke="#818cf8" 
            dot={false} 
            strokeWidth={2} 
            name="T2 Upper" 
            connectNulls
            animationDuration={500}
          />
          <Line 
            type="monotone" 
            dataKey="t3" 
            stroke="#FBBF24" 
            dot={false} 
            strokeWidth={2} 
            name="T3 Lower" 
            connectNulls
          />
          <Line 
            type="monotone" 
            dataKey="t4" 
            stroke="#F87171" 
            dot={false} 
            strokeWidth={2} 
            name="T4 Exhaust" 
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};