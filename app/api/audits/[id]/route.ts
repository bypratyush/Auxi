import { NextResponse } from 'next/server';

// GET /api/audits/[id] — poll audit status, progress events, and final report.
export async function GET(_req: Request, _ctx: { params: { id: string } }) {
  return NextResponse.json({ error: 'not implemented' }, { status: 501 });
}
