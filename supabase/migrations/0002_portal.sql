-- Lovli portal: registration, onboarding answers, user vectors, own matching
-- engine config, research telemetry, consents.
--
-- All tables are service-role only (RLS on, no public policies) — every access
-- goes through Next.js server routes which verify the Supabase auth session.

-- 1:1 with auth.users for real users. No FK: synthetic research personas
-- (is_test) exist without auth accounts, and RODO deletion is an explicit flow
-- in the API, not a cascade.
create table if not exists public.profiles (
  user_id       uuid primary key,
  display_name  text not null,
  gender        text not null check (gender in ('male','female')),
  seeking       text not null check (seeking in ('male','female')),
  birth_year    int check (birth_year between 1920 and 2012),
  is_test       boolean not null default false,
  onboarding_completed_at timestamptz,
  created_at    timestamptz not null default now()
);

-- Raw onboarding answers = research source of truth. Includes open text
-- (OPQ_01/02) which never leaves Lovli — the engine payload is built from the
-- numeric subset only.
create table if not exists public.onboarding_answers (
  user_id     uuid not null,
  code        text not null,
  value_num   int,
  value_text  text,
  value_list  jsonb,
  answered_at timestamptz not null default now(),
  primary key (user_id, code)
);

-- Compiled engine payload (exact ENGINE_SPEC §1 format — what Trek2Summit
-- receives on POST /user/profile) + pre-weighted flat vector for our own
-- retrieval (slots ×√weight; plain L2 on it = weighted Euclidean).
create table if not exists public.user_vectors (
  user_id            uuid primary key,
  payload            jsonb not null,
  flat               jsonb not null,
  onboarding_version text not null default '1.0',
  updated_at         timestamptz not null default now()
);

-- Live-tunable matching config (D-02/D-05/N-02: weights adjustable without
-- rebuild). Component weights, critical multipliers, religion distance table
-- (D-04, scale 0–4, normalize /4, index = RT code; RT 11 → row 8), passion bonus.
create table if not exists public.weights_config (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

insert into public.weights_config (key, value) values
  ('component_weights',
   '{"values":0.40,"personality":0.20,"goals":0.15,"dynamic":0.10,"spiritual":0.15}'),
  ('critical_multipliers', '{"VAL_32":3,"VAL_33":3,"FUND_05":3}'),
  ('religion_distance',
   '[[0,1,2,3,2,3,3,3,2,3,4],
     [1,0,2,2,2,3,3,3,2,2,3],
     [2,2,0,1,1,3,3,3,2,3,3],
     [3,2,1,0,2,3,3,3,2,3,3],
     [2,2,1,2,0,3,3,3,2,3,3],
     [3,3,3,3,3,0,2,2,3,3,4],
     [3,3,3,3,3,2,0,2,3,3,4],
     [3,3,3,3,3,2,2,0,2,3,4],
     [2,2,2,2,2,3,3,2,0,1,2],
     [3,2,3,3,3,3,3,3,1,0,1],
     [4,3,3,3,3,4,4,4,2,1,0]]'),
  ('passion_bonus', '{"three_plus":0.05,"one_two":0.02}')
on conflict (key) do nothing;

-- Research telemetry from day 1 (good-way.org: retention, screen times,
-- reveal moments, drop-offs). Anonymous events allowed (user_id null).
create table if not exists public.telemetry_events (
  id         bigint generated always as identity primary key,
  user_id    uuid,
  session_id text,
  event      text not null,
  screen     text,
  props      jsonb,
  created_at timestamptz not null default now()
);
create index if not exists telemetry_events_user_idx
  on public.telemetry_events (user_id, created_at desc);
create index if not exists telemetry_events_event_idx
  on public.telemetry_events (event, created_at desc);

-- RODO research consents (versioned).
create table if not exists public.consents (
  user_id      uuid not null,
  consent_type text not null,
  version      text not null default '1.0',
  granted      boolean not null,
  granted_at   timestamptz not null default now(),
  primary key (user_id, consent_type)
);

alter table public.profiles           enable row level security;
alter table public.onboarding_answers enable row level security;
alter table public.user_vectors       enable row level security;
alter table public.weights_config     enable row level security;
alter table public.telemetry_events   enable row level security;
alter table public.consents           enable row level security;
