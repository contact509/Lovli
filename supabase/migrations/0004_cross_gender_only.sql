-- Matching is cross-gender by design (Kris/Boruta, 2026-07-07): `seeking` is
-- derived as the opposite gender, never user-selectable. Enforce at DB level.
update public.profiles set seeking = case gender when 'male' then 'female' else 'male' end
where seeking = gender;

alter table public.profiles
  add constraint profiles_cross_gender_check check (seeking <> gender);
