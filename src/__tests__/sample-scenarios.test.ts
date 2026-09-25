import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateObservationConfidence } from '../services/confidence-engine';
import { compareDailyGroundAndSatellite } from '../services/comparison';
import { generateExplainableRecommendation } from '../services/recommendation';
import { NormalizedObservation } from '../providers/types';

describe('VERA Production Acceptance - 5 Customer Test Scenarios', () => {

  // CASE 1: Two local gauges agree and satellite rainfall is similar
  it('CASE 1: Two local gauges agree and satellite rainfall is similar -> HIGH confidence + agreement', () => {
    const obs: NormalizedObservation = {
      id: 'obs_case1',
      stationId: 'JKUAT_MAIN',
      timestamp: '2026-09-25T08:00:00Z',
      rainGauge1: 12.5,
      rainGauge2: 12.4,
      rainfallInstantaneous: 12.5,
      rainfallDaily: 25.0,
      temperature: 22.4,
      humidity: 78.5,
      pressure: 1013.25,
      windSpeed: 3.4,
      windGust: 5.1,
      windDirection: 180,
      sourceType: 'LIVE_CONDUIT',
      rawPayload: {},
    };

    const evalResult = evaluateObservationConfidence(obs, []);
    assert.equal(evalResult.confidence, 'HIGH');
    assert.deepEqual(evalResult.reasonCodes, []);

    const compResult = compareDailyGroundAndSatellite(
      '2026-09-25',
      'JKUAT_MAIN',
      { totalRainfallMm: 12.5, confidence: evalResult.confidence },
      12.0
    );

    assert.equal(compResult.qualityScreenedPassed, true);
    assert.equal(compResult.status, 'CLOSE_AGREEMENT');
    assert.equal(compResult.interpretation, 'Local and satellite observations are broadly consistent.');

    const recResult = generateExplainableRecommendation({
      stationId: 'JKUAT_MAIN',
      date: '2026-09-25',
      localConfidence: evalResult.confidence,
      satelliteStatus: compResult.status,
      groundMm: 12.5,
      satelliteMm: 12.0,
    });

    assert.equal(recResult.trustScore, 0.95);
    assert.equal(recResult.actionableRecommendation, 'Use local and satellite evidence together.');
  });

  // CASE 2: Two local gauges strongly disagree
  it('CASE 2: Two local gauges strongly disagree -> GAUGE_DISAGREEMENT flag + reduced confidence', () => {
    const obs: NormalizedObservation = {
      id: 'obs_case2',
      stationId: 'JKUAT_MAIN',
      timestamp: '2026-09-25T09:00:00Z',
      rainGauge1: 28.0,
      rainGauge2: 3.0,
      rainfallInstantaneous: 28.0,
      rainfallDaily: 28.0,
      temperature: 21.0,
      humidity: 82.0,
      pressure: 1011.5,
      windSpeed: null,
      windGust: null,
      windDirection: null,
      sourceType: 'LIVE_CONDUIT',
      rawPayload: {},
    };

    const evalResult = evaluateObservationConfidence(obs, []);
    assert.equal(evalResult.confidence, 'MEDIUM');
    assert.ok(evalResult.reasonCodes.includes('GAUGE_DISAGREEMENT'));

    const compResult = compareDailyGroundAndSatellite(
      '2026-09-25',
      'JKUAT_MAIN',
      { totalRainfallMm: 28.0, confidence: evalResult.confidence },
      25.0
    );

    assert.equal(compResult.qualityScreenedPassed, true);
    assert.equal(compResult.interpretation, 'Evidence is incomplete or conflicting. Avoid automated decisions until reviewed.');

    const recResult = generateExplainableRecommendation({
      stationId: 'JKUAT_MAIN',
      date: '2026-09-25',
      localConfidence: evalResult.confidence,
      satelliteStatus: compResult.status,
      groundMm: 28.0,
      satelliteMm: 25.0,
    });

    assert.equal(recResult.trustScore, 0.60);
    assert.equal(recResult.actionableRecommendation, 'Use with caution and review before automated downstream decisions.');
  });

  // CASE 3: Local gauges agree strongly but satellite rainfall differs significantly
  it('CASE 3: Local gauges agree strongly but satellite rainfall differs -> HIGH local confidence + satellite mismatch interpretation', () => {
    const obs: NormalizedObservation = {
      id: 'obs_case3',
      stationId: 'JKUAT_MAIN',
      timestamp: '2026-09-25T10:00:00Z',
      rainGauge1: 45.0,
      rainGauge2: 44.8,
      rainfallInstantaneous: 45.0,
      rainfallDaily: 45.0,
      temperature: 19.5,
      humidity: 90.0,
      pressure: 1008.2,
      windSpeed: null,
      windGust: null,
      windDirection: null,
      sourceType: 'LIVE_CONDUIT',
      rawPayload: {},
    };

    const evalResult = evaluateObservationConfidence(obs, []);
    assert.equal(evalResult.confidence, 'HIGH');
    assert.deepEqual(evalResult.reasonCodes, []);

    const compResult = compareDailyGroundAndSatellite(
      '2026-09-25',
      'JKUAT_MAIN',
      { totalRainfallMm: 45.0, confidence: evalResult.confidence },
      4.5
    );

    assert.equal(compResult.qualityScreenedPassed, true);
    assert.equal(compResult.status, 'GROUND_HIGHER');
    assert.equal(
      compResult.interpretation,
      'Local gauges are internally consistent, but satellite rainfall differs. Treat the local measurement as site-level evidence and the satellite estimate as regional context.'
    );

    const recResult = generateExplainableRecommendation({
      stationId: 'JKUAT_MAIN',
      date: '2026-09-25',
      localConfidence: evalResult.confidence,
      satelliteStatus: compResult.status,
      groundMm: 45.0,
      satelliteMm: 4.5,
    });

    assert.equal(recResult.trustScore, 0.80);
    assert.equal(
      recResult.actionableRecommendation,
      'Local observation appears internally consistent; satellite disagreement should be treated as a spatial/data-source mismatch requiring context.'
    );
  });

  // CASE 4: Stale observation stream
  it('CASE 4: Stale observation stream -> STALE_STREAM flag + appropriate warning', () => {
    const history: NormalizedObservation[] = [
      { id: 'h1', stationId: 'S1', timestamp: '2026-09-25T07:00:00Z', rainGauge1: 15.0, rainGauge2: 15.0, rainfallInstantaneous: 15.0, rainfallDaily: 15.0, temperature: 20, humidity: 80, pressure: 1012, windSpeed: 2, windGust: 3, windDirection: 180, sourceType: 'LIVE_CONDUIT', rawPayload: {} },
      { id: 'h2', stationId: 'S1', timestamp: '2026-09-25T07:15:00Z', rainGauge1: 15.0, rainGauge2: 15.0, rainfallInstantaneous: 15.0, rainfallDaily: 15.0, temperature: 20, humidity: 80, pressure: 1012, windSpeed: 2, windGust: 3, windDirection: 180, sourceType: 'LIVE_CONDUIT', rawPayload: {} },
      { id: 'h3', stationId: 'S1', timestamp: '2026-09-25T07:30:00Z', rainGauge1: 15.0, rainGauge2: 15.0, rainfallInstantaneous: 15.0, rainfallDaily: 15.0, temperature: 20, humidity: 80, pressure: 1012, windSpeed: 2, windGust: 3, windDirection: 180, sourceType: 'LIVE_CONDUIT', rawPayload: {} },
    ];

    const currentObs: NormalizedObservation = {
      id: 'h4',
      stationId: 'S1',
      timestamp: '2026-09-25T07:45:00Z',
      rainGauge1: 15.0,
      rainGauge2: 15.0,
      rainfallInstantaneous: 15.0,
      rainfallDaily: 15.0,
      temperature: 20,
      humidity: 80,
      pressure: 1012,
      windSpeed: 2,
      windGust: 3,
      windDirection: 180,
      sourceType: 'LIVE_CONDUIT',
      rawPayload: {},
    };

    const evalResult = evaluateObservationConfidence(currentObs, history);
    assert.equal(evalResult.confidence, 'LOW');
    assert.ok(evalResult.reasonCodes.includes('STALE_STREAM'));
  });

  // CASE 5: Insufficient observations / missing sensor parameters
  it('CASE 5: Insufficient observations -> INSUFFICIENT confidence + non-misleading recommendation', () => {
    const obs: NormalizedObservation = {
      id: 'obs_case5',
      stationId: 'JKUAT_MAIN',
      timestamp: '2026-09-25T12:00:00Z',
      rainGauge1: null,
      rainGauge2: null,
      rainfallInstantaneous: null,
      rainfallDaily: null,
      temperature: 24.0,
      humidity: 60.0,
      pressure: 1015.0,
      windSpeed: 3.0,
      windGust: 4.5,
      windDirection: 90,
      sourceType: 'LIVE_CONDUIT',
      rawPayload: {},
    };

    const evalResult = evaluateObservationConfidence(obs, []);
    assert.equal(evalResult.confidence, 'INSUFFICIENT');
    assert.ok(evalResult.reasonCodes.includes('MISSING_SENSOR'));

    const compResult = compareDailyGroundAndSatellite(
      '2026-09-25',
      'JKUAT_MAIN',
      { totalRainfallMm: 0, confidence: evalResult.confidence },
      8.5
    );

    assert.equal(compResult.qualityScreenedPassed, false);
    assert.equal(compResult.status, 'DEFERRED');
    assert.equal(compResult.interpretation, 'There is not enough evidence to establish local rainfall confidence.');

    const recResult = generateExplainableRecommendation({
      stationId: 'JKUAT_MAIN',
      date: '2026-09-25',
      localConfidence: evalResult.confidence,
      satelliteStatus: compResult.status,
      groundMm: null,
      satelliteMm: 8.5,
    });

    assert.equal(recResult.trustScore, 0.0);
    assert.equal(recResult.actionableRecommendation, 'Local validation unavailable.');
  });
});
