-- Articulate AI — Supabase schema (Phase 2: cloud sync).
-- The MVP stores everything on-device (localStorage + IndexedDB). These tables mirror
-- lib/types.ts so the storage layer (lib/storage.ts) can be swapped for a synced one
-- without changing the UI. Row Level Security keeps every row private to its owner.

create table if not exists profiles (
  id uuid primary key references auth.users on delete cascade,
  focus text not null default 'business',
  difficulty smallint not null default 2 check (difficulty between 1 and 3),
  default_duration smallint not null default 5 check (default_duration in (5, 10, 15)),
  daily_goal_min smallint not null default 5,
  notes_language text not null default 'en',
  store_audio boolean not null default false,          -- explicit consent
  audio_consent_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists sessions (
  id text primary key,
  user_id uuid not null references auth.users on delete cascade,
  started_at timestamptz not null,
  finished_at timestamptz,
  active_sec integer not null default 0,
  duration smallint not null,
  question jsonb not null,           -- Question
  reflection jsonb,                  -- { feeling, takeaway }
  demo boolean not null default false
);
create index if not exists sessions_user_time on sessions (user_id, started_at desc);

create table if not exists attempts (
  id bigint generated always as identity primary key,
  session_id text not null references sessions on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  idx smallint not null,             -- 0 initial, 1 retry, 2 follow-up
  transcript text not null,
  duration_sec real not null,
  audio_path text,                   -- path in the private 'recordings' bucket (null unless consented)
  audio_metrics jsonb not null,
  text_metrics jsonb not null,
  analysis jsonb,                    -- Analysis (scores are AI coaching estimates)
  overall smallint generated always as ((analysis->>'overall')::smallint) stored,
  weakness_tag text generated always as (analysis->'improvement'->>'tag') stored,
  unique (session_id, idx)
);
create index if not exists attempts_user_tag on attempts (user_id, weakness_tag);

create table if not exists weakness_cards (
  user_id uuid not null references auth.users on delete cascade,
  tag text not null,
  ease real not null default 2.3,
  interval_days integer not null default 1,
  due timestamptz not null,
  seen integer not null default 1,
  lapses integer not null default 0,
  last_seen timestamptz not null default now(),
  primary key (user_id, tag)
);

alter table profiles enable row level security;
alter table sessions enable row level security;
alter table attempts enable row level security;
alter table weakness_cards enable row level security;

create policy "own profile" on profiles for all using (auth.uid() = id) with check (auth.uid() = id);
create policy "own sessions" on sessions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own attempts" on attempts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own weaknesses" on weakness_cards for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Private storage bucket for recordings: objects live under '<user_id>/...'.
insert into storage.buckets (id, name, public) values ('recordings', 'recordings', false) on conflict do nothing;
create policy "own recordings" on storage.objects for all
  using (bucket_id = 'recordings' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'recordings' and (storage.foldername(name))[1] = auth.uid()::text);
