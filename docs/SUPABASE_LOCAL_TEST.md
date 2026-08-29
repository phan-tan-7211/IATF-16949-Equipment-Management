# Supabase local TEST quick start

Branch: `feat/supabase-r2-migration`

## 1. Pull branch

```bash
git fetch origin
git checkout feat/supabase-r2-migration
git pull origin feat/supabase-r2-migration
npm install
```

## 2. Prepare Supabase TEST project

In Supabase Dashboard -> SQL Editor:

1. Run `supabase/migrations/20260829_001_g1_test.sql`.
2. Run `supabase/seed.sql`.
3. Create a TEST user in Authentication -> Users.
4. Get that user's UUID.
5. Run this once in SQL Editor, replacing values:

```sql
insert into public.app_user_role (user_id, email, role)
values ('YOUR_AUTH_USER_UUID', 'YOUR_EMAIL', 'ADMIN')
on conflict (user_id) do update set role = excluded.role, email = excluded.email;
```

## 3. Create local env

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Windows PowerShell:

```powershell
Copy-Item .env.example .env.local
```

Fill values from Supabase Dashboard -> Project Settings -> API:

```text
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

Never commit `.env.local`.

## 4. Run frontend

```bash
npm run dev
```

Open:

```text
http://localhost:5173/?phase3=supabase-test
```

Expected flow:

1. Configuration = YES.
2. Sign in with TEST user.
3. Click `Read Equipment` -> expected 4 seeded rows.
4. Click `Test Storage` -> expected `STORAGE_OK` and private `equipment-photos` bucket access.

This diagnostic route does not use Apps Script.

## 5. Safety

- Use TEST Supabase project only.
- Do not put service-role key in Vite environment variables.
- Browser may use only the Supabase anon/publishable key.
- `main` remains Apps Script + Google Sheets/Drive production.
