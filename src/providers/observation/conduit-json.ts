import { ObservationProvider, ProviderStatus } from './interface';
import { NormalizedObservation, IngestionValidationError, FetchOptions } from '../types';
import { normalizeAndValidateObservation } from './normalizer';

export class ConduitJSONProvider implements ObservationProvider {
  name = 'JKUAT Conduit JSON Import Adapter';
  sourceType = 'IMPORTED_CONDUIT_DATA' as const;

  private rawRecords: any[] = [];

  constructor(rawInput: string | any[] = []) {
    this.setRawInput(rawInput);
  }

  setRawInput(rawInput: string | any[]) {
    if (typeof rawInput === 'string') {
      try {
        const parsed = JSON.parse(rawInput);
        this.rawRecords = Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        this.rawRecords = [];
      }
    } else if (Array.isArray(rawInput)) {
      this.rawRecords = rawInput;
    } else if (rawInput && typeof rawInput === 'object') {
      this.rawRecords = [rawInput];
    } else {
      this.rawRecords = [];
    }
  }

  async getStatus(): Promise<ProviderStatus> {
    return {
      sourceType: this.sourceType,
      available: true,
      statusMessage: `JSON Import Adapter Ready (${this.rawRecords.length} records staged)`,
    };
  }

  parseAndValidate(): { validRecords: NormalizedObservation[]; errors: IngestionValidationError[] } {
    const validRecords: NormalizedObservation[] = [];
    const errors: IngestionValidationError[] = [];

    if (!Array.isArray(this.rawRecords) || this.rawRecords.length === 0) {
      errors.push({
        row: 0,
        field: 'json',
        message: 'JSON input is empty or invalid JSON array/object structure.',
      });
      return { validRecords, errors };
    }

    this.rawRecords.forEach((item, idx) => {
      const rowIndex = idx + 1;
      const { normalized, error } = normalizeAndValidateObservation(item, this.sourceType, rowIndex);

      if (error) {
        errors.push(error);
      } else if (normalized) {
        validRecords.push(normalized);
      }
    });

    return { validRecords, errors };
  }

  async fetchLatest(stationId: string): Promise<NormalizedObservation[]> {
    const { validRecords } = this.parseAndValidate();
    const filtered = validRecords.filter((r) => !stationId || r.stationId === stationId);
    return filtered.length > 0 ? [filtered[filtered.length - 1]] : [];
  }

  async fetchHistorical(options: FetchOptions): Promise<NormalizedObservation[]> {
    const { validRecords } = this.parseAndValidate();
    let filtered = [...validRecords];

    if (options.stationId) {
      filtered = filtered.filter((r) => r.stationId === options.stationId);
    }
    if (options.startDate) {
      filtered = filtered.filter((r) => r.timestamp >= options.startDate!);
    }
    if (options.endDate) {
      filtered = filtered.filter((r) => r.timestamp <= options.endDate!);
    }
    if (options.limit && filtered.length > options.limit) {
      filtered = filtered.slice(0, options.limit);
    }
    return filtered;
  }
}
