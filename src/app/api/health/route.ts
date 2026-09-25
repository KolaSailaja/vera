import { NextResponse } from 'next/server';
import { initializeDatabase } from '@/db/init';
import { db } from '@/db';
import * as schema from '@/db/schema';
import { sql } from 'drizzle-orm';
import { getStationConfig } from '@/config/station';
import { ConduitLiveProvider } from '@/providers/observation/conduit-live';

export async function GET() {
  try {
    initializeDatabase();

    // Check DB query accessibility
    let dbAccessible = false;
    try {
      db.run(sql`SELECT 1 as alive`);
      dbAccessible = true;
    } catch {
      dbAccessible = false;
    }

    const stationConfig = getStationConfig();
    const conduitApiUrl = process.env.CONDUIT_API_URL;
    const isConduitConfigured = Boolean(conduitApiUrl);

    let liveStatus = { available: false, statusMessage: 'CONDUIT_API_URL is unconfigured.' };
    if (isConduitConfigured) {
      const liveProvider = new ConduitLiveProvider();
      liveStatus = await liveProvider.getStatus();
    }

    // Get latest observation timestamp for data freshness audit
    const latestObs = db
      .select({ timestamp: schema.observations.timestamp, sourceType: schema.observations.sourceType })
      .from(schema.observations)
      .orderBy(sql`${schema.observations.timestamp} DESC`)
      .limit(1)
      .all()[0];

    return NextResponse.json({
      status: 'healthy',
      application: 'running',
      database: dbAccessible ? 'accessible' : 'unreachable',
      conduitSource: {
        configured: isConduitConfigured,
        available: liveStatus.available,
        mode: liveStatus.available
          ? 'LIVE_CONDUIT'
          : latestObs?.sourceType || 'IMPORTED_CONDUIT_DATA',
        status: liveStatus.statusMessage,
        lastObservationTimestamp: latestObs?.timestamp || null,
      },
      satelliteSource: {
        configured: stationConfig.isConfigured,
        provider: 'CHIRPS v2.0 Daily Precipitation',
        status: stationConfig.isConfigured
          ? `Configured at coordinates (${stationConfig.latitude}° N, ${stationConfig.longitude}° E)`
          : 'Station coordinates unconfigured',
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        status: 'error',
        application: 'running',
        database: 'error',
        message: err?.message || 'Health check error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
