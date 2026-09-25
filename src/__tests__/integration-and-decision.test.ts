import assert from 'node:assert';
import { test, describe } from 'node:test';
import { evaluateObservationConfidence } from '../services/confidence-engine';
import { generateExplainableRecommendation } from '../services/recommendation';
import { compareDailyGroundAndSatellite } from '../services/comparison';
import { normalizeAndValidateObservation } from '../providers/observation/normalizer';
import { ConduitCSVProvider } from '../providers/observation/conduit-csv';
import { ConduitJSONProvider } from '../providers/observation/conduit-json';
import { initializeDatabase } from '../db/init';
import { db } from '../db';
import * as schema from '../db/schema';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

describe('VERA Integration, Decision Engine & End-to-End Test Suite', () => {

  // Test 1: Zero-Rainfall Case Handling
  test('1. Zero-Rainfall Case Handling', () => {
    const zeroObs = {
      id: 'obs_zero_01',
      stationId: 'JKUAT_STATION_ZERO',
      timestamp: '2026-09-25T00:00:00.000Z',
      rainGauge1: 0.0,
      rainGauge2: 0.0,
      rainfallInstantaneous: 0.0,
      rainfallDaily: 0.0,
      temperature: 18.0,
      humidity: 60.0,
      pressure: 1015.0,
      windSpeed: 2.0,
      windGust: 3.0,
      windDirection: 90,
      sourceType: 'IMPORTED_CONDUIT_DATA' as const,
      rawPayload: {},
    };

    const res = evaluateObservationConfidence(zeroObs, []);
    assert.strictEqual(res.confidence, 'HIGH', 'Valid zero-rainfall record must evaluate to HIGH confidence');
    assert.strictEqual(res.reasonCodes.length, 0);
    assert.strictEqual(res.gaugeDisagreementRatio, 0);
  });

  // Test 2: Timestamp Ordering and Sorting
  test('2. Timestamp Ordering and Out-of-Order Records', () => {
    const rawList = [
      { timestamp: '2026-09-25T10:00:00Z', station_id: 'JKUAT', rainfall_instantaneous: 5.0 },
      { timestamp: '2026-09-25T08:00:00Z', station_id: 'JKUAT', rainfall_instantaneous: 2.0 },
      { timestamp: '2026-09-25T09:00:00Z', station_id: 'JKUAT', rainfall_instantaneous: 3.5 },
    ];

    const normalizedList = rawList.map((r, i) => normalizeAndValidateObservation(r, 'IMPORTED_CONDUIT_DATA', i + 1).normalized!);
    normalizedList.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

    assert.strictEqual(normalizedList[0].timestamp, '2026-09-25T08:00:00.000Z');
    assert.strictEqual(normalizedList[1].timestamp, '2026-09-25T09:00:00.000Z');
    assert.strictEqual(normalizedList[2].timestamp, '2026-09-25T10:00:00.000Z');
  });

  // Test 3: Decision Engine - Section 7 Outcomes
  test('3. Decision Engine Outcomes for High, Medium, Low, and Missing Confidence States', () => {
    // High + Satellite Agree
    const rec1 = generateExplainableRecommendation({
      stationId: 'JKUAT',
      date: '2026-09-25',
      localConfidence: 'HIGH',
      satelliteStatus: 'CLOSE_AGREEMENT',
      groundMm: 12.0,
      satelliteMm: 12.5,
    });
    assert.strictEqual(rec1.actionableRecommendation, 'Use local and satellite evidence together.');

    // High + Satellite Disagree
    const rec2 = generateExplainableRecommendation({
      stationId: 'JKUAT',
      date: '2026-09-25',
      localConfidence: 'HIGH',
      satelliteStatus: 'GROUND_HIGHER',
      groundMm: 45.0,
      satelliteMm: 5.0,
    });
    assert.ok(rec2.actionableRecommendation.includes('Local observation appears internally consistent'));

    // Medium Confidence
    const rec3 = generateExplainableRecommendation({
      stationId: 'JKUAT',
      date: '2026-09-25',
      localConfidence: 'MEDIUM',
      groundMm: 25.0,
    });
    assert.strictEqual(rec3.actionableRecommendation, 'Use with caution and review before automated downstream decisions.');

    // Low Confidence
    const rec4 = generateExplainableRecommendation({
      stationId: 'JKUAT',
      date: '2026-09-25',
      localConfidence: 'LOW',
      groundMm: 55.0,
    });
    assert.strictEqual(rec4.actionableRecommendation, 'Do not use this observation as a reliable local reference; inspect/review the station.');

    // Missing Data
    const rec5 = generateExplainableRecommendation({
      stationId: 'JKUAT',
      date: '2026-09-25',
      localConfidence: 'INSUFFICIENT',
      groundMm: null,
    });
    assert.strictEqual(rec5.actionableRecommendation, 'Local validation unavailable.');
  });

  // Test 4: Operator Action Database Persistence
  test('4. Operator Action Database Persistence', () => {
    initializeDatabase();

    const testAction = {
      id: `act_test_${uuidv4().substring(0, 8)}`,
      observationId: 'obs_test_persisted_01',
      action: 'ACCEPT_OBSERVATION',
      reasonContext: 'Dual gauges agree within 0.8% discrepancy and satellite corroborates ground catch.',
      operatorName: 'Senior Hydrologist',
      timestamp: new Date().toISOString(),
    };

    db.insert(schema.operatorActions).values(testAction).run();

    const fetched = db
      .select()
      .from(schema.operatorActions)
      .where(eq(schema.operatorActions.id, testAction.id))
      .all();

    assert.strictEqual(fetched.length, 1);
    assert.strictEqual(fetched[0].action, 'ACCEPT_OBSERVATION');
    assert.strictEqual(fetched[0].operatorName, 'Senior Hydrologist');
    assert.strictEqual(fetched[0].observationId, 'obs_test_persisted_01');
  });

  // Test 5: End-to-End Pipeline Execution (Ingestion -> QC -> Satellite -> Decision -> DB)
  test('5. End-to-End Pipeline Trace Execution', () => {
    initializeDatabase();

    const rawCSV = `timestamp,station_id,rain_gauge_1,rain_gauge_2,rainfall_instantaneous,temperature,humidity,pressure
2026-09-25T14:00:00Z,JKUAT_E2E_STATION,15.2,15.1,15.2,21.5,80.0,1012.5`;

    // 1. Ingest & Normalize
    const csvProvider = new ConduitCSVProvider(rawCSV);
    const { validRecords, errors } = csvProvider.parseAndValidate();
    assert.strictEqual(errors.length, 0);
    assert.strictEqual(validRecords.length, 1);

    const obs = validRecords[0];

    // 2. QC & Confidence Engine
    const evalRes = evaluateObservationConfidence(obs, []);
    assert.strictEqual(evalRes.confidence, 'HIGH');

    // 3. Satellite Comparison
    const satComp = compareDailyGroundAndSatellite(
      '2026-09-25',
      obs.stationId,
      { totalRainfallMm: obs.rainfallInstantaneous!, confidence: evalRes.confidence },
      14.8,
      'LIVE_CHIRPS_API'
    );
    assert.strictEqual(satComp.status, 'CLOSE_AGREEMENT');

    // 4. Recommendation Generation
    const rec = generateExplainableRecommendation({
      stationId: obs.stationId,
      date: '2026-09-25',
      localConfidence: evalRes.confidence,
      satelliteStatus: satComp.status,
      groundMm: obs.rainfallInstantaneous,
      satelliteMm: 14.8,
    });
    assert.strictEqual(rec.actionableRecommendation, 'Use local and satellite evidence together.');

    // 5. Database Persistence Verification
    db.insert(schema.observations)
      .values({
        id: obs.id,
        stationId: obs.stationId,
        timestamp: obs.timestamp,
        rainGauge1: obs.rainGauge1,
        rainGauge2: obs.rainGauge2,
        rainfallInstantaneous: obs.rainfallInstantaneous,
        sourceType: obs.sourceType,
        createdAt: new Date().toISOString(),
      })
      .onConflictDoNothing()
      .run();

    const dbObs = db.select().from(schema.observations).where(eq(schema.observations.id, obs.id)).all();
    assert.strictEqual(dbObs.length, 1);
    assert.strictEqual(dbObs[0].stationId, 'JKUAT_E2E_STATION');
  });

});
