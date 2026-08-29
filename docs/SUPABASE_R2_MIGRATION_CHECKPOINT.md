# Supabase-only Migration Checkpoint

## Purpose

This document freezes the current production state before experimenting with a Supabase-only architecture.

Do not treat this branch as production until the migration is explicitly approved.

## Branch policy

- `main` = current production line.
- `feat/supabase-r2-migration` = isolated migration/research branch. The branch name is historical; the current target is Supabase-only.
- Never replace production persistence from this branch without a dedicated migration gate and live verification.

## Current production architecture

```text
User
  ↓
Vercel Frontend
React + Vite + TypeScript
  ↓
Apps Script Backend
  ↓
Google Sheets / Google Drive
```

`AppShell` remains Apps Script backend diagnostic UI only.

## Production frontend

Canonical URL:

```text
https://iatf-16949-equipment-management.vercel.app
```

Production React navigation uses live backend panels for:

- Dashboard
- Equipment
- Daily Inspection
- Maintenance
- Tooling
- Calibration
- Audit / Configuration

## Current Apps Script deployment checkpoint

Deployment ID:

```text
AKfycbzykTZpW60nZEdwXC3Wn2nRZe1ePrvhUwoER1cHjciiDNGZ34kWv_vfvhEpwSor-f95
```

Web app URL:

```text
https://script.google.com/macros/s/AKfycbzykTZpW60nZEdwXC3Wn2nRZe1ePrvhUwoER1cHjciiDNGZ34kWv_vfvhEpwSor-f95/exec
```

Last manually confirmed deployment version during Phase 3 rollout:

```text
Version 17 - 2026-08-29
```

Deployment mode at checkpoint:

- Execute as: user accessing the web app
- Access: users with Google accounts

## Script Properties checkpoint

Required production values:

```text
ALLOWED_PARENT_ORIGINS_JSON
["https://iatf-16949-equipment-management.vercel.app"]

RBAC_JSON
{"rbals1993@gmail.com":"ADMIN"}
```

`TEST_SPREADSHEET_ID` exists separately and must not be confused with the production spreadsheet.

## Production persistence

Production spreadsheet ID:

```text
1zvrMyGDnXy3HMRzFrLYS4IFyuYPsSUTROy22M6Le9VE
```

Expected production invariants at this checkpoint:

- Equipment total: 71
- PRODUCTION: 19
- MEASUREMENT: 52
- Calibration_Master: 52
- Calibration link state: 52 LINKED, 0 UNLINKED, 0 ORPHAN, 0 INVALID_TYPE

Canonical identity rule:

```text
ONE EQUIPMENT -> ONE EQUIPMENT ID -> ONE ROOT RECORD -> ALL BUSINESS RECORDS REFERENCE THE SAME ID
```

Measurement equipment IDs:

```text
CEV-ME-001 ... CEV-ME-052
```

## G1 schema checkpoint

Frozen contract version:

```text
G1-frozen-2026-08-28
```

G1 contains 20 business tables:

1. Equipment_Master
2. Daily_Inspection
3. Daily_Inspection_Item
4. Maintenance_Plan
5. Maintenance_Plan_Item
6. Maintenance_Work_Order
7. Maintenance_Execution
8. Maintenance_Result_Item
9. Maintenance_Log
10. Equipment_Handover
11. Downtime_Event
12. Tooling_Master
13. Tooling_Maintenance_Plan
14. Tooling_Modification
15. Calibration_Master
16. Calibration_Log
17. Calibration_Vendor_Quote
18. Calibration_Quote_Summary
19. Equipment_Movement_Log
20. Audit_Log

## Evidence / images in current production

Current production evidence is stored in Google Drive folders, including:

- equipment photos
- manuals and setup
- maintenance before/after
- calibration certificates
- calibration label photos
- tooling drawings
- tooling change attachments
- handover records
- official PDF snapshots

Existing Google Drive evidence must remain untouched until migration verification passes.

## Migration target

Cloudflare R2 is not used because account setup requires a payment card. The migration target is now Supabase-only:

```text
Vercel React
  ↓
Supabase
  ├─ PostgreSQL data
  ├─ Auth / RBAC
  ├─ Storage for equipment photos/evidence
  └─ Edge Functions / RPC for protected workflows
```

Initial migration is TEST ONLY.

Suggested first test dataset:

- 10-20 Equipment rows
- sample Calibration rows
- sample Daily Inspection rows
- sample Maintenance rows
- sample equipment/evidence images in Supabase Storage

## Supabase storage plan

Use separate buckets or logical prefixes for the current evidence categories:

- `equipment-photos`
- `manuals-and-setup`
- `maintenance-before-after`
- `calibration-certificates`
- `calibration-label-photos`
- `tooling-drawings`
- `tooling-change-attachments`
- `handover-records`
- `official-pdf-snapshots`

For TEST, private buckets are preferred. The database should store object paths and metadata, not image binary data.

## Migration rules

1. Keep `main` production unchanged while testing Supabase.
2. Do not write migration test data into production Google Sheets.
3. Do not delete or move existing Google Drive evidence.
4. Preserve `equipmentId` values exactly.
5. Preserve G1 workflow and RBAC semantics before switching persistence.
6. Use a separate Supabase TEST project.
7. Test read, create, update, workflow, audit, image upload, permissions, and rollback before considering production migration.
8. Production cutover requires data reconciliation against the frozen counts above.
9. Do not commit Supabase secrets or service-role keys to GitHub/Vite client code.
10. Browser may use only the Supabase public client key with RLS; privileged workflow logic stays behind protected RPC/Edge Functions.

## Git checkpoint

The migration branch was cloned from the current production `main` after Phase 3 merge and Vercel install-command correction.

Known relevant production history immediately before migration work:

```text
d6a8a88224ecfff0e70cd0e7ad5877dd9cb90244  Phase 3 merge into main
dcc0d86cc97440edd8934654687d7dbc95fb4c10  Vercel install command fix
742fe78d5b3c379ada5bce25ae049acf1bf8d595  Apps Script redirected iframe origin bridge fix
```

If `main` advances after this checkpoint, deliberately decide whether to merge/rebase those production fixes into the migration branch before continuing.

## Next migration phase

When work resumes on this branch:

1. Provision Supabase TEST.
2. Define environment-variable contract without committing credentials.
3. Port the 20-table G1 schema to PostgreSQL.
4. Add RLS / RBAC.
5. Create Supabase Storage buckets/policies for equipment photos and evidence.
6. Build repository adapters behind the existing frontend interfaces.
7. Seed test data only.
8. Test equipment image upload/read/delete permissions.
9. Benchmark against Apps Script/Sheets.
10. Decide migration only after functional and performance verification.
