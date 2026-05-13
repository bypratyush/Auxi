-- Auxi v0 schema — decomposed for RAG growth path.
-- Run in the Supabase SQL editor on a fresh project.
--
-- Design notes:
--   • `findings` and `research_sources` are the RAG retrieval atoms.
--     `embedding vector(1536)` columns exist now but stay null in v0.
--     When we add embeddings later, we backfill + create vector indexes.
--   • v0 has no auth — `session_id` (anon, from localStorage) gates access at the API layer.
--     RLS is enabled and locked; all reads/writes go through the server using the service role.
--   • Page artifacts (markdown, screenshot URL, a11y JSON) live in a 1:1 sibling table so the
--     audits row stays slim and the heavy text can be chunked later without altering audits.

create extension if not exists "pgcrypto";
create extension if not exists "vector";

-- ── Enums ───────────────────────────────────────────────────────────────────
create type audit_status as enum (
  'queued',
  'scraping',
  'researching',
  'analyzing',
  'complete',
  'failed'
);

create type website_type as enum (
  'ecommerce', 'saas', 'landing', 'blog', 'portfolio', 'docs', 'nonprofit', 'news'
);

create type audience_technicality as enum ('technical', 'non_technical', 'mixed');

create type finding_severity as enum ('critical', 'high', 'medium', 'low');

-- ── audits: top-level row ──────────────────────────────────────────────────
create table audits (
  id              uuid primary key default gen_random_uuid(),
  session_id      text not null,
  url             text not null,
  website_type    website_type not null,
  target_audience text not null,
  technicality    audience_technicality not null,
  status          audit_status not null default 'queued',
  score           smallint check (score is null or (score between 0 and 100)),
  summary         text,
  error           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index audits_session_id_idx on audits(session_id, created_at desc);
create index audits_status_idx     on audits(status);

-- ── page_artifacts: raw captured data (1:1 with audits) ────────────────────
create table page_artifacts (
  audit_id          uuid primary key references audits(id) on delete cascade,
  scraped_markdown  text,
  scraped_html      text,
  screenshot_url    text,
  a11y_findings     jsonb,
  page_title        text,
  meta_description  text,
  word_count        integer,
  created_at        timestamptz not null default now()
);

-- ── findings: one row per audit finding — primary RAG atom ─────────────────
create table findings (
  id             uuid primary key default gen_random_uuid(),
  audit_id       uuid not null references audits(id) on delete cascade,
  ordinal        smallint not null,
  parameter      text not null,
  severity       finding_severity not null,
  observation    text not null,
  recommendation text not null,
  embedding      vector(1536),
  created_at     timestamptz not null default now()
);

create index findings_audit_id_idx on findings(audit_id, ordinal);
-- Vector index (HNSW, cosine) — uncomment once embeddings are backfilled.
-- create index findings_embedding_idx on findings using hnsw (embedding vector_cosine_ops);

-- ── research_sources: Tavily results that back findings ────────────────────
create table research_sources (
  id          uuid primary key default gen_random_uuid(),
  audit_id    uuid not null references audits(id) on delete cascade,
  finding_id  uuid references findings(id) on delete set null,
  title       text not null,
  url         text not null,
  snippet     text not null,
  query       text,
  embedding   vector(1536),
  created_at  timestamptz not null default now()
);

create index research_sources_audit_id_idx   on research_sources(audit_id);
create index research_sources_finding_id_idx on research_sources(finding_id);
-- create index research_sources_embedding_idx on research_sources using hnsw (embedding vector_cosine_ops);

-- ── progress_events: streaming status backing ──────────────────────────────
create table progress_events (
  id         bigserial primary key,
  audit_id   uuid not null references audits(id) on delete cascade,
  stage      audit_status not null,
  message    text,
  created_at timestamptz not null default now()
);

create index progress_events_audit_id_idx on progress_events(audit_id, created_at);

-- ── messages: chat history (with retrieval provenance for future RAG) ──────
create table messages (
  id                    uuid primary key default gen_random_uuid(),
  audit_id              uuid not null references audits(id) on delete cascade,
  role                  text not null check (role in ('user', 'assistant')),
  content               text not null,
  retrieved_finding_ids uuid[],
  retrieved_source_ids  uuid[],
  created_at            timestamptz not null default now()
);

create index messages_audit_id_idx on messages(audit_id, created_at);

-- ── updated_at trigger ─────────────────────────────────────────────────────
create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger audits_updated_at
before update on audits
for each row execute function set_updated_at();

-- ── RLS: locked. v0 access is server-side only via the service-role key. ───
-- (Adding policies later when we move to in-browser reads, or when auth lands.)
alter table audits           enable row level security;
alter table page_artifacts   enable row level security;
alter table findings         enable row level security;
alter table research_sources enable row level security;
alter table progress_events  enable row level security;
alter table messages         enable row level security;
