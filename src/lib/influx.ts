import { InfluxDB } from '@influxdata/influxdb-client';

// 1. Safe Environment Variable Loading
const url = import.meta.env.VITE_INFLUX_URL || '';
const token = import.meta.env.VITE_INFLUX_TOKEN || '';
const org = import.meta.env.VITE_INFLUX_ORG || '';
const bucket = import.meta.env.VITE_INFLUX_BUCKET || 'furnace_data';

// 2. Initialize client only if we have a URL to avoid "Undefined" errors
const influxClient = url ? new InfluxDB({ url, token }) : null;

// 3. EXPLICIT NAMED EXPORT (This fixes the MqttContext SyntaxError)
export const fetchLatestFurnaceData = async (): Promise<any[]> => {
  if (!influxClient || !org) {
    console.warn("InfluxDB credentials missing. History hydration skipped.");
    return [];
  }

  const queryApi = influxClient.getQueryApi(org);
  
  // Use a standard Flux query for InfluxDB 2.x/Cloud
  const fluxQuery = `
    from(bucket: "${bucket}")
      |> range(start: -3d)
      |> filter(fn: (r) => r["_measurement"] == "furnace_telemetry")
      |> last()
      |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
  `;

  const results: any[] = [];
  
  return new Promise((resolve, reject) => {
    queryApi.queryRows(fluxQuery, {
      next(row, tableMeta) {
        const obj = tableMeta.toObject(row);
        results.push({
          ...obj,
          chipId: obj.furnace_id || obj.chipId || 'unknown'
        });
      },
      error(err) {
        console.error("InfluxDB Query Failed:", err);
        resolve([]); // Resolve empty instead of crashing the app
      },
      complete() {
        resolve(results);
      },
    });
  });
};