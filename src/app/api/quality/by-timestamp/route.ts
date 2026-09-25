import { NextResponse } from 'next/server';
import { initializeDatabase } from '@/db/init';
import { db } from '@/db';
import * as schema from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(req: Request) {
  try {
    initializeDatabase();

    const url = new URL(req.url);
    const timestamp = url.searchParams.get('timestamp');

    if (!timestamp) {
      return NextResponse.json(
        { success: false, message: 'Query parameter "timestamp" is required.' },
        { status: 400 }
      );
    }

    const records = db
      .select()
      .from(schema.qualityEvaluations)
      .where(eq(schema.qualityEvaluations.timestamp, timestamp))
      .all();

    if (records.length === 0) {
      return NextResponse.json(
        { success: false, message: `No evaluation found for timestamp ${timestamp}.` },
        { status: 404 }
      );
    }

    const rec = records[0];

    return NextResponse.json({
      success: true,
      data: {
        ...rec,
        reasonCodes: JSON.parse(rec.reasonCodes),
        evidence: JSON.parse(rec.evidenceJson),
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message }, { status: 500 });
  }
}
