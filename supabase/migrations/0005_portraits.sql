-- "Poznaj siebie" (D-03): LLM-generated psychological portrait — the reward
-- after onboarding. Generated once per user from their own answers; Lovli-side
-- only, never enters matching. Service-role access only (RLS, no policies).
create table if not exists public.portraits (
  user_id    uuid primary key references public.profiles(user_id) on delete cascade,
  content    jsonb not null,
  model      text not null,
  created_at timestamptz not null default now()
);
alter table public.portraits enable row level security;
