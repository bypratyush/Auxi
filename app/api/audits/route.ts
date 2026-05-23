// POST /api/audits — streams audit progress as newline-delimited JSON.
//
// Each line is one StreamEvent. The connection stays open for the full pipeline
// (target ~15–25s) and closes after the final 'complete' or 'error' event.
// Requires the user to be signed in — reads the user from the Supabase session
// cookie that middleware refreshes on every request.

import { z } from 'zod';
import { runAuditPipeline, type StreamEvent } from '@/lib/audit/pipeline';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const runtime = 'edge';
export const maxDuration = 60;

const AuditInputSchema = z.object({
  url: z.string().url(),
  websiteType: z.enum([
    'ecommerce',
    'saas',
    'landing',
    'blog',
    'portfolio',
    'docs',
    'nonprofit',
    'news',
  ]),
  targetAudience: z.string().min(3).max(300),
  technicality: z.enum(['technical', 'non_technical', 'mixed']),
});

export async function POST(req: Request) {
  // 1. Require a signed-in user.
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return new Response(JSON.stringify({ error: 'not authenticated' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 2. Parse + validate body.
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'invalid json body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const parsed = AuditInputSchema.safeParse(payload);
  if (!parsed.success) {
    return new Response(
      JSON.stringify({ error: 'invalid input', issues: parsed.error.issues }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // 3. Stream the pipeline.
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: StreamEvent) => {
        controller.enqueue(encoder.encode(JSON.stringify(event) + '\n'));
      };
      try {
        await runAuditPipeline({ input: parsed.data, userId: user.id, send });
      } catch (e) {
        send({ type: 'error', message: e instanceof Error ? e.message : String(e) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
    },
  });
}
