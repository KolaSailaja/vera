import { NormalizedObservation, IngestionValidationError, DataSourceType } from '../types';

function parseNumberOrNull(val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null;
  const num = Number(val);
  return isNaN(num) ? null : num;
}

export function normalizeAndValidateObservation(
  rawData: any,
  sourceType: DataSourceType,
  rowIndex = 1,
  defaultStationId = 'JKUAT_STATION_1'
): { normalized: NormalizedObservation | null; error: IngestionValidationError | null } {
  if (!rawData || typeof rawData !== 'object') {
    return {
      normalized: null,
      error: { row: rowIndex, field: 'payload', message: 'Malformed observation record object.', rawData },
    };
  }

  // 1. Timestamp Validation
  const rawTimestamp = rawData.timestamp || rawData.time || rawData.date || rawData.datetime || rawData.created_at;
  if (!rawTimestamp) {
    return {
      normalized: null,
      error: { row: rowIndex, field: 'timestamp', message: 'Missing required observation timestamp.', rawData },
    };
  }

  let isoTimestamp: string;
  try {
    const d = new Date(rawTimestamp);
    if (isNaN(d.getTime())) {
      return {
        normalized: null,
        error: { row: rowIndex, field: 'timestamp', message: `Invalid timestamp format: "${rawTimestamp}".`, rawData },
      };
    }
    isoTimestamp = d.toISOString();
  } catch {
    return {
      normalized: null,
      error: { row: rowIndex, field: 'timestamp', message: `Unable to parse timestamp: "${rawTimestamp}".`, rawData },
    };
  }

  // 2. Station ID
  const stationId = String(
    rawData.station_id || rawData.stationId || rawData.station || defaultStationId
  ).trim();

  // 3. Sensor Field Parsing (Only populate if present, do not invent missing values)
  const rainGauge1 = parseNumberOrNull(rawData.rain_gauge_1 ?? rawData.gauge_1 ?? rawData.gauge1);
  const rainGauge2 = parseNumberOrNull(rawData.rain_gauge_2 ?? rawData.gauge_2 ?? rawData.gauge2);
  const rainfallInstantaneous = parseNumberOrNull(
    rawData.rainfall_instantaneous ?? rawData.rain_inst ?? rawData.rainfall_mm ?? rawData.rain
  );
  const rainfallDaily = parseNumberOrNull(rawData.rainfall_daily ?? rawData.rain_daily ?? rawData.daily_rain);
  
  const temperature = parseNumberOrNull(rawData.temperature ?? rawData.temp_c ?? rawData.temp);
  const humidity = parseNumberOrNull(rawData.humidity ?? rawData.humidity_pct);
  const pressure = parseNumberOrNull(rawData.pressure ?? rawData.pressure_hpa ?? rawData.barometer);
  const windSpeed = parseNumberOrNull(rawData.wind_speed ?? rawData.wind_spd);
  const windGust = parseNumberOrNull(rawData.wind_gust ?? rawData.gust);
  const windDirection = parseNumberOrNull(rawData.wind_direction ?? rawData.wind_dir);

  // 4. Validation: Invalid Rainfall Check
  if (rainfallInstantaneous !== null && rainfallInstantaneous < 0) {
    return {
      normalized: null,
      error: {
        row: rowIndex,
        field: 'rainfall_instantaneous',
        message: `Invalid instantaneous rainfall value: ${rainfallInstantaneous} mm (cannot be negative).`,
        rawData,
      },
    };
  }

  if (rainfallDaily !== null && rainfallDaily < 0) {
    return {
      normalized: null,
      error: {
        row: rowIndex,
        field: 'rainfall_daily',
        message: `Invalid daily rainfall value: ${rainfallDaily} mm (cannot be negative).`,
        rawData,
      },
    };
  }

  if (rainGauge1 !== null && rainGauge1 < 0) {
    return {
      normalized: null,
      error: {
        row: rowIndex,
        field: 'rain_gauge_1',
        message: `Invalid rain gauge 1 value: ${rainGauge1} mm (cannot be negative).`,
        rawData,
      },
    };
  }

  // Generate deterministic ID for duplicate detection
  const cleanTimeStr = isoTimestamp.replace(/[:.-]/g, '');
  const id = `obs_${stationId}_${cleanTimeStr}`;

  const normalized: NormalizedObservation = {
    id,
    stationId,
    timestamp: isoTimestamp,
    rainGauge1,
    rainGauge2,
    rainfallInstantaneous,
    rainfallDaily,
    temperature,
    humidity,
    pressure,
    windSpeed,
    windGust,
    windDirection,
    sourceType,
    rawPayload: rawData,
  };

  return { normalized, error: null };
}
