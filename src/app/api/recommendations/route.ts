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
      .limit(100)
      .all();

    return NextResponse.json({
      success: true,
      count: records.length,
      data: records,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message }, { status: 500 });
  }
}
