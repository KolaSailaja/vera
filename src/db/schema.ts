import { sqliteTable, text, real, integer } from 'drizzle-orm/sqlite-core';

// 1. Observations Table matching normalized environmental observation schema
export const observations = sqliteTable('observations', {
  id: text('id').primaryKey(),
  stationId: text('station_id').notNull(),
  timestamp: text('timestamp').notNull(),
  rainGauge1: real('rain_gauge_1'),
  rainGauge2: real('rain_gauge_2'),
  rainfallInstantaneous: real('rainfall_instantaneous'),
  rainfallDaily: real('rainfall_daily'),
  temperature: real('temperature'),
  humidity: real('humidity'),
  pressure: real('pressure'),
  windSpeed: real('wind_speed'),
  windGust: real('wind_gust'),
  windDirection: real('wind_direction'),
  sourceType: text('source_type').notNull(), // 'LIVE_CONDUIT' | 'IMPORTED_CONDUIT_DATA' | 'NO_DATA'
  rawPayload: text('raw_payload'),
  createdAt: text('created_at').notNull(),
});

// 2. Quality Evaluations Table (Confidence Engine Output)
export const qualityEvaluations = sqliteTable('quality_evaluations', {
  id: text('id').primaryKey(),
  observationId: text('observation_id').notNull().references(() => observations.id),
  stationId: text('station_id').notNull(),
  timestamp: text('timestamp').notNull(),
  confidence: text('confidence').notNull(), // 'HIGH' | 'MEDIUM' | 'LOW' | 'INSUFFICIENT'
  reasonCodes: text('reason_codes').notNull(), // JSON array string
  gaugeDifferenceMm: real('gauge_difference_mm'),
  gaugeDisagreementRatio: real('gauge_disagreement_ratio'),
  evidenceJson: text('evidence_json').notNull(),
  explanation: text('explanation').notNull(),
  evaluatedAt: text('evaluated_at').notNull(),
});

// 3. Quality Flags Table
export const qualityFlags = sqliteTable('quality_flags', {
  id: text('id').primaryKey(),
  observationId: text('observation_id').notNull().references(() => observations.id),
  flagCode: text('flag_code').notNull(),
  severity: text('severity').notNull(), // 'INFO' | 'WARNING' | 'CRITICAL'
  reason: text('reason').notNull(),
  evaluatedAt: text('evaluated_at').notNull(),
});

// 4. Daily Rainfall Table
export const dailyRainfall = sqliteTable('daily_rainfall', {
  id: text('id').primaryKey(),
  stationId: text('station_id').notNull(),
  date: text('date').notNull(),
  totalRainfallMm: real('total_rainfall_mm').notNull(),
  observationCount: integer('observation_count').notNull(),
  validObservationCount: integer('valid_observation_count').notNull(),
  trustCategory: text('trust_category').notNull(), // 'TRUSTWORTHY' | 'FAULTY' | 'DISAGREEMENT' | 'INSUFFICIENT_DATA'
  createdAt: text('created_at').notNull(),
});

// 5. Satellite Rainfall Table
export const satelliteRainfall = sqliteTable('satellite_rainfall', {
  id: text('id').primaryKey(),
  productName: text('product_name').notNull(),
  lat: real('lat').notNull(),
  lon: real('lon').notNull(),
  date: text('date').notNull(),
  rainfallMm: real('rainfall_mm').notNull(),
  confidenceScore: real('confidence_score').notNull(),
  fetchedAt: text('fetched_at').notNull(),
});

// 6. Comparisons Table
export const comparisons = sqliteTable('comparisons', {
  id: text('id').primaryKey(),
  stationId: text('station_id').notNull(),
  dailyRainfallId: text('daily_rainfall_id').references(() => dailyRainfall.id),
  satelliteRainfallId: text('satellite_rainfall_id').references(() => satelliteRainfall.id),
  date: text('date').notNull(),
  stationMm: real('station_mm').notNull(),
  satelliteMm: real('satellite_mm').notNull(),
  differenceMm: real('difference_mm').notNull(),
  discrepancyRatio: real('discrepancy_ratio').notNull(),
  trustClassification: text('trust_classification').notNull(),
  explanation: text('explanation').notNull(),
  createdAt: text('created_at').notNull(),
});

// 7. Recommendations Table
export const recommendations = sqliteTable('recommendations', {
  id: text('id').primaryKey(),
  comparisonId: text('comparison_id').references(() => comparisons.id),
  date: text('date').notNull(),
  stationId: text('station_id').notNull(),
  actionableRecommendation: text('actionable_recommendation').notNull(),
  evidenceSummary: text('evidence_summary').notNull(),
  trustScore: real('trust_score').notNull(),
  status: text('status').notNull().default('OPEN'),
  createdAt: text('created_at').notNull(),
});

// 8. Operator Actions Table (Persistent Decision Support Actions)
export const operatorActions = sqliteTable('operator_actions', {
  id: text('id').primaryKey(),
  observationId: text('observation_id').notNull(),
  action: text('action').notNull(), // 'ACCEPT_OBSERVATION' | 'MARK_FOR_REVIEW' | 'REQUEST_INSPECTION' | 'ACKNOWLEDGE_MISMATCH'
  reasonContext: text('reason_context').notNull(),
  operatorName: text('operator_name').notNull().default('Operator'),
  timestamp: text('timestamp').notNull(),
});

export const operatorFeedback = operatorActions;
