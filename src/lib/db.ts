import Dexie, { Table } from 'dexie';

export interface TelemetryRecord {
  id?: number;
  chipId: string;
  t1: number | null;
  t2: number | null;
  t3: number | null;
  t4: number | null;
  timestamp: number;
}

export class ScadaDB extends Dexie {
  telemetry!: Table<TelemetryRecord, number>;

  constructor() {
    super('ScadaDB');
    this.version(1).stores({
      telemetry: '++id, chipId, timestamp'
    });
    this.version(2).stores({
      telemetry: '++id, chipId, timestamp, [chipId+timestamp]'
    });
  }
}

export const db = new ScadaDB();
