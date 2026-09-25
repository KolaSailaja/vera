import assert from 'node:assert';
import { test, describe } from 'node:test';
import { evaluateObservationConfidence } from '../services/confidence-engine';
import { NormalizedObservation } from '../providers/types';

describe('Environmental Data-Confidence Engine Unit Test Suite', () => {

  const baseObs: NormalizedObservation = {
    id: 'obs_test_100',
    stationId: 'JKUAT_STATION_TEST',
    timestamp: '2026-09-24T12:00:00.000Z',
    rainGauge1: 10.0,
    rainGauge2: 10.2,
    rainfallInstantaneous: 10.0,
    rainfallDaily: 25.0,
    temperature: 22.0,
    humidity: 75.0,
    pressure: 1013.25,
    windSpeed: 3.5,
    windGust: 5.0,
    windDirection: 180,
    sourceType: 'IMPORTED_CONDUIT_DATA',
    rawPayload: {},
  };

  // Rule 1: Missing-Data Check (MISSING_SENSOR)
  test('Rule 1: MISSING_SENSOR check triggers when rainfall data is absent', () => {
    const missingObs: NormalizedObservation = {
      ...baseObs,
      rainGauge1: null,
      rainGauge2: null,
      rainfallInstantaneous: null,
      rainfallDaily: null,
    };

    const res = evaluateObservationConfidence(missingObs, []);
    assert.strictEqual(res.confidence, 'INSUFFICIENT');
    assert.ok(res.reasonCodes.includes('MISSING_SENSOR'));
  });

  // Rule 2: Invalid/Negative Rainfall Check (INVALID_VALUE)
  test('Rule 2: INVALID_VALUE check triggers on negative rainfall', () => {
    const invalidObs: NormalizedObservation = {
      ...baseObs,
      rainfallInstantaneous: -15.0,
    };

    const res = evaluateObservationConfidence(invalidObs, []);
    assert.strictEqual(res.confidence, 'INSUFFICIENT');
    assert.ok(res.reasonCodes.includes('INVALID_VALUE'));
  });

  // Rule 3: Duplicate Timestamp Check (DUPLICATE_TIMESTAMP)
  test('Rule 3: DUPLICATE_TIMESTAMP check triggers on matching timestamp entries', () => {
    const duplicateHistory: NormalizedObservation[] = [{ ...baseObs, id: 'obs_test_99' }];

    const res = evaluateObservationConfidence(baseObs, duplicateHistory);
    assert.ok(res.reasonCodes.includes('DUPLICATE_TIMESTAMP'));
  });

  // Rule 4: Stale/Flatline Stream Check (STALE_STREAM)
  test('Rule 4: STALE_STREAM check triggers on repeated identical non-zero readings', () => {
    const staleVal = 12.4;
    const history: NormalizedObservation[] = [
      { ...baseObs, id: 'h1', timestamp: '2026-09-24T08:00:00.000Z', rainfallInstantaneous: staleVal },
      { ...baseObs, id: 'h2', timestamp: '2026-09-24T09:00:00.000Z', rainfallInstantaneous: staleVal },
      { ...baseObs, id: 'h3', timestamp: '2026-09-24T10:00:00.000Z', rainfallInstantaneous: staleVal },
    ];

    const current: NormalizedObservation = {
      ...baseObs,
      id: 'h4',
      timestamp: '2026-09-24T11:00:00.000Z',
      rainfallInstantaneous: staleVal,
    };

    const res = evaluateObservationConfidence(current, history);
    assert.ok(res.reasonCodes.includes('STALE_STREAM'));
  });

  // Rule 5: Sudden Isolated Spike Check (SUDDEN_SPIKE)
  test('Rule 5: SUDDEN_SPIKE check triggers on extreme isolated jump', () => {
    const history: NormalizedObservation[] = [
      { ...baseObs, id: 'h1', timestamp: '2026-09-24T08:00:00.000Z', rainfallInstantaneous: 0.0, rainGauge1: 0.0 },
    ];

    const spikeObs: NormalizedObservation = {
      ...baseObs,
      id: 'h2',
      timestamp: '2026-09-24T09:00:00.000Z',
      rainfallInstantaneous: 65.0,
      rainGauge1: 65.0,
    };

    const res = evaluateObservationConfidence(spikeObs, history);
    assert.ok(res.reasonCodes.includes('SUDDEN_SPIKE'));
  });

  // Rule 6: Dual-Gauge Disagreement Check (GAUGE_DISAGREEMENT)
  test('Rule 6: GAUGE_DISAGREEMENT check triggers when relative difference exceeds tolerance', () => {
    const disagreeingObs: NormalizedObservation = {
      ...baseObs,
      rainGauge1: 5.0,
      rainGauge2: 25.0,
    };

    const res = evaluateObservationConfidence(disagreeingObs, []);
    assert.ok(res.reasonCodes.includes('GAUGE_DISAGREEMENT'));
    assert.ok(res.gaugeDifferenceMm !== null && res.gaugeDifferenceMm === 20.0);
    assert.ok(res.gaugeDisagreementRatio !== null && res.gaugeDisagreementRatio > 0.25);
    
    const gaugeChk = res.evidence.checksTriggered.find((c) => c.reasonCode === 'GAUGE_DISAGREEMENT');
    assert.ok(gaugeChk && gaugeChk.message.includes('Gauge disagreement detected'));
    assert.ok(gaugeChk && !gaugeChk.message.includes('definitely broken'), 'Must never say sensor is definitely broken');
  });

  // Rule 7: Temporal Consistency Check (TEMPORAL_INCONSISTENCY)
  test('Rule 7: TEMPORAL_INCONSISTENCY check triggers on large step changes', () => {
    const history: NormalizedObservation[] = [
      { ...baseObs, id: 'h1', timestamp: '2026-09-24T08:00:00.000Z', rainfallInstantaneous: 0.0 },
    ];

    const abruptObs: NormalizedObservation = {
      ...baseObs,
      id: 'h2',
      timestamp: '2026-09-24T09:00:00.000Z',
      rainfallInstantaneous: 45.0,
    };

    const res = evaluateObservationConfidence(abruptObs, history);
    assert.ok(res.reasonCodes.includes('TEMPORAL_INCONSISTENCY'));
  });

  // Rule 8: Cumulative-Total Consistency Check (CUMULATIVE_MISMATCH)
  test('Rule 8: CUMULATIVE_MISMATCH check triggers when daily sum deviates from reported daily total', () => {
    const history: NormalizedObservation[] = [
      { ...baseObs, id: 'h1', timestamp: '2026-09-24T08:00:00.000Z', rainfallInstantaneous: 2.0, rainGauge1: 2.0 },
    ];

    const mismatchObs: NormalizedObservation = {
      ...baseObs,
      id: 'h2',
      timestamp: '2026-09-24T09:00:00.000Z',
      rainfallInstantaneous: 3.0,
      rainGauge1: 3.0,
      rainfallDaily: 80.0,
    };

    const res = evaluateObservationConfidence(mismatchObs, history);
    assert.ok(res.reasonCodes.includes('CUMULATIVE_MISMATCH'));
  });

  // Rule 9: Configurable Tolerance Test
  test('Rule 9: Configurable tolerance override dynamically adjusts gauge disagreement threshold', () => {
    const obs: NormalizedObservation = {
      ...baseObs,
      rainGauge1: 10.0,
      rainGauge2: 12.0, // D = 2 / 11 = 0.1818 (18.18%)
    };

    // With default tolerance 0.25 (25%), D = 18.18% PASSES (no flag)
    const defaultRes = evaluateObservationConfidence(obs, []);
    assert.strictEqual(defaultRes.reasonCodes.includes('GAUGE_DISAGREEMENT'), false);

    // With stricter override tolerance 0.10 (10%), D = 18.18% TRIGGERS GAUGE_DISAGREEMENT
    const strictRes = evaluateObservationConfidence(obs, [], { gaugeDisagreementTolerance: 0.10 });
    assert.strictEqual(strictRes.reasonCodes.includes('GAUGE_DISAGREEMENT'), true);
  });

  // MANDATORY PROOF TEST: Agreeing Gauges -> Higher Confidence than Strongly Disagreeing Pair
  test('Mandatory Proof: Two agreeing gauges produce higher confidence than a strongly disagreeing pair', () => {
    const agreeingGaugesObs: NormalizedObservation = {
      ...baseObs,
      id: 'agreeing_obs',
      rainGauge1: 12.0,
      rainGauge2: 12.2,
      rainfallInstantaneous: 12.0,
    };

    const disagreeingGaugesObs: NormalizedObservation = {
      ...baseObs,
      id: 'disagreeing_obs',
      rainGauge1: 5.0,
      rainGauge2: 30.0,
      rainfallInstantaneous: 5.0,
    };

    const evalAgree = evaluateObservationConfidence(agreeingGaugesObs, []);
    const evalDisagree = evaluateObservationConfidence(disagreeingGaugesObs, []);

    assert.strictEqual(evalAgree.confidence, 'HIGH', 'Agreeing gauges should produce HIGH confidence');
    assert.strictEqual(evalDisagree.confidence, 'MEDIUM', 'Disagreeing gauges should produce lower confidence (MEDIUM)');
    assert.strictEqual(evalAgree.reasonCodes.length, 0, 'Agreeing gauges should trigger 0 reason codes');
    assert.ok(evalDisagree.reasonCodes.includes('GAUGE_DISAGREEMENT'), 'Disagreeing gauges must trigger GAUGE_DISAGREEMENT');
  });

});
