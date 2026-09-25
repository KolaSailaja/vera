import { NextResponse } from 'next/server';
import { initializeDatabase } from '@/db/init';
import { db } from '@/db';
import * as schema from '@/db/schema';
import { desc, asc } from 'drizzle-orm';
import { getStationConfig } from '@/config/station';
import { ChirpsSatelliteProvider } from '@/providers/satellite/chirps-satellite';
import { compareDailyGroundAndSatellite, DailyComparisonResult } from '@/services/comparison';
import { evaluateObservationConfidence, ConfidenceLevel } from '@/services/confidence-engine';
import { NormalizedObservation } from '@/providers/types';

export async function GET() {
  try {
    initializeDatabase();

    const stationConfig = getStationConfig();
    if (!stationConfig.isConfigured || stationConfig.latitude === null || stationConfig.longitude === null) {
      return NextResponse.json({
        success: false,
        stationConfigured: false,
        message: 'Station coordinates are unconfigured. Please configure station latitude and longitude before running satellite comparisons.',
      });
    }

    // 1. Fetch stored daily ground observations or aggregate from observation telemetry table
    const dailyRecords = db
      .select()
      .from(schema.dailyRainfall)
      .orderBy(desc(schema.dailyRainfall.date))
      .limit(50)
      .all();

    // Fetch raw observation telemetry to obtain exact local quality evaluations per day
    const rawObs = db
      .select()
      .from(schema.observations)
      .orderBy(asc(schema.observations.timestamp))
      .all();

    const allObs: NormalizedObservation[] = rawObs.map((o) => ({
      id: o.id,
      stationId: o.stationId,
      timestamp: o.timestamp,
      rainGauge1: o.rainGauge1,
      rainGauge2: o.rainGauge2,
      rainfallInstantaneous: o.rainfallInstantaneous,
      rainfallDaily: o.rainfallDaily,
      temperature: o.temperature,
      humidity: o.humidity,
      pressure: o.pressure,
      windSpeed: o.windSpeed,
      windGust: o.windGust,
      windDirection: o.windDirection,
      sourceType: o.sourceType as any,
      rawPayload: o.rawPayload,
    }));

    // Map dates to ground observation summary + quality evaluation
    const dateGroundMap = new Map<string, { totalRainfallMm: number; confidence: ConfidenceLevel }>();

    if (dailyRecords.length > 0) {
      for (const d of dailyRecords) {
        // Find latest observation on this date to get confidence
        const obsOnDate = allObs.filter((o) => o.timestamp.startsWith(d.date));
        let conf: ConfidenceLevel = 'HIGH';

        if (obsOnDate.length > 0) {
          const latestObs = obsOnDate[obsOnDate.length - 1];
          const evalRes = evaluateObservationConfidence(
            latestObs,
            obsOnDate.slice(0, -1)
          );
          conf = evalRes.confidence;
        }

        dateGroundMap.set(d.date, {
          totalRainfallMm: d.totalRainfallMm,
          confidence: conf,
        });
      }
    } else if (allObs.length > 0) {
      // Aggregate telemetry by date dynamically if daily_rainfall table hasn't been pre-populated
      const groupedByDate: Record<string, NormalizedObservation[]> = {};
      for (const obs of allObs) {
        const d = obs.timestamp.split('T')[0];
        if (!groupedByDate[d]) groupedByDate[d] = [];
        groupedByDate[d].push(obs);
      }

      for (const [dStr, obsList] of Object.entries(groupedByDate)) {
        const total = obsList.reduce(
          (sum, o) => sum + (o.rainfallInstantaneous ?? o.rainGauge1 ?? 0),
          0
        );
        const lastObs = obsList[obsList.length - 1];
        const evalRes = evaluateObservationConfidence(
          lastObs,
          obsList.slice(0, -1)
        );

        dateGroundMap.set(dStr, {
          totalRainfallMm: Math.round(total * 100) / 100,
          confidence: evalRes.confidence,
        });
      }
    }

    // 2. Fetch CHIRPS satellite rainfall for station coordinates
    const chirpsProvider = new ChirpsSatelliteProvider();
    const storedSat = db.select().from(schema.satelliteRainfall).all();
    const satMap = new Map<string, { rainfallMm: number; sourceType: string }>();

    for (const s of storedSat) {
      satMap.set(s.date, { rainfallMm: s.rainfallMm, sourceType: 'LIVE_CHIRPS_API' });
    }

    // If missing dates in DB, try querying CHIRPS provider or fallback
    const allDates = Array.from(new Set([...Array.from(dateGroundMap.keys()), ...Array.from(satMap.keys())])).sort();

    if (allDates.length === 0) {
      return NextResponse.json({
        success: true,
        stationConfigured: true,
        stationCoordinates: { lat: stationConfig.latitude, lon: stationConfig.longitude },
        count: 0,
        data: [],
      });
    }

    const startDate = allDates[0];
    const endDate = allDates[allDates.length - 1];

    if (satMap.size === 0) {
      try {
        const liveSat = await chirpsProvider.fetchDailyRainfall(
          stationConfig.latitude,
          stationConfig.longitude,
          startDate,
          endDate
        );
        for (const ls of liveSat) {
          satMap.set(ls.date, { rainfallMm: ls.rainfallMm, sourceType: 'LIVE_CHIRPS_API' });
        }
      } catch (e) {
        // If live fetch fails and no stored satellite data exists, mark satellite data as UNAVAILABLE
        for (const d of allDates) {
          if (!satMap.has(d)) {
            satMap.set(d, { rainfallMm: 0.0, sourceType: 'SATELLITE_UNAVAILABLE' });
          }
        }
      }
    }

    // 3. Compute daily comparison results with quality screening gating
    const results: DailyComparisonResult[] = [];
    for (const d of allDates.reverse()) {
      const groundInfo = dateGroundMap.get(d) || null;
      const satInfo = satMap.get(d) || { rainfallMm: 0.0, sourceType: 'LIVE_CHIRPS_API' };

      const cmp = compareDailyGroundAndSatellite(
        d,
        stationConfig.stationId,
        groundInfo,
        satInfo.rainfallMm,
        satInfo.sourceType
      );
      results.push(cmp);
    }

    return NextResponse.json({
      success: true,
      stationConfigured: true,
      stationCoordinates: { lat: stationConfig.latitude, lon: stationConfig.longitude },
      count: results.length,
      data: results,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message }, { status: 500 });
  }
}
