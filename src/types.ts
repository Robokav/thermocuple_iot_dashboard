export type Severity = 'critical' | 'warning' | 'info';

export interface LogEntry {
  id: string;
  timestamp: string;
  source: string;
  message: string;
  severity: Severity;
  acknowledged?: boolean;
}

export interface SensorCalibration {
  targetLow: number;
  targetHigh: number;
  rawLow: number;
  rawHigh: number;
  scale: number;
  offset: number;
}

export interface FurnaceData {
  id: string;
  chipId: string;
  name: string;
  status: 'online' | 'idle' | 'standby' | 'offline';
  lastSeen: number; // Epoch timestamp
  temps: {
    t1: number | null;
    t2: number | null;
    t3: number | null;
    t4: number | null;
  };
  rawTemps: {
    t1: number;
    t2: number;
    t3: number;
    t4: number;
  };
  enabledSensors: boolean[]; // [t1, t2, t3, t4]
  calibrations: SensorCalibration[];
  sensorNames: string[]; // [t1, t2, t3, t4]
}

export interface ConnectionPipeline {
  wifi: 'idle' | 'loading' | 'success' | 'error';
  ntp: 'idle' | 'loading' | 'success' | 'error';
  mqtts: 'idle' | 'loading' | 'success' | 'error';
  discovery: 'idle' | 'loading' | 'success' | 'error';
}
