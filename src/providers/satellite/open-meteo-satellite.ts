import { SatelliteProvider } from './interface';
import { NormalizedSatelliteRainfall } from '../types';

export class OpenMeteoSatelliteProvider implements SatelliteProvider {
  name = 'Open-Meteo ERA5 / Satellite Precipitation';
  productName = 'OPEN_METEO_ERA5_SATELLITE';

  normalize(rawData: any): NormalizedSatelliteRainfall {
    return {
      id: String(rawData.id || `sat_om_${rawData.date}_${Math.random().toString(36).substring(2, 6)}`),
      productName: this.productName,
      lat: Number(rawData.lat || -1.1018),
      lon: Number(rawData.lon || 37.0144),
      date: String(rawData.date || new Date().toISOString().split('T')[0]),
      rainfallMm: Number(rawData.precipitation_sum ?? rawData.rainfall_mm ?? 0.0),
      confidenceScore: Number(rawData.confidence_score ?? 0.85),
      rawPayload: rawData,
    };
  }

  async fetchLatest(lat: number, lon: number): Promise<NormalizedSatelliteRainfall> {
    const today = new Date().toISOString().split('T')[0];
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=precipitation_sum&timezone=Africa%2FNairobi`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`OpenMeteo Satellite API failed with HTTP ${res.status}`);
    }
    const data = await res.json();
    const date = data?.daily?.time?.[0] || today;
    const rain = data?.daily?.precipitation_sum?.[0] ?? 0.0;

    return this.normalize({
      lat,
      lon,
      date,
      precipitation_sum: rain,
      confidence_score: 0.85,
      full_response: data,
    });
  }

  async fetchHistorical(
    lat: number,
    lon: number,
    startDate: string,
    endDate: string
  ): Promise<NormalizedSatelliteRainfall[]> {
    const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${startDate}&end_date=${endDate}&daily=precipitation_sum&timezone=Africa%2FNairobi`;
    const res = await fetch(url);
    if (!res.ok) {
      // Fall back to forecast API if archive is out of bounds
      const fallbackUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&start_date=${startDate}&end_date=${endDate}&daily=precipitation_sum&timezone=Africa%2FNairobi`;
      const fallbackRes = await fetch(fallbackUrl);
      if (!fallbackRes.ok) {
        throw new Error(`OpenMeteo Historical Satellite API failed with HTTP ${res.status}`);
      }
      const fbData = await fallbackRes.json();
      return this.parseDailyArray(fbData, lat, lon);
    }
    const data = await res.json();
    return this.parseDailyArray(data, lat, lon);
  }

  private parseDailyArray(data: any, lat: number, lon: number): NormalizedSatelliteRainfall[] {
    const dates: string[] = data?.daily?.time || [];
    const sums: number[] = data?.daily?.precipitation_sum || [];
    return dates.map((date, idx) =>
      this.normalize({
        lat,
        lon,
        date,
        precipitation_sum: sums[idx] ?? 0.0,
        confidence_score: 0.88,
        raw: { date, sum: sums[idx] },
      })
    );
  }
}
