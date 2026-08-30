# Production Cutover Gate — Vercel + Supabase

Updated: 2026-08-30

Target runtime:

```text
Vercel
React + Vite + TypeScript
        ↓
Supabase
PostgreSQL + Auth/RLS + Storage + RPC
```

Apps Script, Google Sheets and Google Drive are not part of the target runtime.

## Gate status

### PASS — Code quality

- GitHub Quality Gate passes tests, production build and lint.
- Workspace code-splitting is effective; Dashboard, Equipment, Inspection, Maintenance, Tooling, Calibration and Audit build into separate chunks.
- Permission matrix has automated tests.

### PASS — Equipment identity/data reconciliation

Current Supabase state:

- Equipment Master: 131
- PRODUCTION: 68
- MEASUREMENT: 63
- Calibration Master: 63
- duplicate Equipment ID groups: 0
- duplicate nonblank serial groups: 0
- Calibration orphan Equipment IDs: 0
- Calibration records linked to wrong Equipment type: 0
- Work Order orphan Equipment IDs: 0
- Inspection orphan Equipment IDs: 0
- Downtime orphan Equipment IDs: 0
- Handover orphan Equipment IDs: 0
- Movement orphan Equipment IDs: 0

Current transaction tables are intentionally empty unless real operational transactions are entered:

- Maintenance Work Order: 0
- Daily Inspection: 0
- Downtime Event: 0
- Tooling Master: 0
- Audit Log: 0

### PASS — Equipment photo storage reconciliation

- Equipment photo objects: 117
- canonical `equipment-photos/<equipmentId>/photo.webp`: 117
- noncanonical/legacy photo objects: 0
- photo folders without an Equipment Master record: 0
- Equipment with canonical photo: 117
- Equipment without photo: 14

Storage SELECT policy allows authenticated reads for the evidence buckets, including `equipment-photos`.

Equipment list photo loading uses `rpc_equipment_photo_paths` plus Storage `createSignedUrls(...)` so the page no longer performs one Storage list + one signing request per equipment row.

### PASS — Read-only cutover diagnostics

`rpc_cutover_diagnostics()` is read-only and returns a single JSON cutover snapshot. Current database result is `pass=true`.

The browser route `?phase3=supabase-test` exposes **Run cutover read gate**, which verifies:

- Supabase Auth + app role;
- database integrity snapshot;
- Equipment Master count;
- private Storage + batch signed URLs;
- ADMIN Audit RLS read when the current role is ADMIN.

### PASS — Rollback-safe workflow write smoke

`rpc_cutover_write_smoke()` is ADMIN-only and calls the real production workflow RPCs inside a PostgreSQL exception subtransaction. It deliberately raises `SMOKE_ROLLBACK` after validation so every smoke write is rolled back before returning.

Verified result with the real ADMIN identity:

- Inspection `STOP_REPAIR` creates Inspection + Work Order + Downtime and marks Equipment DOWN: PASS
- Maintenance transitions through `VERIFIED`: PASS
- Calibration Log + Calibration Master update: PASS
- Tooling Master + Plan + Modification full transition: PASS
- rollback cleanup: PASS
- final transaction-table counts after smoke: unchanged / zero

The browser route `?phase3=supabase-test` exposes **Run rollback write smoke** so the same test can be executed from the real frontend session without leaving business records.

### PASS — Backend workflow/RBAC checks

Previously verified with transaction rollback:

- Daily Inspection transaction and `STOP_REPAIR` side effects.
- Maintenance lifecycle and BM-05 release gate.
- Tooling workflow.
- Calibration Log + Calibration Master + Audit transaction.
- ADMIN Equipment update.
- authenticated user without app role is denied protected workflow mutations.
- QUALITY can submit Daily Inspection and is denied manual Maintenance WO creation.

The current `app_user_role` table contains only the ADMIN account, so a new non-ADMIN browser-session check should use a real authorized user when one is provisioned rather than creating disposable Auth users.

## Remaining gate before merge to `main`

### PENDING — Real browser UX smoke

Automated read/write cutover diagnostics are available. The same `?phase3=supabase-test` screen now contains a **Browser UX smoke** checklist with direct links that open each workspace in a new tab while preserving the Supabase browser session:

- Equipment
- Inspection
- Maintenance
- Calibration
- Tooling
- Audit

Required browser pass:

1. Equipment list loads 131 rows and 117 thumbnails without request storm/errors.
2. Open Equipment 360 profile from image/ID/name.
3. Edit Equipment and save without full-list reload/scroll loss.
4. Paste an image into one of the 14 empty Equipment photo cells and confirm the signed thumbnail refreshes.
5. Open Inspection / Maintenance / Calibration / Tooling workspaces and confirm responsive layout/drawers/actions.
6. Record/open a real Calibration certificate only when an approved test record/file is available; do not create fake operational evidence solely for cutover.
7. Confirm ADMIN Audit screen loads.
8. When a real non-ADMIN user exists, confirm navigation/actions are hidden appropriately and direct unauthorized calls are denied.

For workflow mutation correctness without polluting business data, use **Run rollback write smoke** instead of creating fake operational transactions.

### BLOCKED EXTERNALLY — Vercel preview visibility

The connected Vercel account currently exposes the team `Phantan's projects`, but:

- project list returns empty;
- direct lookup using project slug `iatf-16949-equipment-management` returns `404 Not Found`.

Therefore preview/deployment state cannot be verified or changed safely from the current Vercel connector session. Do not deploy to an unknown project and do not merge to `main` merely to bypass this visibility problem.

## Merge rule

Do not merge this migration branch into `main` until browser UX smoke is confirmed and the correct Vercel project is visible/verified.

After confirmation:

1. take final database/storage reconciliation snapshot;
2. run browser read gate and rollback write smoke one final time;
3. confirm Vercel environment contains only required public Supabase client variables;
4. merge migration branch to `main`;
5. deploy production;
6. run the same browser diagnostics on the canonical production URL;
7. keep the old `main` commit available as rollback history, but do not restore Apps Script/Sheets runtime unless an explicit rollback decision is made.
