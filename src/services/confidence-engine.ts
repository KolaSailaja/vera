import { NormalizedObservation } from '../providers/types';
import { getQualityConfig, QualityConfig } from '../config/quality';

export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW' | 'INSUFFICIENT';

export type ReasonCode =
  | 'MISSING_SENSOR'
  | 'GAUGE_DISAGREEMENT'
  | 'SUDDEN_SPIKE'
  | 'STALE_STREAM'
  | 'INVALID_VALUE'
  | 'TEMPORAL_INCONSISTENCY'
  | 'CUMULATIVE_MISMATCH'
  | 'DUPLICATE_TIMESTAMP';

export interface CheckDetail {
  checkName: string;
  reasonCode: ReasonCode;
  passed: boolean;
  message: string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  metrics?: Record<string, number | string | null>;
}

export interface EvaluationEvidence {
  measured: {
    rainGauge1: number | null;
    rainGauge2: number | null;
    rainfallInstantaneous: number | null;
    rainfallDaily: number | null;
    temperature: number | null;
    humidity: number | null;
    pressure: number | null;
    windSpeed: number | null;
    windGust: number | null;
    windDirection: number | null;
  };
  calculations: {
    gaugeDifferenceMm: number | null;
    gaugeDisagreementRatio: number | null;
    dailyAccumulatedMm: number | null;
    dailyReportedMm: number | null;
  };
  checksTriggered: CheckDetail[];
  reasonCodes: ReasonCode[];
  timestamp: string;
  stationId: string;
}

export interface ConfidenceEvaluationResult {
  id: string;
  observationId: string;
  stationId: string;
  timestamp: string;
  confidence: ConfidenceLevel;
  reasonCodes: ReasonCode[];
  gaugeDifferenceMm: number | null;
  gaugeDisagreementRatio: number | null;
  explanation: string;
  evidence: EvaluationEvidence;
  evaluatedAt: string;
}

/**
 * Deterministic Environmental Data-Confidence Engine
 * Evaluates reliability of local weather station observations using explainable quality rules.
 */
export function evaluateObservationConfidence(
  obs: NormalizedObservation,
  history: NormalizedObservation[] = [], // Preceding historical observations sorted asc by timestamp
  configOverride?: Partial<QualityConfig>
): ConfidenceEvaluationResult {
  const config = { ...getQualityConfig(), ...configOverride };
  const checks: CheckDetail[] = [];
  const reasonCodes: ReasonCode[] = [];

  const g1 = obs.rainGauge1;
  const g2 = obs.rainGauge2;
  const instRain = obs.rainfallInstantaneous;
  const dailyRain = obs.rainfallDaily;

  // 1. Missing-Data Check (MISSING_SENSOR)
  const hasAnyRainData = g1 !== null || g2 !== null || instRain !== null || dailyRain !== null;
  if (!hasAnyRainData) {
    reasonCodes.push('MISSING_SENSOR');
    checks.push({
      checkName: 'Missing-Data Check',
      reasonCode: 'MISSING_SENSOR',
      passed: false,
      severity: 'CRITICAL',
      message: 'Observation payload lacks all rainfall sensor parameters (Gauge 1, Gauge 2, Instantaneous, Daily).',
    });
  } else {
    checks.push({
      checkName: 'Missing-Data Check',
      reasonCode: 'MISSING_SENSOR',
      passed: true,
      severity: 'INFO',
      message: 'Rainfall observation parameters are present.',
    });
  }

  // 2. Invalid/Negative Rainfall Check (INVALID_VALUE)
  let hasInvalidValue = false;
  const rainfallValues = [g1, g2, instRain, dailyRain].filter((v): v is number => v !== null);

  for (const val of rainfallValues) {
    if (val < 0 || val > 300) {
      hasInvalidValue = true;
      break;
    }
  }

  if (hasInvalidValue) {
    reasonCodes.push('INVALID_VALUE');
    checks.push({
      checkName: 'Invalid/Negative Rainfall Check',
      reasonCode: 'INVALID_VALUE',
      passed: false,
      severity: 'CRITICAL',
      message: 'Physical boundary violation detected: Rainfall value cannot be negative or exceed 300mm.',
    });
  } else {
    checks.push({
      checkName: 'Invalid/Negative Rainfall Check',
      reasonCode: 'INVALID_VALUE',
      passed: true,
      severity: 'INFO',
      message: 'All rainfall measurements satisfy physical domain boundaries.',
    });
  }

  // 3. Duplicate Timestamp Check (DUPLICATE_TIMESTAMP)
  const duplicateRecord = history.find(
    (h) => h.id !== obs.id && h.stationId === obs.stationId && h.timestamp === obs.timestamp
  );
  if (duplicateRecord) {
    reasonCodes.push('DUPLICATE_TIMESTAMP');
    checks.push({
      checkName: 'Duplicate Timestamp Check',
      reasonCode: 'DUPLICATE_TIMESTAMP',
      passed: false,
      severity: 'WARNING',
      message: `Multiple telemetry entries recorded at exact timestamp ${obs.timestamp}. Potential duplication error.`,
    });
  } else {
    checks.push({
      checkName: 'Duplicate Timestamp Check',
      reasonCode: 'DUPLICATE_TIMESTAMP',
      passed: true,
      severity: 'INFO',
      message: 'Timestamp is unique within station stream.',
    });
  }

  // 4. Stale/Flatline Check (STALE_STREAM)
  let isStale = false;
  if (history.length >= config.staleStreamMinRecords - 1 && instRain !== null && instRain > 0) {
    const recent = history.slice(-(config.staleStreamMinRecords - 1));
    const allSame = recent.every((h) => h.rainfallInstantaneous === instRain);
    if (allSame) {
      isStale = true;
      reasonCodes.push('STALE_STREAM');
      checks.push({
        checkName: 'Stale/Flatline Stream Check',
        reasonCode: 'STALE_STREAM',
        passed: false,
        severity: 'WARNING',
        message: `Identical non-zero rainfall (${instRain} mm) repeated across ${config.staleStreamMinRecords} consecutive observations. Potential tipping bucket latch fault.`,
      });
    }
  }

  if (!isStale) {
    checks.push({
      checkName: 'Stale/Flatline Stream Check',
      reasonCode: 'STALE_STREAM',
      passed: true,
      severity: 'INFO',
      message: 'Telemetry stream exhibits expected variability.',
    });
  }

  // 5. Sudden Isolated Spike Check (SUDDEN_SPIKE)
  let isSpike = false;
  const currentRain = instRain ?? g1 ?? g2;
  if (currentRain !== null && currentRain >= config.spikeThresholdMm && history.length > 0) {
    const prev = history[history.length - 1];
    const prevRain = prev.rainfallInstantaneous ?? prev.rainGauge1 ?? 0;
    if (prevRain < 2.0 && currentRain - prevRain >= config.spikeThresholdMm) {
      isSpike = true;
      reasonCodes.push('SUDDEN_SPIKE');
      checks.push({
        checkName: 'Sudden Isolated Spike Check',
        reasonCode: 'SUDDEN_SPIKE',
        passed: false,
        severity: 'WARNING',
        message: `Sudden precipitation spike detected (${currentRain} mm vs preceding ${prevRain} mm). Review recommended.`,
        metrics: { spikeValueMm: currentRain, previousValueMm: prevRain },
      });
    }
  }

  if (!isSpike) {
    checks.push({
      checkName: 'Sudden Isolated Spike Check',
      reasonCode: 'SUDDEN_SPIKE',
      passed: true,
      severity: 'INFO',
      message: 'No isolated extreme precipitation spikes observed.',
    });
  }

  // 6. Dual-Gauge Disagreement Check (GAUGE_DISAGREEMENT)
  let gaugeDiffMm: number | null = null;
  let gaugeDisagreementRatio: number | null = null;
  let isGaugeDisagreement = false;

  if (g1 !== null && g2 !== null && !isNaN(g1) && !isNaN(g2)) {
    gaugeDiffMm = Math.round(Math.abs(g1 - g2) * 100) / 100;
    const avgGauge = (g1 + g2) / 2;
    const denominator = Math.max(config.gaugeEpsilon, avgGauge);
    gaugeDisagreementRatio = Math.round((gaugeDiffMm / denominator) * 1000) / 1000;

    if (
      gaugeDisagreementRatio > config.gaugeDisagreementTolerance &&
      gaugeDiffMm >= config.gaugeMinDiffMm
    ) {
      isGaugeDisagreement = true;
      reasonCodes.push('GAUGE_DISAGREEMENT');
      checks.push({
        checkName: 'Dual-Gauge Disagreement Check',
        reasonCode: 'GAUGE_DISAGREEMENT',
        passed: false,
        severity: 'WARNING',
        message: `Potential observation-quality issue: Gauge disagreement detected between Rain Gauge 1 (${g1} mm) and Rain Gauge 2 (${g2} mm) with discrepancy ratio ${gaugeDisagreementRatio}. Review recommended.`,
        metrics: {
          gauge1Mm: g1,
          gauge2Mm: g2,
          differenceMm: gaugeDiffMm,
          discrepancyRatio: gaugeDisagreementRatio,
        },
      });
    }
  }

  if (!isGaugeDisagreement) {
    checks.push({
      checkName: 'Dual-Gauge Disagreement Check',
      reasonCode: 'GAUGE_DISAGREEMENT',
      passed: true,
      severity: 'INFO',
      message:
        g1 !== null && g2 !== null
          ? `Rain Gauge 1 (${g1} mm) and Rain Gauge 2 (${g2} mm) agree within physical tolerance.`
          : 'Single gauge observation present; dual-gauge cross-validation skipped.',
    });
  }

  // 7. Temporal Consistency Check (TEMPORAL_INCONSISTENCY)
  let isTemporalInconsistent = false;
  if (history.length > 0 && currentRain !== null) {
    const prev = history[history.length - 1];
    const prevRain = prev.rainfallInstantaneous ?? prev.rainGauge1 ?? 0;
    const delta = Math.abs(currentRain - prevRain);

    if (delta > config.temporalMaxDeltaMm) {
      isTemporalInconsistent = true;
      reasonCodes.push('TEMPORAL_INCONSISTENCY');
      checks.push({
        checkName: 'Temporal Consistency Check',
        reasonCode: 'TEMPORAL_INCONSISTENCY',
        passed: false,
        severity: 'WARNING',
        message: `Abrupt temporal step change of ${delta} mm observed between consecutive observations (${prevRain} mm → ${currentRain} mm).`,
        metrics: { deltaMm: delta, thresholdMm: config.temporalMaxDeltaMm },
      });
    }
  }

  if (!isTemporalInconsistent) {
    checks.push({
      checkName: 'Temporal Consistency Check',
      reasonCode: 'TEMPORAL_INCONSISTENCY',
      passed: true,
      severity: 'INFO',
      message: 'Temporal rate of change complies with physical limits.',
    });
  }

  // 8. Cumulative-Total Consistency Check (CUMULATIVE_MISMATCH)
  let isCumulativeMismatch = false;
  let dailyAccumulatedMm: number | null = null;
  if (dailyRain !== null && history.length > 0) {
    const obsDate = obs.timestamp.split('T')[0];
    const sameDayObs = history.filter((h) => h.timestamp.startsWith(obsDate));
    const sameDaySum = sameDayObs.reduce(
      (sum, h) => sum + (h.rainfallInstantaneous ?? h.rainGauge1 ?? 0),
      0
    );
    dailyAccumulatedMm = Math.round((sameDaySum + (instRain ?? g1 ?? 0)) * 100) / 100;

    const maxRef = Math.max(config.gaugeEpsilon, dailyRain, dailyAccumulatedMm);
    const cumDiff = Math.abs(dailyAccumulatedMm - dailyRain);
    const cumRatio = cumDiff / maxRef;

    if (cumDiff > 5.0 && cumRatio > config.cumulativeMismatchToleranceRatio) {
      isCumulativeMismatch = true;
      reasonCodes.push('CUMULATIVE_MISMATCH');
      checks.push({
        checkName: 'Cumulative-Total Consistency Check',
        reasonCode: 'CUMULATIVE_MISMATCH',
        passed: false,
        severity: 'WARNING',
        message: `Mismatch between daily accumulated total (${dailyAccumulatedMm} mm) and station reported daily total (${dailyRain} mm).`,
        metrics: { accumulatedMm: dailyAccumulatedMm, reportedDailyMm: dailyRain },
      });
    }
  }

  if (!isCumulativeMismatch) {
    checks.push({
      checkName: 'Cumulative-Total Consistency Check',
      reasonCode: 'CUMULATIVE_MISMATCH',
      passed: true,
      severity: 'INFO',
      message: 'Cumulative rainfall totals align with instantaneous observation totals.',
    });
  }

  // ----------------------------------------------------
  // DETERMINISTIC CONFIDENCE RATING ALGORITHM
  // ----------------------------------------------------
  let confidence: ConfidenceLevel = 'HIGH';

  if (hasInvalidValue || !hasAnyRainData) {
    confidence = 'INSUFFICIENT';
  } else if (reasonCodes.length >= 2) {
    confidence = 'LOW';
  } else if (reasonCodes.length === 1) {
    confidence = 'MEDIUM';
  } else {
    confidence = 'HIGH';
  }

  // Generate scientific, explainable summary rationale
  let explanation = '';
  if (confidence === 'HIGH') {
    explanation = 'Observation meets all quality control rules. Dual gauges agree and parameters fall within normal physical boundaries. High confidence for environmental evidence.';
  } else if (confidence === 'MEDIUM') {
    explanation = `Potential observation-quality issue detected: Triggered ${reasonCodes.join(', ')}. Review recommended before using as legal or environmental evidence.`;
  } else if (confidence === 'LOW') {
    explanation = `Multiple quality anomalies triggered (${reasonCodes.join(', ')}). Low confidence for environmental decision support; station maintenance inspection advised.`;
  } else {
    explanation = 'Insufficient or invalid data. Telemetry payload failed fundamental physical limit checks or lacks rainfall data.';
  }

  const evidence: EvaluationEvidence = {
    measured: {
      rainGauge1: g1,
      rainGauge2: g2,
      rainfallInstantaneous: instRain,
      rainfallDaily: dailyRain,
      temperature: obs.temperature,
      humidity: obs.humidity,
      pressure: obs.pressure,
      windSpeed: obs.windSpeed,
      windGust: obs.windGust,
      windDirection: obs.windDirection,
    },
    calculations: {
      gaugeDifferenceMm: gaugeDiffMm,
      gaugeDisagreementRatio,
      dailyAccumulatedMm,
      dailyReportedMm: dailyRain,
    },
    checksTriggered: checks,
    reasonCodes,
    timestamp: obs.timestamp,
    stationId: obs.stationId,
  };

  return {
    id: `eval_${obs.id}`,
    observationId: obs.id,
    stationId: obs.stationId,
    timestamp: obs.timestamp,
    confidence,
    reasonCodes,
    gaugeDifferenceMm: gaugeDiffMm,
    gaugeDisagreementRatio,
    explanation,
    evidence,
    evaluatedAt: new Date().toISOString(),
  };
}
