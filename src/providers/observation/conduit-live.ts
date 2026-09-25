import { ObservationProvider, ProviderStatus } from './interface';
import { NormalizedObservation, FetchOptions } from '../types';
import { normalizeAndValidateObservation } from './normalizer';

export class ConduitLiveProvider implements ObservationProvider {
  name = 'JKUAT Conduit Live API Adapter';
  sourceType = 'LIVE_CONDUIT' as const;

  private baseUrl: string;
  private apiKey: string;

  constructor() {
    this.baseUrl = process.env.CONDUIT_API_URL || '';
    this.apiKey = process.env.CONDUIT_API_KEY || '';
  }

  async getStatus(): Promise<ProviderStatus> {
    if (!this.baseUrl) {
      return {
        sourceType: this.sourceType,
        available: false,
        statusMessage: 'Source unavailable: CONDUIT_API_URL is not configured in environment settings.',
        endpointUrl: undefined,
      };
    }

    try {
      // Test connectivity to Conduit API
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const res = await fetch(`${this.baseUrl}/health`, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          Accept: 'application/json',
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        return {
          sourceType: this.sourceType,
          available: false,
          statusMessage: `Source unavailable: Conduit API returned HTTP ${res.status} (${res.statusText}).`,
          endpointUrl: this.baseUrl,
        };
      }

      return {
        sourceType: this.sourceType,
        available: true,
        statusMessage: 'Live Conduit API connected and operational.',
        endpointUrl: this.baseUrl,
      };
    } catch (err: any) {
      return {
        sourceType: this.sourceType,
        available: false,
        statusMessage: `Source unavailable: ${err?.message || 'Network endpoint unreachable'}.`,
        endpointUrl: this.baseUrl,
      };
    }
  }

  async fetchLatest(stationId: string): Promise<NormalizedObservation[]> {
    const status = await this.getStatus();
    if (!status.available) {
      throw new Error(status.statusMessage);
    }

    const url = `${this.baseUrl}/stations/${encodeURIComponent(stationId)}/latest`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      throw new Error(`Conduit API returned HTTP ${res.status}: ${res.statusText}`);
    }

    const data = await res.json();
    const items = Array.isArray(data) ? data : [data];
    const normalizedList: NormalizedObservation[] = [];

    items.forEach((item, idx) => {
      const { normalized } = normalizeAndValidateObservation(item, this.sourceType, idx + 1, stationId);
      if (normalized) normalizedList.push(normalized);
    });

    return normalizedList;
  }

  async fetchHistorical(options: FetchOptions): Promise<NormalizedObservation[]> {
    const status = await this.getStatus();
    if (!status.available) {
      throw new Error(status.statusMessage);
    }

    const params = new URLSearchParams();
    if (options.stationId) params.append('station_id', options.stationId);
    if (options.startDate) params.append('start_date', options.startDate);
    if (options.endDate) params.append('end_date', options.endDate);
    if (options.limit) params.append('limit', String(options.limit));

    const url = `${this.baseUrl}/observations?${params.toString()}`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      throw new Error(`Conduit API returned HTTP ${res.status}: ${res.statusText}`);
    }

    const data = await res.json();
    const items = Array.isArray(data?.results ? data.results : data) ? (data.results || data) : [];
    const normalizedList: NormalizedObservation[] = [];

    items.forEach((item: any, idx: number) => {
      const { normalized } = normalizeAndValidateObservation(item, this.sourceType, idx + 1, options.stationId);
      if (normalized) normalizedList.push(normalized);
    });

    return normalizedList;
  }
}
