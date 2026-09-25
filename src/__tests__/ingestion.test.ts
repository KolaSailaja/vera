import assert from 'node:assert';
import { test, describe } from 'node:test';
import { normalizeAndValidateObservation } from '../providers/observation/normalizer';
import { ConduitCSVProvider, parseCSVString } from '../providers/observation/conduit-csv';
import { ConduitJSONProvider } from '../providers/observation/conduit-json';

describe('Environmental Ingestion & Validation Test Suite', () => {

  // Test 1: Valid Observation
  test('1. Valid Observation Normalization', () => {
    const raw = {
      timestamp: '2026-09-24T08:00:00Z',
      station_id: 'JKUAT_MAIN_STATION',
      rain_gauge_1: 10.5,
      rain_gauge_2: 10.4,
      rainfall_instantaneous: 10.5,
      rainfall_daily: 25.0,
      temperature: 22.5,
      humidity: 75.0,
      pressure: 1013.25,
      wind_speed: 4.5,
      wind_gust: 7.2,
      wind_direction: 180,
    };

    const { normalized, error } = normalizeAndValidateObservation(raw, 'IMPORTED_CONDUIT_DATA', 1);

    assert.strictEqual(error, null, 'Error should be null for valid observation');
    assert.ok(normalized !== null, 'Normalized observation should be returned');
    assert.strictEqual(normalized.stationId, 'JKUAT_MAIN_STATION');
    assert.strictEqual(normalized.rainfallInstantaneous, 10.5);
    assert.strictEqual(normalized.temperature, 22.5);
    assert.strictEqual(normalized.pressure, 1013.25);
    assert.strictEqual(normalized.sourceType, 'IMPORTED_CONDUIT_DATA');
  });

  // Test 2: Missing Timestamp
  test('2. Missing Timestamp Error Handling', () => {
    const raw = {
      station_id: 'JKUAT_MAIN_STATION',
      rainfall_instantaneous: 5.0,
      temperature: 20.0,
    };

    const { normalized, error } = normalizeAndValidateObservation(raw, 'IMPORTED_CONDUIT_DATA', 1);

    assert.strictEqual(normalized, null, 'Normalized observation should be null when timestamp is missing');
    assert.ok(error !== null, 'Validation error should be returned');
    assert.strictEqual(error.field, 'timestamp');
    assert.ok(error.message.includes('Missing required observation timestamp'));
  });

  // Test 3: Invalid Rainfall (Negative)
  test('3. Invalid Negative Rainfall Validation', () => {
    const raw = {
      timestamp: '2026-09-24T08:00:00Z',
      station_id: 'JKUAT_MAIN_STATION',
      rainfall_instantaneous: -45.0, // Invalid negative value
    };

    const { normalized, error } = normalizeAndValidateObservation(raw, 'IMPORTED_CONDUIT_DATA', 1);

    assert.strictEqual(normalized, null, 'Normalized record should be null for negative rainfall');
    assert.ok(error !== null, 'Validation error should be returned');
    assert.strictEqual(error.field, 'rainfall_instantaneous');
    assert.ok(error.message.includes('cannot be negative'));
  });

  // Test 4: Malformed CSV & Error Detection
  test('4. Malformed CSV Processing', () => {
    const csvContent = `timestamp,station_id,rainfall_instantaneous
2026-09-24T08:00:00Z,JKUAT_STATION_1,12.0
,JKUAT_STATION_1,15.0
2026-09-24T10:00:00Z,JKUAT_STATION_1,-10.0`;

    const csvProvider = new ConduitCSVProvider(csvContent);
    const { validRecords, errors } = csvProvider.parseAndValidate();

    assert.strictEqual(validRecords.length, 1, 'Should parse exactly 1 valid record');
    assert.strictEqual(errors.length, 2, 'Should catch 2 validation errors (missing timestamp and negative rain)');
    assert.strictEqual(errors[0].field, 'timestamp');
    assert.strictEqual(errors[1].field, 'rainfall_instantaneous');
  });

  // Test 5: Duplicate Record ID Generation
  test('5. Duplicate Record Identifier Determinism', () => {
    const raw1 = {
      timestamp: '2026-09-24T08:00:00.000Z',
      station_id: 'JKUAT_STATION_DUP',
      rainfall_instantaneous: 10.0,
    };

    const raw2 = {
      timestamp: '2026-09-24T08:00:00.000Z',
      station_id: 'JKUAT_STATION_DUP',
      rainfall_instantaneous: 10.0,
    };

    const res1 = normalizeAndValidateObservation(raw1, 'IMPORTED_CONDUIT_DATA', 1);
    const res2 = normalizeAndValidateObservation(raw2, 'IMPORTED_CONDUIT_DATA', 2);

    assert.ok(res1.normalized && res2.normalized);
    assert.strictEqual(
      res1.normalized.id,
      res2.normalized.id,
      'Identical station + timestamp must produce identical deterministic IDs for database duplicate detection'
    );
  });

  // Test 6: Missing Optional Sensor Fields (No invented values)
  test('6. Missing Optional Sensor Fields Are Preserved As Null', () => {
    const raw = {
      timestamp: '2026-09-24T08:00:00Z',
      station_id: 'JKUAT_MINIMAL_STATION',
      rainfall_instantaneous: 3.5,
    };

    const { normalized, error } = normalizeAndValidateObservation(raw, 'IMPORTED_CONDUIT_DATA', 1);

    assert.strictEqual(error, null);
    assert.ok(normalized !== null);
    assert.strictEqual(normalized.rainfallInstantaneous, 3.5);
    assert.strictEqual(normalized.rainGauge1, null, 'Unsupplied rain_gauge_1 must remain null');
    assert.strictEqual(normalized.rainGauge2, null, 'Unsupplied rain_gauge_2 must remain null');
    assert.strictEqual(normalized.temperature, null, 'Unsupplied temperature must remain null');
    assert.strictEqual(normalized.humidity, null, 'Unsupplied humidity must remain null');
    assert.strictEqual(normalized.pressure, null, 'Unsupplied pressure must remain null');
    assert.strictEqual(normalized.windSpeed, null, 'Unsupplied wind_speed must remain null');
  });

});
