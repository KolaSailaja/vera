import { SatelliteProvider } from './interface';
import { NormalizedSatelliteRainfall } from '../types';

export class DevelopmentTestSatelliteProvider implements SatelliteProvider {
  name = 'Labelled Development Test Satellite Provider';
  productName = 'CHIRPS_TEST_SATELLITE';

  private sampleSatelliteData = [
    {
      id: 'dev_test_sat_201',
      productName: 'CHIRPS_TEST_SATELLITE',
      lat: -1.1018,
      lon: 37.0144,
      date: '2026-09-24',
      rainfall_mm: 14.2,
      confidence_score: 0.85,
    },
    {
      id: 'dev_test_sat_202',
      productName: 'CHIRPS_TEST_SATELLITE',
      lat: -1.1018,
      lon: 37.0144,
      date: '2026-09-23',
      rainfall_mm: 0.0,
      confidence_score: 0.92,
    },
    {
      id: 'dev_test_sat_203',
      productName: 'GPM_IMERG_TEST',
      lat: -1.1018,
      lon: 37.0144,
      date: '2026-09-22',
      rainfall_mm: 5.8,
      confidence_score: 0.78,
    },
  ];

  normalize(rawData: any): NormalizedSatelliteRainfall {
    return {
      id: String(rawData.id),
      productName: String(rawData.productName || this.productName),
      lat: Number(rawData.lat),
      lon: Number(rawData.lon),
      date: String(rawData.date),
      rainfallMm: Number(rawData.rainfall_mm),
      confidenceScore: Number(rawData.confidence_score),
      rawPayload: rawData,
    };
  }

  async fetchLatest(lat: number, lon: number): Promise<NormalizedSatelliteRainfall> {
    const item = this.sampleSatelliteData[0];
    return this.normalize({ ...item, lat, lon });
  }

  async fetchHistorical(
    lat: number,
    lon: number,
    startDate: string,
    endDate: string
  ): Promise<NormalizedSatelliteRainfall[]> {
    let items = [...this.sampleSatelliteData];
    if (startDate) items = items.filter((i) => i.date >= startDate);
    if (endDate) items = items.filter((i) => i.date <= endDate);
    return items.map((i) => this.normalize({ ...i, lat, lon }));
  }
}
