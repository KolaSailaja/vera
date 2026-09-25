import { sqliteClient } from './index';

export function initializeDatabase() {
  sqliteClient.exec(`
    CREATE TABLE IF NOT EXISTS observations (
      id TEXT PRIMARY KEY,
      station_id TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      rain_gauge_1 REAL,
      rain_gauge_2 REAL,
      rainfall_instantaneous REAL,
      rainfall_daily REAL,
      temperature REAL,
      humidity REAL,
      pressure REAL,
      wind_speed REAL,
      wind_gust REAL,
      wind_direction REAL,
      source_type TEXT NOT NULL,
      raw_payload TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS quality_evaluations (
      id TEXT PRIMARY KEY,
      observation_id TEXT NOT NULL,
      station_id TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      confidence TEXT NOT NULL,
      reason_codes TEXT NOT NULL,
      gauge_difference_mm REAL,
      gauge_disagreement_ratio REAL,
      evidence_json TEXT NOT NULL,
      explanation TEXT NOT NULL,
      evaluated_at TEXT NOT NULL,
      FOREIGN KEY (observation_id) REFERENCES observations(id)
    );

    CREATE TABLE IF NOT EXISTS quality_flags (
      id TEXT PRIMARY KEY,
      observation_id TEXT NOT NULL,
      flag_code TEXT NOT NULL,
      severity TEXT NOT NULL,
      reason TEXT NOT NULL,
      evaluated_at TEXT NOT NULL,
      FOREIGN KEY (observation_id) REFERENCES observations(id)
    );

    CREATE TABLE IF NOT EXISTS daily_rainfall (
      id TEXT PRIMARY KEY,
      station_id TEXT NOT NULL,
      date TEXT NOT NULL,
      total_rainfall_mm REAL NOT NULL,
      observation_count INTEGER NOT NULL,
      valid_observation_count INTEGER NOT NULL,
      trust_category TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS satellite_rainfall (
      id TEXT PRIMARY KEY,
      product_name TEXT NOT NULL,
      lat REAL NOT NULL,
      lon REAL NOT NULL,
      date TEXT NOT NULL,
      rainfall_mm REAL NOT NULL,
      confidence_score REAL NOT NULL,
      fetched_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS comparisons (
      id TEXT PRIMARY KEY,
      station_id TEXT NOT NULL,
      daily_rainfall_id TEXT,
      satellite_rainfall_id TEXT,
      date TEXT NOT NULL,
      station_mm REAL NOT NULL,
      satellite_mm REAL NOT NULL,
      difference_mm REAL NOT NULL,
      discrepancy_ratio REAL NOT NULL,
      trust_classification TEXT NOT NULL,
      explanation TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (daily_rainfall_id) REFERENCES daily_rainfall(id),
      FOREIGN KEY (satellite_rainfall_id) REFERENCES satellite_rainfall(id)
    );

    CREATE TABLE IF NOT EXISTS recommendations (
      id TEXT PRIMARY KEY,
      comparison_id TEXT,
      date TEXT NOT NULL,
      station_id TEXT NOT NULL,
      actionable_recommendation TEXT NOT NULL,
      evidence_summary TEXT NOT NULL,
      trust_score REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'OPEN',
      created_at TEXT NOT NULL,
      FOREIGN KEY (comparison_id) REFERENCES comparisons(id)
    );

    CREATE TABLE IF NOT EXISTS operator_feedback (
      id TEXT PRIMARY KEY,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      operator_name TEXT NOT NULL,
      feedback_status TEXT NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS operator_actions (
      id TEXT PRIMARY KEY,
      observation_id TEXT NOT NULL,
      action TEXT NOT NULL,
      reason_context TEXT NOT NULL,
      operator_name TEXT NOT NULL DEFAULT 'Operator',
      timestamp TEXT NOT NULL
    );
  `);

  return { success: true, message: 'Database tables verified / initialized.' };
}
