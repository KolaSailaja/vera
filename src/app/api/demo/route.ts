import { NextResponse } from 'next/server';

const DEMO_SCENARIOS = {
  1: {
    name: 'Case 1: Dual Gauges Agree & Satellite Approx Agrees',
    description: 'High local confidence + satellite agreement -> Use local and satellite evidence together.',
    records: [
      {
        timestamp: '2026-09-25T08:00:00.000Z',
        station_id: 'JKUAT_DEMO_STATION',
        rain_gauge_1: 12.5,
        rain_gauge_2: 12.4,
        rainfall_instantaneous: 12.5,
        rainfall_daily: 25.0,
        temperature: 22.4,
        humidity: 78.5,
        pressure: 1013.25,
        wind_speed: 3.4,
        wind_gust: 5.1,
        wind_direction: 180,
        demo_mode: true,
      },
    ],
  },
  2: {
    name: 'Case 2: Dual Gauges Strongly Disagree',
    description: 'Gauge 1 (28.0mm) vs Gauge 2 (3.0mm) -> GAUGE_DISAGREEMENT flag -> Medium confidence.',
    records: [
      {
        timestamp: '2026-09-25T09:00:00.000Z',
        station_id: 'JKUAT_DEMO_STATION',
        rain_gauge_1: 28.0,
        rain_gauge_2: 3.0,
        rainfall_instantaneous: 28.0,
        rainfall_daily: 28.0,
        temperature: 21.0,
        humidity: 82.0,
        pressure: 1011.50,
        demo_mode: true,
      },
    ],
  },
  3: {
    name: 'Case 3: Gauges Agree + Satellite Differs Strongly',
    description: 'Local gauges agree (45.0mm vs 44.8mm) but satellite reports 4.5mm -> Spatial point vs pixel mismatch.',
    records: [
      {
        timestamp: '2026-09-25T10:00:00.000Z',
        station_id: 'JKUAT_DEMO_STATION',
        rain_gauge_1: 45.0,
        rain_gauge_2: 44.8,
        rainfall_instantaneous: 45.0,
        rainfall_daily: 45.0,
        temperature: 19.5,
        humidity: 90.0,
        pressure: 1008.20,
        demo_mode: true,
      },
    ],
  },
  4: {
    name: 'Case 4: Stale Sensor Stream',
    description: 'Identical non-zero reading (15.0mm) repeated 4 consecutive times -> STALE_STREAM flag.',
    records: [
      { timestamp: '2026-09-25T07:00:00.000Z', station_id: 'JKUAT_DEMO_STATION', rainfall_instantaneous: 15.0, rain_gauge_1: 15.0, demo_mode: true },
      { timestamp: '2026-09-25T07:15:00.000Z', station_id: 'JKUAT_DEMO_STATION', rainfall_instantaneous: 15.0, rain_gauge_1: 15.0, demo_mode: true },
      { timestamp: '2026-09-25T07:30:00.000Z', station_id: 'JKUAT_DEMO_STATION', rainfall_instantaneous: 15.0, rain_gauge_1: 15.0, demo_mode: true },
      { timestamp: '2026-09-25T07:45:00.000Z', station_id: 'JKUAT_DEMO_STATION', rainfall_instantaneous: 15.0, rain_gauge_1: 15.0, demo_mode: true },
    ],
  },
  5: {
    name: 'Case 5: Sudden Isolated Extreme Spike',
    description: 'Baseline 0.2mm jump to 55.0mm -> SUDDEN_SPIKE + TEMPORAL_INCONSISTENCY -> Low confidence.',
    records: [
      { timestamp: '2026-09-25T11:00:00.000Z', station_id: 'JKUAT_DEMO_STATION', rainfall_instantaneous: 0.2, rain_gauge_1: 0.2, demo_mode: true },
      { timestamp: '2026-09-25T11:15:00.000Z', station_id: 'JKUAT_DEMO_STATION', rainfall_instantaneous: 55.0, rain_gauge_1: 55.0, demo_mode: true },
    ],
  },
};

export async function GET() {
  return NextResponse.json({
    success: true,
    scenarios: Object.entries(DEMO_SCENARIOS).map(([key, val]) => ({
      id: Number(key),
      name: val.name,
      description: val.description,
    })),
  });
}

export async function POST(req: Request) {
  try {
    const origin = new URL(req.url).origin;
    const body = await req.json();
    const scenarioId = Number(body.scenario || 1);

    const scenarioData = DEMO_SCENARIOS[scenarioId as keyof typeof DEMO_SCENARIOS];
    if (!scenarioData) {
      return NextResponse.json(
        { success: false, message: `Invalid scenario ID "${scenarioId}". Allowed: 1, 2, 3, 4, 5` },
        { status: 400 }
      );
    }

    const res = await fetch(`${origin}/api/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sourceType: 'IMPORTED_CONDUIT_DATA',
        format: 'JSON',
        records: scenarioData.records,
      }),
    });

    const json = await res.json();
    return NextResponse.json({
      success: true,
      scenario: {
        id: scenarioId,
        name: scenarioData.name,
        description: scenarioData.description,
      },
      ingestionResult: json,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message }, { status: 500 });
  }
}
