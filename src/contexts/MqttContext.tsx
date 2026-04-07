import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import mqtt, { MqttClient } from 'mqtt';
import { FurnaceData, ConnectionPipeline } from '../types';
import { db } from '../lib/db';
import { fetchLatestFurnaceData } from '../lib/influx';

interface MqttContextType {
  client: MqttClient | null;
  furnaces: Record<string, FurnaceData>;
  pipeline: ConnectionPipeline;
  telemetryHistory: Record<string, { timestamp: number; temps: (number | null)[] }[]>;
  clearHistory: (chipId: string) => void;
  toggleSensor: (chipId: string, sIdx: number, en: boolean) => void;
  calibrateSensor: (chipId: string, sIdx: number, off: number, scl: number) => void;
  updateFriendlyName: (chipId: string, name: string) => void;
  updateSensorName: (chipId: string, sIdx: number, name: string) => void;
  clearNodes: () => void;
}

const MqttContext = createContext<MqttContextType | undefined>(undefined);


export const MqttProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [client, setClient] = useState<MqttClient | null>(null);
  const [furnaces, setFurnaces] = useState<Record<string, FurnaceData>>({});
  const [telemetryHistory, setTelemetryHistory] = useState<Record<string, any>>({});
  const [pipeline, setPipeline] = useState<ConnectionPipeline>({
    wifi: 'idle', ntp: 'idle', mqtts: 'idle', discovery: 'idle',
  });
  // --- INSERT HERE ---
const historyBuffer = useRef<Record<string, any[]>>({});

  const flushBufferToState = useCallback(() => {
    setTelemetryHistory(prev => {
      let hasUpdates = false;
      const newState = { ...prev };
      
      Object.keys(historyBuffer.current).forEach(chipId => {
        const bufferedData = historyBuffer.current[chipId];
        if (bufferedData && bufferedData.length > 0) {
          const existing = prev[chipId] || [];
          newState[chipId] = [...existing, ...bufferedData].slice(-100);
          historyBuffer.current[chipId] = []; // Clear the buffer
          hasUpdates = true;
        }
      });
      
      return hasUpdates ? newState : prev;
    });
  }, []);
  useEffect(() => {
  const interval = setInterval(flushBufferToState, 1000);
  return () => clearInterval(interval);
}, [flushBufferToState]);
  // --- END INSERT ---
  const clearHistory = useCallback((chipId: string) => {
    setTelemetryHistory(prev => ({
      ...prev,
      [chipId]: [] // Wipes the array for this specific furnace
    }));
  }, []);

  const host = import.meta.env.VITE_EMQX_HOST;
  const user = import.meta.env.VITE_EMQX_USER;
  const pass = import.meta.env.VITE_EMQX_PASS;
  const port = import.meta.env.VITE_EMQX_PORT || 8084;

useEffect(() => {
  const hydrate = async () => {
    try {
      // Use the library we imported
      const history: any = await fetchLatestFurnaceData(); 
      
      if (history && history.length > 0) {
        setFurnaces(prev => {
          const next = { ...prev };
          history.forEach((node: any) => {
            // Only add if it's not already there from a live MQTT message
            if (!next[node.chipId]) {
              next[node.chipId] = {
                id: node.chipId,
                chipId: node.chipId,
                name: `Node ${node.chipId.slice(-4)}`,
                status: 'offline', // It's offline until the first MQTT ping
                lastSeen: Date.now() - 60000,
                temps: { 
                  t1: node.t1 ?? null, 
                  t2: node.t2 ?? null, 
                  t3: node.t3 ?? null, 
                  t4: node.t4 ?? null 
                },
                rawTemps: { 
                  t1: node.r1 ?? 0, 
                  t2: node.r2 ?? 0, 
                  t3: node.r3 ?? 0, 
                  t4: node.r4 ?? 0 
                },
                enabledSensors: [true, true, true, true],
                calibrations: Array(4).fill({ scale: 1, offset: 0 }),
                sensorNames: ['T1_CORE', 'T2_UPPER', 'T3_LOWER', 'T4_EXHAUST'],
              };
            }
          });
          return next;
        });
        // Turn the discovery icon green since we found nodes!
        setPipeline(prev => ({ ...prev, discovery: 'success' }));
      }
    } catch (err) { 
      console.error('Hydration Failed:', err); 
    }
  };
  
  hydrate();
}, []);
  // --- 2. MQTT CONNECTION & HANDLING ---
  useEffect(() => {
    if (!host) return;
    const mqttClient = mqtt.connect(`wss://${host}:${port}/mqtt`, {
      username: user, password: pass,
      clientId: `kinetic_web_${Math.random().toString(16).slice(2, 10)}`,
      connectTimeout: 5000, reconnectPeriod: 5000,
    });

    mqttClient.on('connect', () => {
      setPipeline(prev => ({ ...prev, mqtts: 'success', wifi: 'success' }));
      mqttClient.subscribe(['discovery/nodes', 'furnace/+/telemetry', 'status/+/+']);
    });

    mqttClient.on('message', (topic, message) => {
      const payload = message.toString();
      let data: any;
      
      
      try { data = JSON.parse(message.toString()); } catch (e) { return; }

      // Handle Discovery
      if (topic === 'discovery/nodes') {
        setPipeline(prev => ({ ...prev, discovery: 'success' }));
        const nodes = Array.isArray(data) ? data : [data];
        setFurnaces(prev => {
          const next = { ...prev };
          nodes.forEach((node: any) => {
            if (node?.chipId && !next[node.chipId]) {
              next[node.chipId] = {
                id: node.chipId, chipId: node.chipId,
                name: node.name || `Node ${node.chipId.slice(-4)}`,
                status: 'online', lastSeen: Date.now(),
                temps: { t1: null, t2: null, t3: null, t4: null },
                rawTemps: { t1: 0, t2: 0, t3: 0, t4: 0 },
                enabledSensors: [true, true, true, true],
                calibrations: Array(4).fill({ scale: 1, offset: 0 }),
                sensorNames: ['T1_CORE', 'T2_UPPER', 'T3_LOWER', 'T4_EXHAUST'],
              };
            }
          });
          return next;
        });
      }

      // Handle Telemetry (The Real-time Data)
const telemetryMatch = topic.match(/^furnace\/(.+)\/telemetry$/);

if (telemetryMatch) {
  const topicId = telemetryMatch[1];
  // SAFETY: Use the ID from the JSON if it exists, otherwise use the Topic ID
  const chipId = data.nodeId || topicId;
  const furnace = furnaces[chipId];
  
  // 1. UNLOCK NTP ICON
  // We check data.epoch > 0 to ensure the ESP32 actually has a real time sync
  if (data.epoch && data.epoch > 0) {
    setPipeline(prev => ({ ...prev, ntp: 'success' }));
  }

  setFurnaces(prev => {
    const f = prev[chipId];
    
    
    // IF THE CARD DOESN'T EXIST YET, DON'T DISCARD THE DATA
    // This allows the dashboard to "auto-create" cards if discovery was missed
    if (!f) return prev; 

    return {
      ...prev,
      [chipId]: {
        ...f,
        status: 'online',
        // MULTIPLY BY 1000: ESP32 sends seconds, JS needs milliseconds
        lastSeen: data.epoch ? data.epoch * 1000 : Date.now(),
        
        // OPTIONAL CHAINING (?): Prevents crash if 'data.temps' is missing
        temps: { 
          t1: data.temps?.T1, 
          t2: data.temps?.T2, 
          t3: data.temps?.T3, 
          t4: data.temps?.T4 
        },
        
        rawTemps: { 
          t1: data.raw?.T1, 
          t2: data.raw?.T2, 
          t3: data.raw?.T3, 
          t4: data.raw?.T4 
        }
      }
    };
  });
const newPoint = {
  timestamp: data.epoch ? data.epoch * 1000 : Date.now(),
temps: [
    // Logic: If value is -888, -999, or missing -> set to null. Otherwise, use value.
    (data.temps?.T1 === -888 || data.temps?.T1 === -999 || !data.temps?.T1) ? null : data.temps.T1,
    (data.temps?.T2 === -888 || data.temps?.T2 === -999 || !data.temps?.T2) ? null : data.temps.T2,
    (data.temps?.T3 === -888 || data.temps?.T3 === -999 || !data.temps?.T3) ? null : data.temps.T3,
    (data.temps?.T4 === -888 || data.temps?.T4 === -999 || !data.temps?.T4) ? null : data.temps.T4
  ]

    };
    if (!historyBuffer.current[chipId]) {
      historyBuffer.current[chipId] = [];
    }
    historyBuffer.current[chipId].push(newPoint);
}
});

    setClient(mqttClient);
    return () => { mqttClient.end(); };
  }, [host, user, pass, port]);

  // --- 3. ACTIONS: Toggle & Calibrate ---
  const toggleSensor = useCallback((chipId: string, sIdx: number, en: boolean) => {
    if (!client) return;
    // SEND RAW INDEX (0-3). ESP32 handles the +1 internally now.
    client.publish(`furnace/${chipId}/cmd`, JSON.stringify({ cmd: 'TOGGLE', sIdx, en }));

    setFurnaces(prev => {
      if (!prev[chipId]) return prev;
      const nextEnabled = [...prev[chipId].enabledSensors];
      nextEnabled[sIdx] = en;
      return { ...prev, [chipId]: { ...prev[chipId], enabledSensors: nextEnabled } };
    });
  }, [client]);

  const calibrateSensor = useCallback((chipId: string, sIdx: number, off: number, scl: number) => {
    if (!client) return;
    client.publish(`furnace/${chipId}/cmd`, JSON.stringify({ cmd: 'CALIBRATE', sIdx, off, scl }));
    
    setFurnaces(prev => {
      if (!prev[chipId]) return prev;
      const nextCalib = [...prev[chipId].calibrations];
      nextCalib[sIdx] = { ...nextCalib[sIdx], offset: off, scale: scl };
      return { ...prev, [chipId]: { ...prev[chipId], calibrations: nextCalib } };
    });
  }, [client]);

  const updateFriendlyName = useCallback((chipId: string, name: string) => {
    setFurnaces(prev => prev[chipId] ? { ...prev, [chipId]: { ...prev[chipId], name } } : prev);
  }, []);

  const updateSensorName = useCallback((chipId: string, sIdx: number, name: string) => {
    setFurnaces(prev => {
      if (!prev[chipId]) return prev;
      const nextNames = [...prev[chipId].sensorNames];
      nextNames[sIdx] = name;
      return { ...prev, [chipId]: { ...prev[chipId], sensorNames: nextNames } };
    });
  }, []);

  const clearNodes = useCallback(() => {
    if (client) {
      client.publish('discovery/nodes', '', { retain: true });
      setFurnaces({});
    }
  }, [client]);

  // Offline detection (15-second timeout)
  useEffect(() => {
    const checkOffline = setInterval(() => {
      setFurnaces(prev => {
        const next = { ...prev };
        let changed = false;
        Object.keys(next).forEach(id => {
          if (next[id].status === 'online' && Date.now() - next[id].lastSeen > 15000) {
            next[id] = { ...next[id], status: 'offline' };
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    }, 5000);
    return () => clearInterval(checkOffline);
  }, []);

  const value = useMemo(() => ({
    client, furnaces, pipeline, telemetryHistory, clearHistory, toggleSensor,
    calibrateSensor, updateFriendlyName, updateSensorName, clearNodes,
  }), [client, furnaces, pipeline, telemetryHistory, clearHistory, toggleSensor, calibrateSensor, updateFriendlyName, updateSensorName, clearNodes]);

  return <MqttContext.Provider value={value}>{children}</MqttContext.Provider>;
};

export const useMqtt = () => {
  const context = useContext(MqttContext);
  if (!context) throw new Error('useMqtt must be used within an MqttProvider');
  return context;
};