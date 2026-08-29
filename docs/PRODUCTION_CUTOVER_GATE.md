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

### PASS — Backend workflow/RBAC smoke tests

Previously verified with transaction rollback:

- Daily Inspection transaction and `STOP_REPAIR` side effects.
- Maintenance lifecycle and BM-05 release gate.
- Tooling workflow.
- Calibration Log + Calibration Master + Audit transaction.
- ADMIN Equipment update.
- authenticated user without app role is denied protected workflow mutations.
- QUALITY can submit Daily Inspection and is denied manual Maintenance WO creation.

Smoke tests use rollback and do not leave test transactions in business tables.

## Remaining gate before merge to `main`

### PENDING — Browser smoke test on a real Vercel preview/local browser

Verify with a real authenticated browser session:

1. Equipment list loads 131 rows and thumbnails without request storm/errors.
2. Open Equipment 360 profile from image/ID/name.
3. Edit Equipment and save without full-list reload/scroll loss.
4. Paste an image into an empty Equipment photo cell and confirm the signed thumbnail refreshes.
5. Submit a normal Daily Inspection.
6. Submit an `X / STOP_REPAIR` inspection and verify WO + Downtime + Equipment DOWN.
7. Run a Maintenance WO through role-appropriate workflow actions.
8. Record Calibration Log and open the private certificate through signed URL.
9. Create Tooling / Plan / Modification and run allowed transitions.
10. Confirm non-ADMIN navigation/actions are hidden appropriately and backend still denies unauthorized direct calls.
11. ADMIN opens Audit and sees server-side mutation history.

### PENDING — Vercel preview visibility

The currently connected Vercel team is visible through the connector but the project list is empty, so preview status cannot be verified from the connector session. Do not merge solely to work around this.

## Merge rule

Do not merge this migration branch into `main` until the two PENDING gates above are explicitly confirmed.

After confirmation:

1. take final database/storage reconciliation snapshot;
2. confirm Vercel environment contains only required public Supabase client variables;
3. merge migration branch to `main`;
4. deploy production;
5. run the same browser smoke test on the canonical production URL;
6. keep the old `main` commit available as rollback history, but do not restore Apps Script/Sheets runtime unless an explicit rollback decision is made.
