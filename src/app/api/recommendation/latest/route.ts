import { NextResponse } from 'next/server';
import { initializeDatabase } from '@/db/init';
import { db } from '@/db';
import * as schema from '@/db/schema';
import { desc } from 'drizzle-orm';

export async function GET() {
  try {
    initializeDatabase();
    const records = db
      .select()
      .from(schema.recommendations)
      .orderBy(desc(schema.recommendations.createdAt))
      .limit(1)
      .all();

    if (records.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'No recommendations recorded in database.',
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: records[0],
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message }, { status: 500 });
  }
}
