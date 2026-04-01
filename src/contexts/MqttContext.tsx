import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import mqtt, { MqttClient } from 'mqtt';
import { FurnaceData, ConnectionPipeline } from '../types';
import { db } from '../lib/db';

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
    wifi: 'idle',
    ntp: 'idle',
    mqtts: 'idle',
    discovery: 'idle',
  });

  const host = import.meta.env.VITE_EMQX_HOST;
  const user = import.meta.env.VITE_EMQX_USER;
  const pass = import.meta.env.VITE_EMQX_PASS;
  const port = import.meta.env.VITE_EMQX_PORT || 8084;

  useEffect(() => {
    if (!host) {
      console.warn('MQTT Host not configured');
      return;
    }

    setPipeline(prev => ({ ...prev, mqtts: 'loading', wifi: 'loading' }));

    const mqttClient = mqtt.connect(`wss://${host}:${port}/mqtt`, {
      username: user,
      password: pass,
      clientId: `kinetic_web_${Math.random().toString(16).slice(2, 10)}`,
      connectTimeout: 5000,
      reconnectPeriod: 5000,
    });

    mqttClient.on('connect', () => {
      console.log('MQTT Connected');
      setPipeline(prev => ({ ...prev, mqtts: 'success', wifi: 'success', ntp: 'loading' }));
      
      mqttClient.subscribe('discovery/nodes');
      mqttClient.subscribe('furnace/+/telemetry');
      mqttClient.subscribe('status/+/+');
    });

    mqttClient.on('error', (err) => {
      console.error('MQTT Error:', err);
      setPipeline(prev => ({ ...prev, mqtts: 'error' }));
    });

    mqttClient.on('message', (topic, message) => {
      const payload = message.toString();
      let data: any;
      try {
        data = JSON.parse(payload);
      } catch (e) {
        data = payload;
      }

      // Handle Discovery
      if (topic === 'discovery/nodes') {
        if (!payload) {
          setPipeline(prev => ({ ...prev, discovery: 'idle' }));
          return;
        }
        setPipeline(prev => ({ ...prev, discovery: 'success' }));
        const nodes = Array.isArray(data) ? data : [data];
        setFurnaces(prev => {
          const next = { ...prev };
          nodes.forEach((node: any) => {
            if (node && node.chipId && !next[node.chipId]) {
              next[node.chipId] = {
                id: node.chipId,
                chipId: node.chipId,
                name: node.name || `Node ${node.chipId.slice(-4)}`,
                status: 'online',
                lastSeen: Date.now(),
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

      // Handle Telemetry
      const telemetryMatch = topic.match(/^furnace\/(.+)\/telemetry$/);
      if (telemetryMatch) {
        const chipId = telemetryMatch[1];
        if (data.epoch) {
          setPipeline(prev => ({ ...prev, ntp: 'success' }));
        }
        setFurnaces(prev => {
          if (!prev[chipId]) return prev;
          const furnace = prev[chipId];
          const newTemps = [
            furnace.enabledSensors[0] ? data.temps[0] : null,
            furnace.enabledSensors[1] ? data.temps[1] : null,
            furnace.enabledSensors[2] ? data.temps[2] : null,
            furnace.enabledSensors[3] ? data.temps[3] : null,
          ];

          setTelemetryHistory(hPrev => {
            const hNext = { ...hPrev };
            const history = hNext[chipId] || [];
            const newEntry = { timestamp: Date.now(), temps: newTemps };
            hNext[chipId] = [...history.slice(-59), newEntry]; // Keep last 60 entries
            return hNext;
          });

          // Save to IndexedDB
          db.telemetry.add({
            chipId,
            t1: typeof newTemps[0] === 'number' ? newTemps[0] : null,
            t2: typeof newTemps[1] === 'number' ? newTemps[1] : null,
            t3: typeof newTemps[2] === 'number' ? newTemps[2] : null,
            t4: typeof newTemps[3] === 'number' ? newTemps[3] : null,
            timestamp: Date.now()
          }).catch(err => console.error('Failed to save telemetry to DB:', err));

          return {
            ...prev,
            [chipId]: {
              ...furnace,
              lastSeen: Date.now(),
              temps: {
                t1: newTemps[0],
                t2: newTemps[1],
                t3: newTemps[2],
                t4: newTemps[3],
              },
              rawTemps: {
                t1: data.raw[0],
                t2: data.raw[1],
                t3: data.raw[2],
                t4: data.raw[3],
              }
            }
          };
        });
      }

      // Handle Status
      const statusMatch = topic.match(/^status\/(.+)\/(.+)$/);
      if (statusMatch) {
        const chipId = statusMatch[1];
        const status = data.status || data; // Handle both JSON and string
        setFurnaces(prev => {
          if (!prev[chipId]) return prev;
          return {
            ...prev,
            [chipId]: {
              ...prev[chipId],
              status: status.toLowerCase() === 'online' ? 'online' : 'offline',
              lastSeen: Date.now(),
            }
          };
        });
      }
    });

    setClient(mqttClient);

    return () => {
      mqttClient.end();
    };
  }, [host, user, pass, port]);

  // Prune old data (older than 24 hours)
  useEffect(() => {
    const pruneData = async () => {
      const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;
      try {
        await db.telemetry.where('timestamp').below(twentyFourHoursAgo).delete();
      } catch (err) {
        console.error('Failed to prune old telemetry data:', err);
      }
    };

    // Run pruning every hour
    pruneData();
    const interval = setInterval(pruneData, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const toggleSensor = useCallback((chipId: string, sIdx: number, en: boolean) => {
    if (!client) return;
    client.publish(`furnace/${chipId}/cmd`, JSON.stringify({ cmd: 'TOGGLE', sIdx, en }));
    setFurnaces(prev => {
      if (!prev[chipId]) return prev;
      const nextEnabled = [...prev[chipId].enabledSensors];
      nextEnabled[sIdx] = en;
      return {
        ...prev,
        [chipId]: { ...prev[chipId], enabledSensors: nextEnabled }
      };
    });
  }, [client]);

  const calibrateSensor = useCallback((chipId: string, sIdx: number, off: number, scl: number) => {
    if (!client) return;
    client.publish(`furnace/${chipId}/cmd`, JSON.stringify({ cmd: 'CALIBRATE', sIdx, off, scl }));
    setFurnaces(prev => {
      if (!prev[chipId]) return prev;
      const nextCalib = [...prev[chipId].calibrations];
      nextCalib[sIdx] = { ...nextCalib[sIdx], offset: off, scale: scl };
      return {
        ...prev,
        [chipId]: { ...prev[chipId], calibrations: nextCalib }
      };
    });
  }, [client]);

  // Offline Detection
  useEffect(() => {
    const interval = setInterval(() => {
      setFurnaces(prev => {
        const next = { ...prev };
        let changed = false;
        Object.keys(next).forEach(chipId => {
          if (next[chipId].status === 'online' && Date.now() - next[chipId].lastSeen > 10000) {
            next[chipId] = { ...next[chipId], status: 'offline' };
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const updateFriendlyName = useCallback((chipId: string, name: string) => {
    setFurnaces(prev => {
      if (!prev[chipId]) return prev;
      return {
        ...prev,
        [chipId]: { ...prev[chipId], name }
      };
    });
  }, []);

  const updateSensorName = useCallback((chipId: string, sIdx: number, name: string) => {
    setFurnaces(prev => {
      if (!prev[chipId]) return prev;
      const nextNames = [...prev[chipId].sensorNames];
      nextNames[sIdx] = name;
      return {
        ...prev,
        [chipId]: { ...prev[chipId], sensorNames: nextNames }
      };
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

  const value = useMemo(() => ({
    client,
    furnaces,
    pipeline,
    telemetryHistory,
    toggleSensor,
    calibrateSensor,
    updateFriendlyName,
    updateSensorName,
    clearNodes,
  }), [client, furnaces, pipeline, telemetryHistory, toggleSensor, calibrateSensor, updateFriendlyName, updateSensorName, clearNodes]);

  return <MqttContext.Provider value={value}>{children}</MqttContext.Provider>;
};

export const useMqtt = () => {
  const context = useContext(MqttContext);
  if (context === undefined) {
    throw new Error('useMqtt must be used within an MqttProvider');
  }
  return context;
};
