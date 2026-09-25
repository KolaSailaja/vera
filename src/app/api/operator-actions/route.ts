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
    const res = await fetch(`${origin}/api/actions`, {
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
