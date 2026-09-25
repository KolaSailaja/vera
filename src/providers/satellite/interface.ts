import { NormalizedSatelliteRainfall } from '../types';

export interface SatelliteRainfallProvider {
  name: string;
  productName: string;
  sourceType?: 'LIVE_CHIRPS_API' | 'IMPORTED_CHIRPS_DATA';
  fetchDailyRainfall?(
    latitude: number,
    longitude: number,
    startDate: string,
    endDate: string
  ): Promise<NormalizedSatelliteRainfall[]>;
  fetchLatest?(lat: number, lon: number): Promise<NormalizedSatelliteRainfall>;
  fetchHistorical?(
    lat: number,
    lon: number,
    startDate: string,
    endDate: string
  ): Promise<NormalizedSatelliteRainfall[]>;
  normalize(rawData: unknown): NormalizedSatelliteRainfall;
}

export type SatelliteProvider = SatelliteRainfallProvider;
