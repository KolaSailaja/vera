import { NextResponse } from 'next/server';
import { initializeDatabase } from '@/db/init';
import { db } from '@/db';
import * as schema from '@/db/schema';
import { eq, asc } from 'drizzle-orm';
import { evaluateObservationConfidence } from '@/services/confidence-engine';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ timestamp: string }> }
) {
  try {
    initializeDatabase();

    const resolvedParams = await params;
    const rawParam = resolvedParams.timestamp;
    if (!rawParam) {
      return NextResponse.json(
        { success: false, message: 'Timestamp or observation ID parameter is required.' },
        { status: 400 }
      );
    }

    const timestampStr = decodeURIComponent(rawParam);

    // 1. Try finding in quality_evaluations by timestamp
    const evals = db
      .select()
      .from(schema.qualityEvaluations)
      .where(eq(schema.qualityEvaluations.timestamp, timestampStr))
      .all();

    if (evals.length > 0) {
      const rec = evals[0];
      return NextResponse.json({
        success: true,
        data: {
          ...rec,
          reasonCodes: JSON.parse(rec.reasonCodes),
          evidence: JSON.parse(rec.evidenceJson),
        },
      });
    }

    // Try finding in quality_evaluations by observationId
    const evalsById = db
      .select()
      .from(schema.qualityEvaluations)
      .where(eq(schema.qualityEvaluations.observationId, timestampStr))
      .all();

    if (evalsById.length > 0) {
      const rec = evalsById[0];
      return NextResponse.json({
        success: true,
        data: {
          ...rec,
          reasonCodes: JSON.parse(rec.reasonCodes),
          evidence: JSON.parse(rec.evidenceJson),
        },
      });
    }

    // 2. Fallback: Query observations table by timestamp or id, then evaluate dynamically
    const obsList = db
      .select()
      .from(schema.observations)
      .where(eq(schema.observations.timestamp, timestampStr))
      .all();

    let targetObs = obsList.length > 0 ? obsList[0] : null;

    if (!targetObs) {
      const obsById = db
        .select()
        .from(schema.observations)
        .where(eq(schema.observations.id, timestampStr))
        .all();
      if (obsById.length > 0) {
        targetObs = obsById[0];
      }
    }

    if (targetObs) {
      // Get historical observations prior to targetObs timestamp for full context checks
      const historyObs = db
        .select()
        .from(schema.observations)
        .where(eq(schema.observations.stationId, targetObs.stationId))
        .orderBy(asc(schema.observations.timestamp))
        .all()
        .filter((h) => h.timestamp < targetObs!.timestamp)
        .map((obs) => ({
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
          sourceType: obs.sourceType as any,
          rawPayload: obs.rawPayload,
        }));

      const evaluation = evaluateObservationConfidence(
        {
          id: targetObs.id,
          stationId: targetObs.stationId,
          timestamp: targetObs.timestamp,
          rainGauge1: targetObs.rainGauge1,
          rainGauge2: targetObs.rainGauge2,
          rainfallInstantaneous: targetObs.rainfallInstantaneous,
          rainfallDaily: targetObs.rainfallDaily,
          temperature: targetObs.temperature,
          humidity: targetObs.humidity,
          pressure: targetObs.pressure,
          windSpeed: targetObs.windSpeed,
          windGust: targetObs.windGust,
          windDirection: targetObs.windDirection,
          sourceType: targetObs.sourceType as any,
          rawPayload: targetObs.rawPayload,
        },
        historyObs
      );

      return NextResponse.json({
        success: true,
        data: evaluation,
      });
    }

    return NextResponse.json(
      { success: false, message: `No evaluation or observation found for ${timestampStr}` },
      { status: 404 }
    );
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message }, { status: 500 });
  }
}
