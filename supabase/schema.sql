-- Auxi schema
-- Run in the Supabase SQL editor for a new project.

create extension if not exists "pgcrypto";

create type audit_status as enum ('queued', 'scraping', 'screenshotting', 'a11y_scanning', 'researching', 'analyzing', 'complete', 'failed');

create type website_type as enum ('ecommerce', 'saas', 'landing', 'blog', 'portfolio', 'docs', 'nonprofit', 'news');

create type audience_technicality as enum ('technical', 'non_technical', 'mixed');

create table audits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  url text not null,
  website_type website_type not null,
  target_audience text not null,
  technicality audience_technicality not null,
  status audit_status not null default 'queued',
  report jsonb,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index audits_user_id_idx on audits(user_id);
create index audits_status_idx on audits(status);

create table progress_events (
  id bigserial primary key,
  audit_id uuid not null references audits(id) on delete cascade,
  stage audit_status not null,
  message text,
  created_at timestamptz not null default now()
);

create index progress_events_audit_id_idx on progress_events(audit_id, created_at);

create table messages (
  id uuid primary key default gen_random_uuid(),
  audit_id uuid not null references audits(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create index messages_audit_id_idx on messages(audit_id, created_at);

alter table audits enable row level security;
alter table progress_events enable row level security;
alter table messages enable row level security;

create policy "audits_owner_select" on audits for select using (auth.uid() = user_id);
create policy "audits_owner_insert" on audits for insert with check (auth.uid() = user_id);
create policy "audits_owner_update" on audits for update using (auth.uid() = user_id);

create policy "progress_events_owner_select" on progress_events for select using (
  exists (select 1 from audits a where a.id = progress_events.audit_id and a.user_id = auth.uid())
);

create policy "messages_owner_select" on messages for select using (
  exists (select 1 from audits a where a.id = messages.audit_id and a.user_id = auth.uid())
);
create policy "messages_owner_insert" on messages for insert with check (
  exists (select 1 from audits a where a.id = messages.audit_id and a.user_id = auth.uid())
);
