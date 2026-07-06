-- A vector cannot exist without a portal profile. The FK also lets PostgREST
-- embed user_vectors from profiles (LocalEngine candidate query) and gives
-- cascade delete (RODO) from profiles.
alter table public.user_vectors
  add constraint user_vectors_user_id_fkey
  foreign key (user_id) references public.profiles(user_id) on delete cascade;
