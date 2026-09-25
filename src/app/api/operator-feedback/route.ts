import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  try {
    const origin = new URL(req.url).origin;
    const res = await fetch(`${origin}/api/actions`);
    const json = await res.json();
    return NextResponse.json(json);
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const origin = new URL(req.url).origin;
    const body = await req.json();
    
    // Normalize operator-feedback body to operator-actions format
    const payload = {
      observationId: body.observationId || body.targetId || 'obs_default',
      action: body.action || body.feedbackStatus || 'ACCEPT_OBSERVATION',
      reasonContext: body.reasonContext || body.notes || 'Operator decision',
      operatorName: body.operatorName || 'Operator',
    };

    const res = await fetch(`${origin}/api/actions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    return NextResponse.json(json, { status: res.status });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message }, { status: 500 });
  }
}
