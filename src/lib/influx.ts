import { InfluxDB } from '@influxdata/influxdb-client';

const url = import.meta.env.VITE_INFLUX_URL || '';
const token = import.meta.env.VITE_INFLUX_TOKEN || '';
const org = import.meta.env.VITE_INFLUX_ORG || '';
const bucket = import.meta.env.VITE_INFLUX_BUCKET;

const influxClient = url ? new InfluxDB({ url, token }) : null;

export const queryHistoricalData = async (startDate: string, endDate: string, fields: string[]): Promise<any[]> => {
  if (!influxClient || !org) {
    console.error("InfluxDB not initialized. Check your .env file.");
    return [];
  }

  const queryApi = influxClient.getQueryApi(org);

  // 1. FIX: Match the lowercase fields from your Excel sheet
  const fieldsToQuery = fields.length > 0 ? fields : ['t1', 't2', 't3', 't4']; 
  const fieldFilter = `|> filter(fn: (r) => ${fieldsToQuery.map(f => `r["_field"] == "${f.toLowerCase()}"`).join(' or ')})`;

  // 2. FIX: Measurement Name. 
  // Based on your previous code, it should likely be "furnace_telemetry"


  const fluxQuery = `
  from(bucket: "${bucket}")
    |> range(start: time(v: "${startDate}T00:00:00Z"), stop: time(v: "${endDate}T23:59:59Z"))
    |> filter(fn: (r) => r["_measurement"] == "furnace_telemetry")
    ${fieldFilter}
    |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
    |> limit(n: 100)
`;
  

  console.log("Executing Flux:", fluxQuery);

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
        console.log(`Query Complete. Found ${results.length} rows.`);
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