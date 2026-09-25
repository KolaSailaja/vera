import { NextResponse } from 'next/server';
import { initializeDatabase } from '@/db/init';
import { db } from '@/db';
import * as schema from '@/db/schema';
import { ConduitLiveProvider } from '@/providers/observation/conduit-live';
import { ConduitCSVProvider } from '@/providers/observation/conduit-csv';
import { ConduitJSONProvider } from '@/providers/observation/conduit-json';
import { IngestionValidationError, NormalizedObservation, DataSourceType } from '@/providers/types';
import { evaluateObservationConfidence } from '@/services/confidence-engine';
import { aggregateDailyRainfall } from '@/services/evaluation';
import { compareStationAndSatellite } from '@/services/comparison';
import { generateRecommendation } from '@/services/recommendation';
import { getSatelliteProvider } from '@/providers';
import { eq, asc } from 'drizzle-orm';

export async function POST(req: Request) {
  try {
    initializeDatabase();

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      // Body can be empty for default ingestion
    }

    const sourceType: DataSourceType = body.sourceType || 'IMPORTED_CONDUIT_DATA';
    const format: 'CSV' | 'JSON' = body.format || 'JSON';
    const rawText: string | undefined = body.rawText;
    const rawArray: any[] | undefined = body.records;

    let validRecords: NormalizedObservation[] = [];
    let validationErrors: IngestionValidationError[] = [];
    let providerName = '';

    if (sourceType === 'LIVE_CONDUIT') {
      const liveProvider = new ConduitLiveProvider();
      providerName = liveProvider.name;

      const liveStatus = await liveProvider.getStatus();
      if (!liveStatus.available) {
        return NextResponse.json(
          {
            success: false,
            sourceType: 'LIVE_CONDUIT',
            providerName,
            statusMessage: liveStatus.statusMessage,
            importedCount: 0,
            skippedDuplicatesCount: 0,
            validationErrors: [
              {
                row: 0,
                field: 'connection',
                message: liveStatus.statusMessage,
              },
            ],
            timestamp: new Date().toISOString(),
          },
          { status: 503 }
        );
      }

      try {
        validRecords = await liveProvider.fetchHistorical({ limit: 100 });
      } catch (err: any) {
        validationErrors.push({
          row: 0,
          field: 'api',
          message: err?.message || 'Failed to fetch observations from Conduit API',
        });
      }
    } else if (format === 'CSV') {
      const csvProvider = new ConduitCSVProvider(rawText || []);
      providerName = csvProvider.name;
      const parsed = csvProvider.parseAndValidate();
      validRecords = parsed.validRecords;
      validationErrors = parsed.errors;
    } else {
      const jsonProvider = new ConduitJSONProvider(rawText || rawArray || []);
      providerName = jsonProvider.name;
      const parsed = jsonProvider.parseAndValidate();
      validRecords = parsed.validRecords;
      validationErrors = parsed.errors;
    }

    let importedCount = 0;
    let skippedDuplicatesCount = 0;
    const now = new Date().toISOString();
    const obsByStationAndDate: Record<string, NormalizedObservation[]> = {};

    // Retrieve existing stored observations for temporal evaluation context
    const existingObservations = db
      .select()
      .from(schema.observations)
      .orderBy(asc(schema.observations.timestamp))
      .all();

    // Map existing records to NormalizedObservation shape
    const historyList: NormalizedObservation[] = existingObservations.map((e) => ({
      id: e.id,
      stationId: e.stationId,
      timestamp: e.timestamp,
      rainGauge1: e.rainGauge1,
      rainGauge2: e.rainGauge2,
      rainfallInstantaneous: e.rainfallInstantaneous,
      rainfallDaily: e.rainfallDaily,
      temperature: e.temperature,
      humidity: e.humidity,
      pressure: e.pressure,
      windSpeed: e.windSpeed,
      windGust: e.windGust,
      windDirection: e.windDirection,
      sourceType: e.sourceType as any,
      rawPayload: e.rawPayload,
    }));

    // Sort validRecords chronologically
    validRecords.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

    for (const obs of validRecords) {
      const existing = db
        .select()
        .from(schema.observations)
        .where(eq(schema.observations.id, obs.id))
        .all();

      if (existing.length > 0) {
        skippedDuplicatesCount++;
        continue;
      }

      // Insert into observations table
      db.insert(schema.observations)
        .values({
          id: obs.id,
          stationId: obs.stationId,
          timestamp: obs.timestamp,
          rainGauge1: obs.rainGauge1,
          rainGauge2: obs.rainGauge2,
          rainfallInstantaneous: obs.rainfallInstantaneous,
          rainfallDaily: obs.rainfallDaily,
          temperature: obs.temperature,
          humidity: obs.humidity,
          pressure: obs.pressure,
          windSpeed: obs.windSpeed,
          windGust: obs.windGust,
          windDirection: obs.windDirection,
          sourceType: obs.sourceType,
          rawPayload: JSON.stringify(obs.rawPayload),
          createdAt: now,
        })
        .run();

      importedCount++;

      // Run Environmental Data-Confidence Engine
      const stationHistory = historyList.filter((h) => h.stationId === obs.stationId);
      const evaluation = evaluateObservationConfidence(obs, stationHistory);

      db.insert(schema.qualityEvaluations)
        .values({
          id: evaluation.id,
          observationId: obs.id,
          stationId: obs.stationId,
          timestamp: obs.timestamp,
          confidence: evaluation.confidence,
          reasonCodes: JSON.stringify(evaluation.reasonCodes),
          gaugeDifferenceMm: evaluation.gaugeDifferenceMm,
          gaugeDisagreementRatio: evaluation.gaugeDisagreementRatio,
          evidenceJson: JSON.stringify(evaluation.evidence),
          explanation: evaluation.explanation,
          evaluatedAt: evaluation.evaluatedAt,
        })
        .onConflictDoUpdate({
          target: schema.qualityEvaluations.id,
          set: {
            confidence: evaluation.confidence,
            reasonCodes: JSON.stringify(evaluation.reasonCodes),
            gaugeDifferenceMm: evaluation.gaugeDifferenceMm,
            gaugeDisagreementRatio: evaluation.gaugeDisagreementRatio,
            evidenceJson: JSON.stringify(evaluation.evidence),
            explanation: evaluation.explanation,
          },
        })
        .run();

      // Add to running history
      historyList.push(obs);

      const dateStr = obs.timestamp.split('T')[0];
      const key = `${obs.stationId}_${dateStr}`;
      if (!obsByStationAndDate[key]) obsByStationAndDate[key] = [];
      obsByStationAndDate[key].push(obs);
    }

    // Daily Aggregation, Satellite Comparison, and Recommendations
    const satProvider = getSatelliteProvider(false);

    for (const [key, obsGroup] of Object.entries(obsByStationAndDate)) {
      const [stationId, dateStr] = key.split('_');
      const agg = aggregateDailyRainfall(stationId, dateStr, obsGroup);

      for (const flag of agg.flags) {
        db.insert(schema.qualityFlags)
          .values({
            id: flag.id,
            observationId: flag.observationId,
            flagCode: flag.flagCode,
            severity: flag.severity,
            reason: flag.reason,
            evaluatedAt: flag.evaluatedAt,
          })
          .onConflictDoNothing()
          .run();
      }

      db.insert(schema.dailyRainfall)
        .values({
          id: agg.id,
          stationId: agg.stationId,
          date: agg.date,
          totalRainfallMm: agg.totalRainfallMm,
          observationCount: agg.observationCount,
          validObservationCount: agg.validObservationCount,
          trustCategory: agg.trustCategory,
          createdAt: now,
        })
        .onConflictDoUpdate({
          target: schema.dailyRainfall.id,
          set: {
            totalRainfallMm: agg.totalRainfallMm,
            observationCount: agg.observationCount,
            validObservationCount: agg.validObservationCount,
            trustCategory: agg.trustCategory,
          },
        })
        .run();

      let satResult: any = null;
      try {
        if (satProvider.fetchHistorical && satProvider.fetchLatest) {
          const satArray = await satProvider.fetchHistorical(-1.1018, 37.0144, dateStr, dateStr);
          satResult = satArray[0] || (await satProvider.fetchLatest(-1.1018, 37.0144));
        } else if (satProvider.fetchDailyRainfall) {
          const satArray = await satProvider.fetchDailyRainfall(-1.1018, 37.0144, dateStr, dateStr);
          satResult = satArray[0];
        }
      } catch {
        if (satProvider.fetchLatest) {
          satResult = await satProvider.fetchLatest(-1.1018, 37.0144);
        }
      }

      if (!satResult) {
        satResult = satProvider.normalize({ date: dateStr, precipitation_sum: 0.0 });
      }

      db.insert(schema.satelliteRainfall)
        .values({
          id: satResult.id,
          productName: satResult.productName,
          lat: satResult.lat,
          lon: satResult.lon,
          date: satResult.date,
          rainfallMm: satResult.rainfallMm,
          confidenceScore: satResult.confidenceScore,
          fetchedAt: now,
        })
        .onConflictDoNothing()
        .run();

      const comparison = compareStationAndSatellite(agg, satResult);

      db.insert(schema.comparisons)
        .values({
          id: comparison.id,
          stationId: comparison.stationId,
          dailyRainfallId: agg.id,
          satelliteRainfallId: satResult.id,
          date: comparison.date,
          stationMm: comparison.stationMm,
          satelliteMm: comparison.satelliteMm,
          differenceMm: comparison.differenceMm,
          discrepancyRatio: comparison.discrepancyRatio,
          trustClassification: comparison.trustClassification,
          explanation: comparison.explanation,
          createdAt: comparison.createdAt,
        })
        .onConflictDoUpdate({
          target: schema.comparisons.id,
          set: {
            stationMm: comparison.stationMm,
            satelliteMm: comparison.satelliteMm,
            differenceMm: comparison.differenceMm,
            discrepancyRatio: comparison.discrepancyRatio,
            trustClassification: comparison.trustClassification,
            explanation: comparison.explanation,
          },
        })
        .run();

      const recommendation = generateRecommendation(comparison);

      db.insert(schema.recommendations)
        .values({
          id: recommendation.id,
          comparisonId: comparison.id,
          date: recommendation.date,
          stationId: recommendation.stationId,
          actionableRecommendation: recommendation.actionableRecommendation,
          evidenceSummary: recommendation.evidenceSummary,
          trustScore: recommendation.trustScore,
          status: recommendation.status,
          createdAt: recommendation.createdAt,
        })
        .onConflictDoUpdate({
          target: schema.recommendations.id,
          set: {
            actionableRecommendation: recommendation.actionableRecommendation,
            evidenceSummary: recommendation.evidenceSummary,
            trustScore: recommendation.trustScore,
          },
        })
        .run();
    }

    return NextResponse.json({
      success: true,
      sourceType: validRecords.length > 0 ? validRecords[0].sourceType : sourceType,
      providerName: providerName || 'Conduit Ingestion Pipeline',
      importedCount,
      skippedDuplicatesCount,
      validationErrors,
      timestamp: now,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: err?.message || 'Ingestion processing error',
      },
      { status: 500 }
    );
  }
}
