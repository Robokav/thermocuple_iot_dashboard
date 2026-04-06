import { InfluxDB } from '@influxdata/influxdb-client';

// 1. Safe Environment Variable Loading
const url = import.meta.env.VITE_INFLUX_URL || '';
const token = import.meta.env.VITE_INFLUX_TOKEN || '';
const org = import.meta.env.VITE_INFLUX_ORG || '';
const bucket = import.meta.env.VITE_INFLUX_BUCKET || 'furnace_data';

// 2. Initialize client
const influxClient = url ? new InfluxDB({ url, token }) : null;

/**
 * QUERY HISTORY: Fetches data between two dates for specific sensors
 * This is what powers your Analytics Graph and Table
 */
export const queryHistoricalData = async (startDate: string, endDate: string, fields: string[]): Promise<any[]> => {
  if (!influxClient || !org) {
    console.error("InfluxDB not initialized");
    return [];
  }

  const queryApi = influxClient.getQueryApi(org);

  // Construct the Flux query
  // We use pivot() so that T1, T2, etc., appear as columns in one row per timestamp
  const fluxQuery = `
    from(bucket: "${bucket}")
      |> range(start: ${startDate}T00:00:00Z, stop: ${endDate}T23:59:59Z)
      |> filter(fn: (r) => r["_measurement"] == "furnace_telemetry")
      ${fields.map(f => `|> filter(fn: (r) => r["_field"] == "${f}")`).join(' ')}
      |> aggregateWindow(every: 1m, fn: mean, createEmpty: false)
      |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
  `;

  const results: any[] = [];

  return new Promise((resolve) => {
    queryApi.queryRows(fluxQuery, {
      next(row, tableMeta) {
        results.push(tableMeta.toObject(row));
      },
      error(err) {
        console.error("Historical Query Failed:", err);
        resolve([]);
      },
      complete() {
        resolve(results);
      },
    });
  });
};

/**
 * PURGE: Deletes data within a specific time range
 */
export const purgeHistoricalData = async (startDate: string, endDate: string) => {
  if (!influxClient || !org) {
    console.error("Purge failed: InfluxDB client not initialized.");
    return { success: false };
  }

  const deleteApi = influxClient!.getDeleteApi(org);
  const start = new Date(`${startDate}T00:00:00Z`);
  const stop = new Date(`${endDate}T23:59:59Z`);

  try {
    await deleteApi.delete({
      start: start.toISOString(),
      stop: stop.toISOString(),
      bucket: bucket,
      predicate: '_measurement="furnace_telemetry"',
    });
    return { success: true };
  } catch (error) {
    console.error("Purge Failed:", error);
    throw error;
  }
};

/**
 * FETCH LATEST: Gets the last known state for each sensor
 */
export const fetchLatestFurnaceData = async (): Promise<any[]> => {
  if (!influxClient || !org) return [];

  const queryApi = influxClient.getQueryApi(org);
  const fluxQuery = `
    from(bucket: "${bucket}")
      |> range(start: -3d)
      |> filter(fn: (r) => r["_measurement"] == "furnace_telemetry")
      |> last()
      |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
  `;

  const results: any[] = [];
  return new Promise((resolve) => {
    queryApi.queryRows(fluxQuery, {
      next(row, tableMeta) {
        const obj = tableMeta.toObject(row);
        results.push({ ...obj, chipId: obj.furnace_id || obj.chipId || 'unknown' });
      },
      error: () => resolve([]),
      complete: () => resolve(results),
    });
  });
};