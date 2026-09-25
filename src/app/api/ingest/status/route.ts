import { NextResponse } from 'next/server';
import { initializeDatabase } from '@/db/init';
import { db } from '@/db';
import * as schema from '@/db/schema';
import { ConduitLiveProvider } from '@/providers/observation/conduit-live';
import { desc, count, eq } from 'drizzle-orm';

export async function GET() {
  try {
    initializeDatabase();

    // Check Live Conduit status
    const liveProvider = new ConduitLiveProvider();
    const liveStatus = await liveProvider.getStatus();

    // Query database metrics
    const totalObsResult = db.select({ count: count() }).from(schema.observations).all();
    const totalRecords = totalObsResult[0]?.count || 0;

    const latestObs = db
      .select()
      .from(schema.observations)
      .orderBy(desc(schema.observations.createdAt))
      .limit(1)
      .all();

    const lastIngestObs = latestObs[0];

    // Determine current active source label
    let activeSource: 'LIVE_CONDUIT' | 'IMPORTED_CONDUIT_DATA' | 'NO_DATA' = 'NO_DATA';

    if (lastIngestObs) {
      if (lastIngestObs.sourceType === 'LIVE_CONDUIT') {
        activeSource = 'LIVE_CONDUIT';
      } else if (lastIngestObs.sourceType === 'IMPORTED_CONDUIT_DATA') {
        activeSource = 'IMPORTED_CONDUIT_DATA';
      }
    }

    return NextResponse.json({
      success: true,
      activeSource,
      conduitApi: {
        configured: !!process.env.CONDUIT_API_URL,
        available: liveStatus.available,
        statusMessage: liveStatus.statusMessage,
        endpointUrl: liveStatus.endpointUrl,
      },
      lastIngestionTimestamp: lastIngestObs ? lastIngestObs.createdAt : null,
      totalStoredObservations: totalRecords,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to retrieve ingestion status' },
      { status: 500 }
    );
  }
}
