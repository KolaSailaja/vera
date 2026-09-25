export type DataSourceType = 'LIVE_CONDUIT' | 'IMPORTED_CONDUIT_DATA' | 'NO_DATA';

export type TrustCategory = 'TRUSTWORTHY' | 'FAULTY' | 'DISAGREEMENT' | 'INSUFFICIENT_DATA';

export interface NormalizedObservation {
  id: string;
  stationId: string;
  timestamp: string; // ISO String
  rainGauge1: number | null;
  rainGauge2: number | null;
  rainfallInstantaneous: number | null;
  rainfallDaily: number | null;
  temperature: number | null;
  humidity: number | null;
  pressure: number | null;
  windSpeed: number | null;
  windGust: number | null;
  windDirection: number | null;
  sourceType: DataSourceType;
  rawPayload: unknown;
}

export interface IngestionValidationError {
  row: number;
  field: string;
  message: string;
  rawData?: unknown;
}

export interface IngestionResult {
  success: boolean;
  sourceType: DataSourceType;
  providerName: string;
  importedCount: number;
  skippedDuplicatesCount: number;
  validationErrors: IngestionValidationError[];
  timestamp: string;
}

export interface NormalizedSatelliteRainfall {
  id: string;
  productName: string;
  lat: number;
  lon: number;
  date: string; // YYYY-MM-DD
  rainfallMm: number;
  confidenceScore: number;
  rawPayload: unknown;
}

export interface FetchOptions {
  stationId?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
}
