# Supabase-only runtime architecture

Status: ACTIVE for `feat/supabase-r2-migration`.

## Runtime

```text
User
  ↓
Vercel Frontend
React + Vite + TypeScript
  ↓
Supabase
├─ PostgreSQL
├─ Auth / RLS
├─ Storage
└─ RPC / Edge Functions when needed
```

## Removed from the new runtime

- Google Apps Script is not used by the Supabase branch runtime.
- Google Sheets is not used as the operational database.
- Google Drive is not used as the operational evidence store.

Legacy Apps Script / Google documentation and compatibility code may remain in repository history while migration is in progress, but new features must not depend on them.

## Persistence rules

- PostgreSQL is the structured-data source of truth.
- Supabase Storage is the evidence/image/document store.
- `equipment_master.equipment_id` remains the canonical equipment identity.
- All inspection, maintenance, calibration, downtime, movement and audit records reference the canonical equipment ID.
- Frontend uses the Supabase client/RPC contract; no spreadsheet-shaped persistence contract is introduced for new work.

## Deployment

- Frontend: Vercel.
- Database/Auth/Storage: Supabase.
- Environment variables: Vercel project environment variables; no Google credentials are required for the new runtime.

## Migration boundary

The legacy `main` branch can remain available as historical/rollback production until an explicit cutover. The Supabase branch is the forward architecture and must not add new Apps Script or Google Sheets dependencies.
