# Supabase-only migration & legacy cleanup plan

Status: ACTIVE
Target branch: `feat/supabase-r2-migration`
Target runtime architecture:

```text
Vercel
  React + Vite + TypeScript
        ↓
Supabase
  PostgreSQL + Auth/RLS + Storage + RPC/Edge Functions when needed
```

## 1. Non-negotiable target

Runtime mới không được phụ thuộc vào:

- Google Apps Script
- Google Sheets
- Google Drive
- iframe/postMessage Apps Script bridge
- Apps Script smoke pages

`source/` là nguồn hồ sơ nghiệp vụ/IATF và KHÔNG thuộc legacy runtime; không xóa chỉ vì bỏ Google.

## 2. Current repo inventory

### Already Supabase-native

- Equipment Master read/update
- Equipment photos via Supabase Storage
- Equipment 360 profile/history reads
- Supabase Auth/RLS foundation
- Supabase schema/migrations

### Still coupled to Apps Script and must be migrated before deletion

- `src/data/liveInspection.ts`
  - imports `AppsScriptBridgeClient`
  - `readTable()` Equipment_Master/Daily_Inspection
  - `submitDailyInspection()` mutation
- `src/data/liveMaintenance.ts`
  - imports `AppsScriptBridgeClient`
  - reads Equipment/Maintenance Plan/Work Order/Handover
  - creates work orders and transitions workflow through Apps Script
- `src/data/liveCalibration.ts`
  - imports `AppsScriptBridgeClient`
  - reads Calibration_Master and Equipment_Master
- Audit/Dashboard/Tooling live data adapters must be checked and migrated to direct Supabase access if they still use Apps Script.

### Legacy implementation candidates to delete only after migration gates pass

- `apps-script/**`
- `public/apps-script-smoke.html`
- `src/data/appsScriptBridgeClient.ts`
- `src/data/appsScriptClient.ts`
- `src/data/appsScriptClient.test.ts`
- Google/Apps Script deployment-only docs after useful business rules are copied into Supabase docs:
  - `docs/APPS_SCRIPT_DEPLOYMENT.md`
  - `docs/PHASE3_GOOGLE_PERSISTENCE.md`
  - Google-specific portions of old runbooks/checkpoints

Do not delete `src/domain/**` merely because it predates Supabase. Domain workflow, KPI, governance, handover, audit and validation logic remain reusable business logic.

## 3. Migration order

### M1 — Inspection

Move reads to:

- `equipment_master`
- `daily_inspection`
- `daily_inspection_item`

Move write/escalation workflow to Supabase RPC so an `X` inspection can atomically create/update required Work Order + Downtime records and Audit Log.

PASS gate:

- list production equipment
- list inspection history
- create V/△/X inspection
- X escalation is atomic
- RLS/RBAC verified
- UI no longer imports Apps Script client

### M2 — Maintenance + Handover + Downtime

Move reads/writes to:

- `maintenance_plan`
- `maintenance_plan_item`
- `maintenance_work_order`
- `maintenance_execution`
- `maintenance_result_item`
- `maintenance_log`
- `equipment_handover`
- `downtime_event`
- `audit_log`

Workflow state transitions must run through Supabase RPC and preserve existing governance rules.

PASS gate:

- create manual WO
- approve/start/complete/verify flow
- handover/release guard
- audit events written
- no Apps Script import in maintenance UI/data layer

### M3 — Calibration

Move to:

- `calibration_master`
- `calibration_log`
- `calibration_vendor_quote`
- `calibration_quote_summary`
- certificate/label files in Supabase Storage

PASS gate:

- due list
- history
- new calibration log
- certificate upload/read
- no Apps Script dependency

### M4 — Tooling

Move all live tooling operations to:

- `tooling_master`
- `tooling_maintenance_plan`
- `tooling_modification`
- Storage for drawings/change attachments

BM-10B schema gap must be solved by a versioned Supabase migration; do not hide missing structured fields in JSON just to remove Apps Script.

### M5 — Dashboard + Audit

Dashboard must aggregate only Supabase data. Audit screen reads `audit_log` directly under RLS/Admin policy.

PASS gate:

- no dashboard call to Google/Apps Script
- KPI results match domain formulas
- audit view works from Supabase only

## 4. Runtime dependency purge gate

Only after M1–M5 pass:

1. Search repo for `AppsScript`, `apps-script`, `script.google`, `google.script`, `readTable(`, old Google env keys.
2. Runtime `src/**` result must be zero except historical comments explicitly retained.
3. Remove Apps Script files and smoke page.
4. Remove obsolete Google deployment docs after preserving business requirements.
5. Remove unused env variables/config.
6. Run typecheck/test/lint/build.
7. Verify Vercel app against Supabase project.
8. Verify DB counts and Storage access.
9. Commit deletion separately so rollback is trivial.

## 5. Files that should remain

- `source/**` — IATF/source evidence and BM references
- `src/domain/**` — business rules independent of persistence
- `supabase/**` — database/storage/auth migrations
- React UI/components that are still used
- current Supabase architecture and ID convention docs

## 6. Desired final repo shape

```text
src/
  components / feature UI
  data/
    supabaseClient.ts
    equipment.ts
    inspection.ts
    maintenance.ts
    calibration.ts
    tooling.ts
    dashboard.ts
    audit.ts
  domain/
    workflow / KPI / governance / models
supabase/
  migrations/
  functions/        # only when needed
source/
  business/IATF references
```

No `apps-script/` directory. No Google bridge client. No Google persistence smoke page.

## 7. Deletion policy

Do not bulk-delete first and repair afterward.

For each feature:

`Supabase implementation → compare behavior → runtime verification → remove legacy dependency`

Then perform one final legacy purge commit.
