import { NextResponse } from 'next/server';
import { initializeDatabase } from '@/db/init';
import { getStationConfig } from '@/config/station';
import { calculateComparisonSummary, DailyComparisonResult } from '@/services/comparison';

export async function GET(req: Request) {
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

    // Call internal daily comparison endpoint logic
    const origin = new URL(req.url).origin;
    const dailyRes = await fetch(`${origin}/api/comparison/daily`);
    const dailyJson = await dailyRes.json();

    if (!dailyJson.success || !Array.isArray(dailyJson.data)) {
      return NextResponse.json(
        { success: false, message: 'Failed to retrieve daily comparison records.' },
        { status: 500 }
      );
    }

    const dailyResults: DailyComparisonResult[] = dailyJson.data;
    const summary = calculateComparisonSummary(dailyResults);

    return NextResponse.json({
      success: true,
      stationConfigured: true,
      stationCoordinates: { lat: stationConfig.latitude, lon: stationConfig.longitude },
      summary,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message }, { status: 500 });
  }
}
