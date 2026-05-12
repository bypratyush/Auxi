import { NextResponse } from 'next/server';

// POST /api/audits/[id]/chat — follow-up chat with the audit report loaded as context.
export async function POST(_req: Request, _ctx: { params: { id: string } }) {
  return NextResponse.json({ error: 'not implemented' }, { status: 501 });
}
