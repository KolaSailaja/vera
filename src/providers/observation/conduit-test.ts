import { ObservationProvider, ProviderStatus } from './interface';
import { NormalizedObservation, FetchOptions } from '../types';
import { normalizeAndValidateObservation } from './normalizer';

export class ConduitDevelopmentTestProvider implements ObservationProvider {
  name = 'Labelled Development Test Data Provider';
  sourceType = 'IMPORTED_CONDUIT_DATA' as const;

  private sampleDataSet = [
    {
      timestamp: '2026-09-24T08:00:00.000Z',
      station_id: 'JKUAT_STATION_TEST_1',
      rain_gauge_1: 12.5,
      rain_gauge_2: 12.4,
      rainfall_instantaneous: 12.5,
      rainfall_daily: 25.0,
      temperature: 22.4,
      humidity: 78.5,
      pressure: 1013.25,
      wind_speed: 3.4,
      wind_gust: 5.1,
      wind_direction: 180,
    },
    {
      timestamp: '2026-09-24T09:00:00.000Z',
      station_id: 'JKUAT_STATION_TEST_1',
      rain_gauge_1: 15.0,
      rain_gauge_2: 15.1,
      rainfall_instantaneous: 15.0,
      rainfall_daily: 40.0,
      temperature: 23.1,
      humidity: 80.0,
      pressure: 1012.80,
      wind_speed: 4.2,
      wind_gust: 6.5,
      wind_direction: 195,
    },
  ];

  async getStatus(): Promise<ProviderStatus> {
    return {
      sourceType: this.sourceType,
      available: true,
      statusMessage: 'Development Test Provider ready.',
    };
  }

  async fetchLatest(stationId: string): Promise<NormalizedObservation[]> {
    const item = this.sampleDataSet[0];
    const { normalized } = normalizeAndValidateObservation(item, this.sourceType, 1, stationId);
    return normalized ? [normalized] : [];
  }

  async fetchHistorical(options: FetchOptions): Promise<NormalizedObservation[]> {
    const list: NormalizedObservation[] = [];
    this.sampleDataSet.forEach((item, idx) => {
      const { normalized } = normalizeAndValidateObservation(item, this.sourceType, idx + 1, options.stationId);
      if (normalized) list.push(normalized);
    });
    return list;
  }
}
