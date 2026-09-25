import { NextResponse } from 'next/server';
import { initializeDatabase } from '@/db/init';
import { db } from '@/db';
import * as schema from '@/db/schema';
import { desc, asc } from 'drizzle-orm';
import { evaluateObservationConfidence } from '@/services/confidence-engine';

export async function GET(req: Request) {
  try {
    initializeDatabase();

    const url = new URL(req.url);
    const limitParam = url.searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam, 10) : 50;

    const records = db
      .select()
      .from(schema.qualityEvaluations)
      .orderBy(desc(schema.qualityEvaluations.timestamp))
      .limit(limit)
      .all();

    if (records.length > 0) {
      const parsedRecords = records.map((r) => ({
        ...r,
        reasonCodes: JSON.parse(r.reasonCodes),
        evidence: JSON.parse(r.evidenceJson),
      }));

      return NextResponse.json({
        success: true,
        count: parsedRecords.length,
        data: parsedRecords,
      });
    }

    // Fallback: evaluate existing observations dynamically if evaluations table has no pre-saved records
    const allObs = db
      .select()
      .from(schema.observations)
      .orderBy(asc(schema.observations.timestamp))
      .all();

    if (allObs.length > 0) {
      const evaluations = allObs.map((obs, idx) => {
        const history = allObs.slice(0, idx).map((h) => ({
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

        return evaluateObservationConfidence(
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
          history
        );
      });

      // Sort descending by timestamp and take up to limit
      evaluations.sort((a, b) => (a.timestamp > b.timestamp ? -1 : 1));
      const sliced = evaluations.slice(0, limit);

      return NextResponse.json({
        success: true,
        count: sliced.length,
        data: sliced,
      });
    }

    return NextResponse.json({
      success: true,
      count: 0,
      data: [],
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message }, { status: 500 });
  }
}
