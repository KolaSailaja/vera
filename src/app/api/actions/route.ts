import { NextResponse } from 'next/server';
import { initializeDatabase } from '@/db/init';
import { db } from '@/db';
import * as schema from '@/db/schema';
import { desc } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

const VALID_ACTIONS = [
  'ACCEPT_OBSERVATION',
  'MARK_FOR_REVIEW',
  'REQUEST_INSPECTION',
  'ACKNOWLEDGE_MISMATCH',
] as const;

export async function GET() {
  try {
    initializeDatabase();

    const records = db
      .select()
      .from(schema.operatorActions)
      .orderBy(desc(schema.operatorActions.timestamp))
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

export async function POST(req: Request) {
  try {
    initializeDatabase();

    const body = await req.json();
    const { observationId, action, reasonContext, operatorName } = body;

    if (!observationId || typeof observationId !== 'string') {
      return NextResponse.json(
        { success: false, message: 'Field "observationId" is required.' },
        { status: 400 }
      );
    }

    if (!action || !VALID_ACTIONS.includes(action as any)) {
      return NextResponse.json(
        {
          success: false,
          message: `Invalid action "${action}". Allowed actions: ${VALID_ACTIONS.join(', ')}`,
        },
        { status: 400 }
      );
    }

    if (!reasonContext || typeof reasonContext !== 'string') {
      return NextResponse.json(
        { success: false, message: 'Field "reasonContext" is required.' },
        { status: 400 }
      );
    }

    const actionRecord = {
      id: `act_${uuidv4().substring(0, 8)}`,
      observationId,
      action,
      reasonContext,
      operatorName: operatorName || 'System Operator',
      timestamp: new Date().toISOString(),
    };

    db.insert(schema.operatorActions)
      .values(actionRecord)
      .run();

    return NextResponse.json({
      success: true,
      data: actionRecord,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message }, { status: 500 });
  }
}
