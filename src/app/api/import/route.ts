import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const origin = new URL(req.url).origin;
    const body = await req.json();
    const res = await fetch(`${origin}/api/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    return NextResponse.json(json, { status: res.status });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message }, { status: 500 });
  }
}
