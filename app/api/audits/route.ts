import { NextResponse } from 'next/server';

// POST /api/audits — create an audit job and trigger the async pipeline.
// TODO: validate input with zod, insert into `audits`, kick off pipeline, return audit id.
export async function POST(_req: Request) {
  return NextResponse.json({ error: 'not implemented' }, { status: 501 });
}
