# Lovli

Platforma relacji opartych na wspólnych wartościach („najpierw poznaj — wygląd na końcu"). Next.js (App Router) + Supabase, hosting na Vercel. Repo: `contact509/Lovli`.

## Co już jest
- **Strona** — placeholder landing (`app/page.tsx`).
- **`GET /api/health`** — status + czy skonfigurowane env (Supabase / token).
- **`POST /api/vectorization/callback`** — webhook zwrotny dla Trek2Summit (potwierdzenie wektoryzacji). Auth: nagłówek `X-Lovli-Token`. Zapis do Supabase `vectorization_callbacks`. Kontrakt: `_apps/lovli-io/onboarding-simulator/API_CONTRACT.md` §3.

Docelowy adres dla Trek2Summit: **`https://api.lovli.io/api/vectorization/callback`** (domena podpinana przez Vercel; DNS lovli.io na Hostingerze).

## Env (ustawiane w Vercel → Project Settings → Environment Variables)
- `LOVLI_WEBHOOK_TOKEN` — shared secret w nagłówku `X-Lovli-Token`
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — dedykowany projekt Supabase (service role = tylko server)

## DB
Migracja: `supabase/migrations/0001_init.sql` (tabela `vectorization_callbacks`, RLS on, brak public policy — tylko service role).

## Dev
```bash
npm install
cp .env.example .env.local   # uzupełnij wartości
npm run dev
```

## Powiązane
- Generator + persony + kontrakt API: `_apps/lovli-io/onboarding-simulator/`
- Stan projektu: `second-brain/Projects/lovli-io.md`
