import { ConfidenceLevel } from './confidence-engine';
import { TrustCategory } from '../providers/types';

export type ComparisonStatus =
  | 'CLOSE_AGREEMENT'
  | 'GROUND_HIGHER'
  | 'GROUND_LOWER'
  | 'DEFERRED'
  | 'UNAVAILABLE';

export interface DailyComparisonResult {
  id: string;
  stationId: string;
  date: string;
  groundRainfallMm: number | null;
  chirpsRainfallMm: number;
  absoluteDifferenceMm: number | null;
  relativeDifferenceRatio: number | null;
  localConfidence: ConfidenceLevel;
  qualityScreenedPassed: boolean;
  status: ComparisonStatus;
  interpretation: string;
  sourceType: string;
  evaluatedAt: string;
}

export interface SummaryStatistics {
  totalDays: number;
  qualityScreenedValidDays: number;
  deferredDays: number;
  sampleCount: number;
  sufficientSamples: boolean; // true if N >= 3
  metrics: {
    biasMm: number | null;
    maeMm: number | null;
    rmseMm: number | null;
    correlation: number | null;
  };
  note: string;
}

export interface ComparisonResult {
  id: string;
  stationId: string;
  dailyRainfallId: string;
  satelliteRainfallId: string;
  date: string;
  stationMm: number;
  satelliteMm: number;
  differenceMm: number;
  discrepancyRatio: number;
  trustClassification: TrustCategory;
  explanation: string;
  createdAt: string;
}

/**
 * Compare local Conduit ground observation against CHIRPS satellite estimate for a single day.
 * Enforces local quality-screening gating before using ground observation as reference evidence.
 */
export function compareDailyGroundAndSatellite(
  date: string,
  stationId: string,
  groundObservation: {
    totalRainfallMm: number;
    confidence: ConfidenceLevel;
  } | null,
  chirpsRainfallMm: number,
  chirpsSourceType: string = 'LIVE_CHIRPS_API'
): DailyComparisonResult {
  const id = `comp_${stationId}_${date}`;
  const localConfidence = groundObservation?.confidence || 'INSUFFICIENT';

  if (chirpsSourceType === 'SATELLITE_UNAVAILABLE') {
    return {
      id,
      stationId,
      date,
      groundRainfallMm: groundObservation?.totalRainfallMm ?? null,
      chirpsRainfallMm: 0.0,
      absoluteDifferenceMm: null,
      relativeDifferenceRatio: null,
      localConfidence,
      qualityScreenedPassed: groundObservation !== null && (localConfidence === 'HIGH' || localConfidence === 'MEDIUM'),
      status: 'UNAVAILABLE',
      interpretation: 'Satellite comparison unavailable for this date. Local quality control screening completed.',
      sourceType: 'SATELLITE_UNAVAILABLE',
      evaluatedAt: new Date().toISOString(),
    };
  }

  // Quality-Screening Gating: Only HIGH or MEDIUM local confidence observations can serve as ground truth reference.
  const qualityScreenedPassed =
    groundObservation !== null &&
    (localConfidence === 'HIGH' || localConfidence === 'MEDIUM');

  let deferredInterpretation = 'Satellite comparison deferred because local observation quality is insufficient.';
  if (localConfidence === 'INSUFFICIENT') {
    deferredInterpretation = 'There is not enough evidence to establish local rainfall confidence.';
  } else if (localConfidence === 'LOW') {
    deferredInterpretation = 'Local observation may contain a data-quality issue. Review the station before using it as ground evidence.';
  } else if (localConfidence === 'MEDIUM') {
    deferredInterpretation = 'Evidence is incomplete or conflicting. Avoid automated decisions until reviewed.';
  }

  if (!qualityScreenedPassed) {
    return {
      id,
      stationId,
      date,
      groundRainfallMm: groundObservation?.totalRainfallMm ?? null,
      chirpsRainfallMm: Math.round(chirpsRainfallMm * 100) / 100,
      absoluteDifferenceMm: null,
      relativeDifferenceRatio: null,
      localConfidence,
      qualityScreenedPassed: false,
      status: 'DEFERRED',
      interpretation: deferredInterpretation,
      sourceType: chirpsSourceType,
      evaluatedAt: new Date().toISOString(),
    };
  }

  const groundMm = Math.round(groundObservation!.totalRainfallMm * 100) / 100;
  const chirpsMm = Math.round(chirpsRainfallMm * 100) / 100;
  const rawDiff = groundMm - chirpsMm;
  const absoluteDifferenceMm = Math.round(Math.abs(rawDiff) * 100) / 100;

  // Calculate relative difference ratio where mathematically valid
  let relativeDifferenceRatio: number | null = null;
  if (groundMm > 0) {
    relativeDifferenceRatio = Math.round((absoluteDifferenceMm / groundMm) * 1000) / 1000;
  } else if (chirpsMm > 0) {
    relativeDifferenceRatio = Math.round((absoluteDifferenceMm / chirpsMm) * 1000) / 1000;
  } else {
    relativeDifferenceRatio = 0.0;
  }

  let status: ComparisonStatus = 'CLOSE_AGREEMENT';
  let interpretation = '';

  const ABSOLUTE_TOLERANCE_MM = 2.0;
  const RELATIVE_TOLERANCE_RATIO = 0.20;

  if (
    absoluteDifferenceMm <= ABSOLUTE_TOLERANCE_MM ||
    (relativeDifferenceRatio !== null && relativeDifferenceRatio <= RELATIVE_TOLERANCE_RATIO)
  ) {
    status = 'CLOSE_AGREEMENT';
    interpretation = localConfidence === 'MEDIUM'
      ? 'Evidence is incomplete or conflicting. Avoid automated decisions until reviewed.'
      : 'Local and satellite observations are broadly consistent.';
  } else if (groundMm > chirpsMm) {
    status = 'GROUND_HIGHER';
    interpretation = localConfidence === 'MEDIUM'
      ? 'Evidence is incomplete or conflicting. Avoid automated decisions until reviewed.'
      : 'Local gauges are internally consistent, but satellite rainfall differs. Treat the local measurement as site-level evidence and the satellite estimate as regional context.';
  } else {
    status = 'GROUND_LOWER';
    interpretation = localConfidence === 'MEDIUM'
      ? 'Evidence is incomplete or conflicting. Avoid automated decisions until reviewed.'
      : 'Local gauges are internally consistent, but satellite rainfall differs. Treat the local measurement as site-level evidence and the satellite estimate as regional context.';
  }

  return {
    id,
    stationId,
    date,
    groundRainfallMm: groundMm,
    chirpsRainfallMm: chirpsMm,
    absoluteDifferenceMm,
    relativeDifferenceRatio,
    localConfidence,
    qualityScreenedPassed: true,
    status,
    interpretation,
    sourceType: chirpsSourceType,
    evaluatedAt: new Date().toISOString(),
  };
}

/**
 * Legacy/Aggregate comparison helper function for pipeline backward compatibility.
 */
export function compareStationAndSatellite(
  dailyRainfall: {
    id: string;
    stationId: string;
    date: string;
    totalRainfallMm: number;
    trustCategory: TrustCategory;
    validObservationCount: number;
  },
  satelliteRainfall: {
    id: string;
    rainfallMm: number;
  }
): ComparisonResult {
  const stationMm = dailyRainfall.totalRainfallMm;
  const satelliteMm = satelliteRainfall.rainfallMm;
  const differenceMm = Math.round((stationMm - satelliteMm) * 100) / 100;
  const maxVal = Math.max(stationMm, satelliteMm, 1.0);
  const discrepancyRatio = Math.round((Math.abs(differenceMm) / maxVal) * 100) / 100;

  let trustClassification: TrustCategory = dailyRainfall.trustCategory;
  let explanation = '';

  if (dailyRainfall.trustCategory === 'FAULTY') {
    trustClassification = 'FAULTY';
    explanation = `Local weather station failed physical quality checks. Ground truth cannot be established due to local sensor fault.`;
  } else if (dailyRainfall.trustCategory === 'INSUFFICIENT_DATA') {
    trustClassification = 'INSUFFICIENT_DATA';
    explanation = `Insufficient ground observations available for ${dailyRainfall.date}. Satellite reported ${satelliteMm} mm.`;
  } else {
    const ABSOLUTE_THRESHOLD_MM = 8.0;
    const RATIO_THRESHOLD = 0.4;

    if (Math.abs(differenceMm) > ABSOLUTE_THRESHOLD_MM && discrepancyRatio > RATIO_THRESHOLD) {
      trustClassification = 'DISAGREEMENT';
      explanation = `Quality-screened ground station recorded ${stationMm} mm while satellite estimated ${satelliteMm} mm (difference: ${differenceMm > 0 ? '+' : ''}${differenceMm} mm). Discrepancy may stem from micro-climate convective showers or satellite pixel spatial averaging.`;
    } else {
      trustClassification = 'TRUSTWORTHY';
      explanation = `Quality-screened ground station observation (${stationMm} mm) aligns closely with satellite estimate (${satelliteMm} mm) within physical tolerance.`;
    }
  }

  return {
    id: `comp_${dailyRainfall.stationId}_${dailyRainfall.date}`,
    stationId: dailyRainfall.stationId,
    dailyRainfallId: dailyRainfall.id,
    satelliteRainfallId: satelliteRainfall.id,
    date: dailyRainfall.date,
    stationMm,
    satelliteMm,
    differenceMm,
    discrepancyRatio,
    trustClassification,
    explanation,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Calculate Summary Statistics (Bias, MAE, RMSE, Pearson Correlation)
 * Only computes statistics across valid quality-screened observations when N >= 3.
 */
export function calculateComparisonSummary(
  dailyResults: DailyComparisonResult[]
): SummaryStatistics {
  const totalDays = dailyResults.length;
  const validResults = dailyResults.filter(
    (r) => r.qualityScreenedPassed && r.groundRainfallMm !== null && r.chirpsRainfallMm !== null
  );

  const qualityScreenedValidDays = validResults.length;
  const deferredDays = totalDays - qualityScreenedValidDays;
  const MIN_SAMPLE_COUNT = 3;

  if (qualityScreenedValidDays < MIN_SAMPLE_COUNT) {
    return {
      totalDays,
      qualityScreenedValidDays,
      deferredDays,
      sampleCount: qualityScreenedValidDays,
      sufficientSamples: false,
      metrics: {
        biasMm: null,
        maeMm: null,
        rmseMm: null,
        correlation: null,
      },
      note: `Insufficient quality-screened samples (${qualityScreenedValidDays} valid days available, minimum ${MIN_SAMPLE_COUNT} required) to calculate statistical metrics.`,
    };
  }

  const N = validResults.length;
  let sumDiff = 0;
  let sumAbsDiff = 0;
  let sumSquareDiff = 0;

  let sumGround = 0;
  let sumChirps = 0;

  for (const r of validResults) {
    const g = r.groundRainfallMm!;
    const s = r.chirpsRainfallMm;
    const diff = g - s;

    sumDiff += diff;
    sumAbsDiff += Math.abs(diff);
    sumSquareDiff += diff * diff;

    sumGround += g;
    sumChirps += s;
  }

  const biasMm = Math.round((sumDiff / N) * 100) / 100;
  const maeMm = Math.round((sumAbsDiff / N) * 100) / 100;
  const rmseMm = Math.round(Math.sqrt(sumSquareDiff / N) * 100) / 100;

  // Pearson Correlation Coefficient calculation
  const meanGround = sumGround / N;
  const meanChirps = sumChirps / N;

  let numCorrelation = 0;
  let denGround = 0;
  let denChirps = 0;

  for (const r of validResults) {
    const gDiff = r.groundRainfallMm! - meanGround;
    const sDiff = r.chirpsRainfallMm - meanChirps;

    numCorrelation += gDiff * sDiff;
    denGround += gDiff * gDiff;
    denChirps += sDiff * sDiff;
  }

  let correlation: number | null = null;
  const denom = Math.sqrt(denGround * denChirps);

  if (denom > 0) {
    correlation = Math.round((numCorrelation / denom) * 1000) / 1000;
  } else {
    correlation = 1.0;
  }

  return {
    totalDays,
    qualityScreenedValidDays,
    deferredDays,
    sampleCount: N,
    sufficientSamples: true,
    metrics: {
      biasMm,
      maeMm,
      rmseMm,
      correlation,
    },
    note: `Summary statistics computed across ${N} quality-screened ground reference observations.`,
  };
}
