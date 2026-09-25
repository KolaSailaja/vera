import { NormalizedObservation, TrustCategory } from '../providers/types';

export interface QualityFlagResult {
  id: string;
  observationId: string;
  flagCode: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  reason: string;
  evaluatedAt: string;
}

export interface DailyAggregationResult {
  id: string;
  stationId: string;
  date: string;
  totalRainfallMm: number;
  observationCount: number;
  validObservationCount: number;
  trustCategory: TrustCategory;
  flags: QualityFlagResult[];
}

export function evaluateObservationQuality(obs: NormalizedObservation): QualityFlagResult[] {
  const flags: QualityFlagResult[] = [];
  const now = new Date().toISOString();

  const rainfallVal = obs.rainfallInstantaneous ?? obs.rainfallDaily ?? obs.rainGauge1;

  // 1. Missing Rainfall Check
  if (rainfallVal === null || rainfallVal === undefined || isNaN(rainfallVal)) {
    flags.push({
      id: `qflag_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      observationId: obs.id,
      flagCode: 'MISSING_RAINFALL',
      severity: 'CRITICAL',
      reason: 'Observation payload does not contain a valid numerical rainfall value.',
      evaluatedAt: now,
    });
  } else {
    // 2. Physical Range Check for Rainfall
    if (rainfallVal < 0) {
      flags.push({
        id: `qflag_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        observationId: obs.id,
        flagCode: 'RANGE_FAIL_NEGATIVE',
        severity: 'CRITICAL',
        reason: `Physical limit violation: Rainfall cannot be negative (${rainfallVal} mm).`,
        evaluatedAt: now,
      });
    } else if (rainfallVal > 250) {
      flags.push({
        id: `qflag_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        observationId: obs.id,
        flagCode: 'RANGE_FAIL_HIGH',
        severity: 'WARNING',
        reason: `Extreme value alert: Hourly rainfall exceeds 250mm (${rainfallVal} mm). Requires verification.`,
        evaluatedAt: now,
      });
    }
  }

  // 3. Pressure Check if present
  if (obs.pressure !== null && obs.pressure !== undefined && (obs.pressure < 800 || obs.pressure > 1100)) {
    flags.push({
      id: `qflag_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      observationId: obs.id,
      flagCode: 'PRESSURE_OUT_OF_RANGE',
      severity: 'WARNING',
      reason: `Barometric pressure is out of standard atmospheric bounds (${obs.pressure} hPa).`,
      evaluatedAt: now,
    });
  }

  // If no negative or critical flags found
  if (flags.length === 0) {
    flags.push({
      id: `qflag_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      observationId: obs.id,
      flagCode: 'PASSED',
      severity: 'INFO',
      reason: 'Observation passed all quality screening checks.',
      evaluatedAt: now,
    });
  }

  return flags;
}

export function aggregateDailyRainfall(
  stationId: string,
  date: string, // YYYY-MM-DD
  observations: NormalizedObservation[]
): DailyAggregationResult {
  const allFlags: QualityFlagResult[] = [];
  let totalRainfallMm = 0;
  let validObservationCount = 0;
  let hasCriticalFailure = false;

  for (const obs of observations) {
    const flags = evaluateObservationQuality(obs);
    allFlags.push(...flags);

    const isCritical = flags.some((f) => f.severity === 'CRITICAL');
    const rainfallVal = obs.rainfallInstantaneous ?? obs.rainfallDaily ?? obs.rainGauge1;

    if (isCritical) {
      hasCriticalFailure = true;
    } else if (rainfallVal !== null && rainfallVal !== undefined && rainfallVal >= 0) {
      totalRainfallMm += rainfallVal;
      validObservationCount++;
    }
  }

  let trustCategory: TrustCategory = 'TRUSTWORTHY';

  if (observations.length < 1) {
    trustCategory = 'INSUFFICIENT_DATA';
  } else if (hasCriticalFailure) {
    trustCategory = 'FAULTY';
  } else if (validObservationCount < 1) {
    trustCategory = 'INSUFFICIENT_DATA';
  }

  return {
    id: `daily_${stationId}_${date}`,
    stationId,
    date,
    totalRainfallMm: Math.round(totalRainfallMm * 100) / 100,
    observationCount: observations.length,
    validObservationCount,
    trustCategory,
    flags: allFlags,
  };
}
