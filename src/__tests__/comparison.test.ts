import assert from 'node:assert';
import { test, describe } from 'node:test';
import {
  compareDailyGroundAndSatellite,
  calculateComparisonSummary,
  DailyComparisonResult,
} from '../services/comparison';
import { ChirpsSatelliteProvider } from '../providers/satellite/chirps-satellite';

describe('Satellite-Ground Comparison Layer Unit Test Suite', () => {
  // Test 1: Quality-Screening Gating - HIGH Confidence Ground Observation
  test('1. Quality-Screened HIGH confidence ground observation is used as reference evidence', () => {
    const res = compareDailyGroundAndSatellite(
      '2026-09-24',
      'JKUAT_MAIN',
      { totalRainfallMm: 15.0, confidence: 'HIGH' },
      14.5,
      'LIVE_CHIRPS_API'
    );

    assert.strictEqual(res.qualityScreenedPassed, true);
    assert.strictEqual(res.groundRainfallMm, 15.0);
    assert.strictEqual(res.chirpsRainfallMm, 14.5);
    assert.strictEqual(res.absoluteDifferenceMm, 0.5);
    assert.strictEqual(res.status, 'CLOSE_AGREEMENT');
    assert.ok(res.interpretation.includes('Local and satellite observations are broadly consistent'));
  });

  // Test 2: Quality-Screening Gating - LOW/INSUFFICIENT Local Confidence Defers Comparison
  test('2. LOW or INSUFFICIENT local confidence defers satellite comparison', () => {
    const resInsufficient = compareDailyGroundAndSatellite(
      '2026-09-24',
      'JKUAT_MAIN',
      { totalRainfallMm: 15.0, confidence: 'INSUFFICIENT' },
      14.5,
      'LIVE_CHIRPS_API'
    );

    assert.strictEqual(resInsufficient.qualityScreenedPassed, false);
    assert.strictEqual(resInsufficient.status, 'DEFERRED');
    assert.strictEqual(
      resInsufficient.interpretation,
      'There is not enough evidence to establish local rainfall confidence.'
    );

    const resLow = compareDailyGroundAndSatellite(
      '2026-09-24',
      'JKUAT_MAIN',
      { totalRainfallMm: 0.0, confidence: 'LOW' },
      10.0,
      'LIVE_CHIRPS_API'
    );

    assert.strictEqual(resLow.qualityScreenedPassed, false);
    assert.strictEqual(resLow.status, 'DEFERRED');
    assert.strictEqual(
      resLow.interpretation,
      'Local observation may contain a data-quality issue. Review the station before using it as ground evidence.'
    );
  });

  // Test 3: Neutral Language Rationale Assertions
  test('3. Interpretation uses neutral scientific language and never blames sensor or satellite as wrong', () => {
    const resHigher = compareDailyGroundAndSatellite(
      '2026-09-24',
      'JKUAT_MAIN',
      { totalRainfallMm: 25.0, confidence: 'HIGH' },
      10.0,
      'LIVE_CHIRPS_API'
    );

    assert.strictEqual(resHigher.status, 'GROUND_HIGHER');
    assert.ok(resHigher.interpretation.includes('satellite rainfall differs'));
    assert.ok(!resHigher.interpretation.includes('CHIRPS is wrong'));
    assert.ok(!resHigher.interpretation.includes('broken'));

    const resLower = compareDailyGroundAndSatellite(
      '2026-09-24',
      'JKUAT_MAIN',
      { totalRainfallMm: 5.0, confidence: 'HIGH' },
      18.0,
      'LIVE_CHIRPS_API'
    );

    assert.strictEqual(resLower.status, 'GROUND_LOWER');
    assert.ok(resLower.interpretation.includes('satellite rainfall differs'));
    assert.ok(!resLower.interpretation.includes('CHIRPS is wrong'));
    assert.ok(!resLower.interpretation.includes('sensor is broken'));
  });

  // Test 4: Statistical Metrics Calculation Across Valid Samples (Bias, MAE, RMSE, Pearson r)
  test('4. Statistical summary computes Bias, MAE, RMSE, and Correlation when N >= 3', () => {
    const sampleResults: DailyComparisonResult[] = [
      compareDailyGroundAndSatellite('2026-09-20', 'STN', { totalRainfallMm: 10.0, confidence: 'HIGH' }, 8.0), // Diff: +2
      compareDailyGroundAndSatellite('2026-09-21', 'STN', { totalRainfallMm: 15.0, confidence: 'HIGH' }, 12.0), // Diff: +3
      compareDailyGroundAndSatellite('2026-09-22', 'STN', { totalRainfallMm: 20.0, confidence: 'HIGH' }, 19.0), // Diff: +1
      compareDailyGroundAndSatellite('2026-09-23', 'STN', { totalRainfallMm: 5.0, confidence: 'INSUFFICIENT' }, 10.0), // Deferred
    ];

    const summary = calculateComparisonSummary(sampleResults);
    assert.strictEqual(summary.totalDays, 4);
    assert.strictEqual(summary.qualityScreenedValidDays, 3);
    assert.strictEqual(summary.deferredDays, 1);
    assert.strictEqual(summary.sufficientSamples, true);

    // Valid samples ground: [10, 15, 20], chirps: [8, 12, 19]
    // Diffs: [+2, +3, +1] -> Sum diff = 6 -> Bias = 2.0 mm
    // Abs diffs: [2, 3, 1] -> MAE = 2.0 mm
    // Square diffs: [4, 9, 1] -> Mean = 14/3 = 4.666 -> RMSE = 2.16 mm
    assert.strictEqual(summary.metrics.biasMm, 2.0);
    assert.strictEqual(summary.metrics.maeMm, 2.0);
    assert.strictEqual(summary.metrics.rmseMm, 2.16);
    assert.ok(summary.metrics.correlation !== null && summary.metrics.correlation > 0.9);
  });

  // Test 5: Insufficient Samples Guard (N < 3)
  test('5. Summary stats return null metrics when quality-screened samples N < 3', () => {
    const sampleResults: DailyComparisonResult[] = [
      compareDailyGroundAndSatellite('2026-09-20', 'STN', { totalRainfallMm: 10.0, confidence: 'HIGH' }, 8.0),
      compareDailyGroundAndSatellite('2026-09-21', 'STN', { totalRainfallMm: 5.0, confidence: 'INSUFFICIENT' }, 12.0),
    ];

    const summary = calculateComparisonSummary(sampleResults);
    assert.strictEqual(summary.qualityScreenedValidDays, 1);
    assert.strictEqual(summary.sufficientSamples, false);
    assert.strictEqual(summary.metrics.biasMm, null);
    assert.strictEqual(summary.metrics.maeMm, null);
    assert.strictEqual(summary.metrics.rmseMm, null);
    assert.strictEqual(summary.metrics.correlation, null);
  });

  // Test 6: CHIRPS Provider Source Type Labeling
  test('6. CHIRPS Satellite Provider correctly distinguishes live vs imported datasets', () => {
    const provider = new ChirpsSatelliteProvider();

    const liveRecord = provider.normalize({
      date: '2026-09-24',
      rainfallMm: 12.4,
      sourceType: 'LIVE_CHIRPS_API',
    });
    assert.strictEqual(liveRecord.productName, 'CHIRPS_V2_DAILY');

    const importedRecord = provider.normalize({
      date: '2026-09-24',
      rainfallMm: 12.4,
      sourceType: 'IMPORTED_CHIRPS_DATA',
    });
    assert.strictEqual(importedRecord.productName, 'CHIRPS_V2_DAILY_IMPORTED');
    assert.strictEqual(
      (importedRecord.rawPayload as any).sourceTypeLabel,
      'Downloaded CHIRPS Dataset (Imported)'
    );
  });
});
