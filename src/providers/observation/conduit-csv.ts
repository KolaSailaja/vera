import { ObservationProvider, ProviderStatus } from './interface';
import { NormalizedObservation, IngestionValidationError, FetchOptions } from '../types';
import { normalizeAndValidateObservation } from './normalizer';

export function parseCSVString(csvText: string): Record<string, string>[] {
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) return [];

  const headers = lines[0].split(',').map((h) => h.trim().replace(/^["']|["']$/g, ''));
  const records: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map((v) => v.trim().replace(/^["']|["']$/g, ''));
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] !== undefined ? values[idx] : '';
    });
    records.push(row);
  }

  return records;
}

export class ConduitCSVProvider implements ObservationProvider {
  name = 'JKUAT Conduit CSV Import Adapter';
  sourceType = 'IMPORTED_CONDUIT_DATA' as const;

  private rawRecords: any[] = [];

  constructor(rawInput: string | any[] = []) {
    if (typeof rawInput === 'string') {
      this.rawRecords = parseCSVString(rawInput);
    } else {
      this.rawRecords = rawInput;
    }
  }

  setRawInput(rawInput: string | any[]) {
    if (typeof rawInput === 'string') {
      this.rawRecords = parseCSVString(rawInput);
    } else {
      this.rawRecords = rawInput;
    }
  }

  async getStatus(): Promise<ProviderStatus> {
    return {
      sourceType: this.sourceType,
      available: true,
      statusMessage: `CSV Import Adapter Ready (${this.rawRecords.length} records staged)`,
    };
  }

  parseAndValidate(): { validRecords: NormalizedObservation[]; errors: IngestionValidationError[] } {
    const validRecords: NormalizedObservation[] = [];
    const errors: IngestionValidationError[] = [];

    if (!Array.isArray(this.rawRecords) || this.rawRecords.length === 0) {
      errors.push({
        row: 0,
        field: 'file',
        message: 'CSV input file is empty or missing valid rows.',
      });
      return { validRecords, errors };
    }

    this.rawRecords.forEach((row, idx) => {
      const rowIndex = idx + 1; // 1-indexed row number
      const { normalized, error } = normalizeAndValidateObservation(row, this.sourceType, rowIndex);

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
