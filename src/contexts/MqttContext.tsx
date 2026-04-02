import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import mqtt, { MqttClient } from 'mqtt';
import { FurnaceData, ConnectionPipeline } from '../types';
import { db } from '../lib/db';
import { fetchLatestFurnaceData } from '../lib/influx'; // The helper we discussed

interface MqttContextType {
  client: MqttClient | null;
  furnaces: Record<string, FurnaceData>;
  pipeline: ConnectionPipeline;
  telemetryHistory: Record<string, { timestamp: number; temps: (number | null)[] }[]>;
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
  const [telemetryHistory, setTelemetryHistory] = useState<Record<string, { timestamp: number; temps: (number | null)[] }[]>>({});
  const [pipeline, setPipeline] = useState<ConnectionPipeline>({
    wifi: 'idle', ntp: 'idle', mqtts: 'idle', discovery: 'idle',
  });

  const host = import.meta.env.VITE_EMQX_HOST;
  const user = import.meta.env.VITE_EMQX_USER;
  const pass = import.meta.env.VITE_EMQX_PASS;
  const port = import.meta.env.VITE_EMQX_PORT || 8084;

  // --- STEP 1: HYDRATION (Load History from InfluxDB) ---
  useEffect(() => {
    const hydrate = async () => {
      try {
        const history: any = await fetchLatestFurnaceData();
        if (history && history.length > 0) {
          setFurnaces(prev => {
            const next = { ...prev };
            history.forEach((node: any) => {
              if (!next[node.chipId]) {
                next[node.chipId] = {
                  id: node.chipId,
                  chipId: node.chipId,
                  name: `Node ${node.chipId.slice(-4)}`,
                  status: 'offline', // Default until MQTT pings
                  lastSeen: Date.now() - 30000,
                  temps: { t1: node.t1, t2: node.t2, t3: node.t3, t4: node.t4 },
                  rawTemps: { t1: node.r1, t2: node.r2, t3: node.r3, t4: node.r4 },
                  enabledSensors: [true, true, true, true],
                  calibrations: Array(4).fill({ targetLow: 0, targetHigh: 100, rawLow: 0, rawHigh: 100, scale: 1, offset: 0 }),
                  sensorNames: ['T1_CORE', 'T2_UPPER', 'T3_LOWER', 'T4_EXHAUST'],
                };
              }
            });
            return next;
          });
          setPipeline(prev => ({ ...prev, discovery: 'success' }));
        }
      } catch (err) {
        console.error('Hydration Failed:', err);
      }
    };
    hydrate();
  }, []);

  // --- STEP 2: MQTT CONNECTION & MESSAGE HANDLING ---
  useEffect(() => {
    if (!host) return;

    setPipeline(prev => ({ ...prev, mqtts: 'loading', wifi: 'loading' }));

    const mqttClient = mqtt.connect(`wss://${host}:${port}/mqtt`, {
      username: user,
      password: pass,
      clientId: `kinetic_web_${Math.random().toString(16).slice(2, 10)}`,
      connectTimeout: 5000,
      reconnectPeriod: 5000,
      rejectUnauthorized: false, // Fixes SSL/WSS handshake issues
    });

    mqttClient.on('connect', () => {
      console.log('MQTT Connected');
      setPipeline(prev => ({ ...prev, mqtts: 'success', wifi: 'success', ntp: 'loading' }));
      mqttClient.subscribe(['discovery/nodes', 'furnace/+/telemetry', 'status/+/+']);
    });

    mqttClient.on('error', (err) => {
      console.error('MQTT Error:', err);
      setPipeline(prev => ({ ...prev, mqtts: 'error' }));
    });

    mqttClient.on('message', (topic, message) => {
      const payload = message.toString();
      let data: any;
      try { data = JSON.parse(payload); } catch (e) { data = payload; }

      // Discovery
      if (topic === 'discovery/nodes') {
        setPipeline(prev => ({ ...prev, discovery: data ? 'success' : 'idle' }));
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
                calibrations: Array(4).fill({ targetLow: 0, targetHigh: 100, rawLow: 0, rawHigh: 100, scale: 1, offset: 0 }),
                sensorNames: ['T1_CORE', 'T2_UPPER', 'T3_LOWER', 'T4_EXHAUST'],
              };
            }
          });
          return next;
        });
      }

      // Telemetry
      const telemetryMatch = topic.match(/^furnace\/(.+)\/telemetry$/);
      if (telemetryMatch) {
        const chipId = telemetryMatch[1];
        if (data.epoch) setPipeline(prev => ({ ...prev, ntp: 'success' }));

setFurnaces(prev => {
  const furnace = prev[chipId];
  if (!furnace) return prev;

  // Match the ESP32 JSON keys: data.temps.T1, data.temps.T2, etc.
  return {
    ...prev,
    [chipId]: {
      ...furnace,
      status: 'online',
      lastSeen: Date.now(),
      temps: { 
        t1: data.temps.T1, 
        t2: data.temps.T2, 
        t3: data.temps.T3, 
        t4: data.temps.T4 
      },
      rawTemps: { 
        t1: data.raw.T1, 
        t2: data.raw.T2, 
        t3: data.raw.T3, 
        t4: data.raw.T4 
      }
    }
  };
});
      }

      // Status
      const statusMatch = topic.match(/^status\/(.+)\/(.+)$/);
      if (statusMatch) {
        const chipId = statusMatch[1];
        const status = (data.status || data).toLowerCase();
        setFurnaces(prev => {
          if (!prev[chipId]) return prev;
          return {
            ...prev,
            [chipId]: { ...prev[chipId], status: status === 'online' ? 'online' : 'offline', lastSeen: Date.now() }
          };
        });
      }
    });

    setClient(mqttClient);
    return () => { mqttClient.end(); };
  }, [host, user, pass, port]);

  // Internal helper to keep main logic clean
  const updateHistoryAndDB = (chipId: string, temps: (number | null)[]) => {
    setTelemetryHistory(prev => {
      const history = prev[chipId] || [];
      return { ...prev, [chipId]: [...history.slice(-59), { timestamp: Date.now(), temps }] };
    });
    db.telemetry.add({ chipId, t1: temps[0], t2: temps[1], t3: temps[2], t4: temps[3], timestamp: Date.now() })
      .catch(e => console.error('DB Add Fail', e));
  };

  // --- RETAINED FUNCTIONS (Toggle, Calibrate, Pruning, Names) ---
  const toggleSensor = useCallback((chipId: string, sIdx: number, en: boolean) => {
    if (!client) return;
    client.publish(`furnace/${chipId}/cmd`, JSON.stringify({ cmd: 'TOGGLE', sIdx: sIdx+1, en }));
    setFurnaces(prev => {
      if (!prev[chipId]) return prev;
      const nextEnabled = [...prev[chipId].enabledSensors];
      nextEnabled[sIdx] = en;
      return { ...prev, [chipId]: { ...prev[chipId], enabledSensors: nextEnabled } };
    });
  }, [client]);

  const calibrateSensor = useCallback((chipId: string, sIdx: number, off: number, scl: number) => {
    if (!client) return;
    client.publish(`furnace/${chipId}/cmd`, JSON.stringify({ cmd: 'CALIBRATE', sIdx:sIdx +1, off, scl }));
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
      setTelemetryHistory({});
      setPipeline(prev => ({ ...prev, discovery: 'idle' }));
    }
  }, [client]);

  // Pruning and Offline detection (same as your previous code)
  useEffect(() => {
    const prune = () => db.telemetry.where('timestamp').below(Date.now() - 86400000).delete();
    const interval = setInterval(prune, 3600000);
    return () => clearInterval(interval);
  }, []);

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
    client, furnaces, pipeline, telemetryHistory, toggleSensor,
    calibrateSensor, updateFriendlyName, updateSensorName, clearNodes,
  }), [client, furnaces, pipeline, telemetryHistory, toggleSensor, calibrateSensor, updateFriendlyName, updateSensorName, clearNodes]);

  return <MqttContext.Provider value={value}>{children}</MqttContext.Provider>;
};

export const useMqtt = () => {
  const context = useContext(MqttContext);
  if (!context) throw new Error('useMqtt must be used within an MqttProvider');
  return context;
};