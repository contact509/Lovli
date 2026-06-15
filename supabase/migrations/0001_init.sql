-- Lovli — vectorization callbacks (confirmations from Trek2Summit after indexing)
create table if not exists public.vectorization_callbacks (
  id          bigint generated always as identity primary key,
  user_id     text not null,
  vector_id   text,
  status      text not null default 'unknown',
  indexed_at  timestamptz,
  error       jsonb,
  raw         jsonb,
  received_at timestamptz not null default now()
);

create index if not exists vectorization_callbacks_user_id_idx
  on public.vectorization_callbacks (user_id);
create index if not exists vectorization_callbacks_received_at_idx
  on public.vectorization_callbacks (received_at desc);

-- Only the service role (server-side route) touches this table. RLS on, no
-- public policies → anon/auth clients get nothing.
alter table public.vectorization_callbacks enable row level security;
