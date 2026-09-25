import { NormalizedObservation, DataSourceType, FetchOptions } from '../types';

export interface ProviderStatus {
  sourceType: DataSourceType;
  available: boolean;
  statusMessage: string;
  endpointUrl?: string;
  lastSuccessTimestamp?: string;
}

export interface ObservationProvider {
  name: string;
  sourceType: DataSourceType;
  getStatus(): Promise<ProviderStatus>;
  fetchLatest(stationId: string): Promise<NormalizedObservation[]>;
  fetchHistorical(options: FetchOptions): Promise<NormalizedObservation[]>;
}
