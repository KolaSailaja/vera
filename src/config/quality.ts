export interface QualityConfig {
  gaugeDisagreementTolerance: number; // e.g. 0.25 (25%)
  gaugeEpsilon: number; // e.g. 0.1
  gaugeMinDiffMm: number; // e.g. 1.0 mm absolute minimum diff to trigger flag
  spikeThresholdMm: number; // e.g. 40.0 mm
  staleStreamMinRecords: number; // e.g. 4 consecutive records
  temporalMaxDeltaMm: number; // e.g. 30.0 mm jump
  cumulativeMismatchToleranceRatio: number; // e.g. 0.3 (30%)
}

export function getQualityConfig(): QualityConfig {
  return {
    gaugeDisagreementTolerance: process.env.GAUGE_DISAGREEMENT_TOLERANCE
      ? parseFloat(process.env.GAUGE_DISAGREEMENT_TOLERANCE)
      : 0.25,
    gaugeEpsilon: process.env.GAUGE_EPSILON
      ? parseFloat(process.env.GAUGE_EPSILON)
      : 0.1,
    gaugeMinDiffMm: process.env.GAUGE_MIN_DIFF_MM
      ? parseFloat(process.env.GAUGE_MIN_DIFF_MM)
      : 1.0,
    spikeThresholdMm: process.env.SPIKE_THRESHOLD_MM
      ? parseFloat(process.env.SPIKE_THRESHOLD_MM)
      : 40.0,
    staleStreamMinRecords: process.env.STALE_STREAM_MIN_RECORDS
      ? parseInt(process.env.STALE_STREAM_MIN_RECORDS, 10)
      : 4,
    temporalMaxDeltaMm: process.env.TEMPORAL_MAX_DELTA_MM
      ? parseFloat(process.env.TEMPORAL_MAX_DELTA_MM)
      : 30.0,
    cumulativeMismatchToleranceRatio: process.env.CUMULATIVE_MISMATCH_TOLERANCE_RATIO
      ? parseFloat(process.env.CUMULATIVE_MISMATCH_TOLERANCE_RATIO)
      : 0.3,
  };
}
