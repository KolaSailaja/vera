import { ComparisonResult } from './comparison';
import { ConfidenceLevel } from './confidence-engine';

export interface RecommendationResult {
  id: string;
  comparisonId?: string;
  date: string;
  stationId: string;
  actionableRecommendation: string;
  evidenceSummary: string;
  trustScore: number;
  status: 'OPEN' | 'REVIEWED' | 'DISMISSED';
  createdAt: string;
}

export interface RecommendationInputs {
  stationId: string;
  date: string;
  localConfidence: ConfidenceLevel;
  satelliteStatus?: 'CLOSE_AGREEMENT' | 'GROUND_HIGHER' | 'GROUND_LOWER' | 'DEFERRED' | 'UNAVAILABLE';
  groundMm?: number | null;
  satelliteMm?: number | null;
}

/**
 * Generate an explainable, data-driven recommendation based on quality evidence and satellite agreement.
 */
export function generateExplainableRecommendation(inputs: RecommendationInputs): RecommendationResult {
  const { stationId, date, localConfidence, satelliteStatus, groundMm, satelliteMm } = inputs;
  let actionableRecommendation = '';
  let evidenceSummary = '';
  let trustScore = 1.0;

  if (localConfidence === 'INSUFFICIENT' || groundMm === null || groundMm === undefined) {
    trustScore = 0.0;
    actionableRecommendation = 'Local validation unavailable.';
    evidenceSummary = `Insufficient ground observation data recorded for date ${date}. Satellite reported ${satelliteMm ?? 0.0} mm.`;
  } else if (localConfidence === 'LOW') {
    trustScore = 0.25;
    actionableRecommendation = 'Do not use this observation as a reliable local reference; inspect/review the station.';
    evidenceSummary = `Local station observation failed multiple physical quality checks. Hardware maintenance inspection advised before using as environmental ground truth.`;
  } else if (localConfidence === 'MEDIUM') {
    trustScore = 0.60;
    actionableRecommendation = 'Use with caution and review before automated downstream decisions.';
    evidenceSummary = `Observation triggered a physical quality anomaly flag (e.g. gauge disagreement or stale stream). Station telemetry requires manual verification.`;
  } else if (localConfidence === 'HIGH') {
    if (satelliteStatus === 'CLOSE_AGREEMENT') {
      trustScore = 0.95;
      actionableRecommendation = 'Use local and satellite evidence together.';
      evidenceSummary = `Quality-screened ground observation (${groundMm} mm) aligns closely with CHIRPS satellite estimate (${satelliteMm ?? 0.0} mm).`;
    } else {
      trustScore = 0.80;
      actionableRecommendation =
        'Local observation appears internally consistent; satellite disagreement should be treated as a spatial/data-source mismatch requiring context.';
      evidenceSummary = `Ground observation (${groundMm} mm) differs from satellite grid estimate (${satelliteMm ?? 0.0} mm). Discrepancy likely stems from point gauge catch vs. ~5.5km satellite pixel spatial averaging.`;
    }
  } else {
    trustScore = 0.50;
    actionableRecommendation = 'Use with caution and review before automated downstream decisions.';
    evidenceSummary = `Observation state requires operator evaluation.`;
  }

  return {
    id: `rec_${stationId}_${date}`,
    date,
    stationId,
    actionableRecommendation,
    evidenceSummary,
    trustScore,
    status: 'OPEN',
    createdAt: new Date().toISOString(),
  };
}

/**
 * Legacy wrapper for ComparisonResult backward compatibility.
 */
export function generateRecommendation(comp: ComparisonResult): RecommendationResult {
  let localConf: ConfidenceLevel = 'HIGH';
  let satStatus: 'CLOSE_AGREEMENT' | 'GROUND_HIGHER' | 'GROUND_LOWER' | 'DEFERRED' = 'CLOSE_AGREEMENT';

  if (comp.trustClassification === 'FAULTY') {
    localConf = 'LOW';
  } else if (comp.trustClassification === 'INSUFFICIENT_DATA') {
    localConf = 'INSUFFICIENT';
  } else if (comp.trustClassification === 'DISAGREEMENT') {
    localConf = 'HIGH';
    satStatus = comp.stationMm > comp.satelliteMm ? 'GROUND_HIGHER' : 'GROUND_LOWER';
  }

  const rec = generateExplainableRecommendation({
    stationId: comp.stationId,
    date: comp.date,
    localConfidence: localConf,
    satelliteStatus: satStatus,
    groundMm: comp.stationMm,
    satelliteMm: comp.satelliteMm,
  });

  return {
    ...rec,
    comparisonId: comp.id,
  };
}

