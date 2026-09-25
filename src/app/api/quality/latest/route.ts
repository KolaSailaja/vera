import { NextResponse } from 'next/server';
import { initializeDatabase } from '@/db/init';
import { db } from '@/db';
import * as schema from '@/db/schema';
import { desc, asc } from 'drizzle-orm';
import { evaluateObservationConfidence } from '@/services/confidence-engine';

export async function GET() {
  try {
    initializeDatabase();

    // Query latest quality evaluation
    const latestEval = db
      .select()
      .from(schema.qualityEvaluations)
      .orderBy(desc(schema.qualityEvaluations.timestamp))
      .limit(1)
      .all();

    if (latestEval.length > 0) {
      const rec = latestEval[0];
      return NextResponse.json({
        success: true,
        data: {
          ...rec,
          reasonCodes: JSON.parse(rec.reasonCodes),
          evidence: JSON.parse(rec.evidenceJson),
        },
      });
    }

    // Fallback: Check if observations exist
    const latestObs = db
      .select()
      .from(schema.observations)
      .orderBy(desc(schema.observations.timestamp))
      .limit(1)
      .all();

    if (latestObs.length > 0) {
      const obs = latestObs[0];
      
      const historyObs = db
        .select()
        .from(schema.observations)
        .where(asc(schema.observations.timestamp))
        .all()
        .filter((h) => h.timestamp < obs.timestamp)
        .map((h) => ({
          id: h.id,
          stationId: h.stationId,
          timestamp: h.timestamp,
          rainGauge1: h.rainGauge1,
          rainGauge2: h.rainGauge2,
          rainfallInstantaneous: h.rainfallInstantaneous,
          rainfallDaily: h.rainfallDaily,
          temperature: h.temperature,
          humidity: h.humidity,
          pressure: h.pressure,
          windSpeed: h.windSpeed,
          windGust: h.windGust,
          windDirection: h.windDirection,
          sourceType: h.sourceType as any,
          rawPayload: h.rawPayload,
        }));

      const evaluation = evaluateObservationConfidence(
        {
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
        },
        historyObs
      );

      return NextResponse.json({
        success: true,
        data: evaluation,
      });
    }

    return NextResponse.json(
      { success: false, message: 'No observations or evaluations recorded in database.' },
      { status: 404 }
    );
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message }, { status: 500 });
  }
}
