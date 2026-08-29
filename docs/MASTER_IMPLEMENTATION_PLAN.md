# MASTER IMPLEMENTATION PLAN — CEV Equipment Management

## Kiến trúc bắt buộc

```text
User
  ↓
Vercel Frontend
React + Vite + TypeScript
  ↓
Apps Script Backend
workflow / validation / RBAC / audit / persistence API
  ↓
Google Sheets + Google Drive
production data + evidence
```

`AppShell` chỉ là màn hình test kỹ thuật của Apps Script backend. Không phải frontend production.

Browser không gọi Google Sheets/Drive trực tiếp. Frontend Vercel giao tiếp với Apps Script backend qua postMessage bridge ẩn để giữ Google session và tránh CORS/redirect của Apps Script Web App. Bridge là **transport backend**, không phải UI và không thay thế Vercel frontend.

Canonical production frontend origin:

`https://iatf-16949-equipment-management.vercel.app`

Không coi deployment hash hoặc git-branch alias là canonical production origin.

## Nguyên tắc dữ liệu cốt lõi

**Một thiết bị = một mã thiết bị = một hồ sơ gốc = toàn bộ nghiệp vụ cùng tham chiếu mã đó.**

- `Equipment_Master` là master thiết bị duy nhất.
- `PRODUCTION` và `MEASUREMENT` dùng chung Equipment Master.
- `Calibration_Master` là hồ sơ nghiệp vụ hiệu chuẩn của thiết bị MEASUREMENT.
- Tooling có lifecycle riêng theo `toolingId`.
- Không tạo thêm master song song theo phòng ban.

---

# Phase 1 — G1 data contract / domain foundation — COMPLETE

- G1 contract frozen: `G1-frozen-2026-08-28`.
- 20 Google Sheets tables.
- 9 Google Drive evidence folders.
- Domain schemas, workflow guards, KPI engine.

# Phase 2 — Apps Script backend workflows — COMPLETE

- Equipment lifecycle.
- Daily inspection.
- Maintenance Work Order lifecycle.
- Maintenance execution / verification / handover.
- Downtime and KPI.
- Tooling BM-09 / BM-10A / BM-11.
- Calibration link / log / post-calibration evaluation.
- Audit, lock, idempotency and rollback guards.
- AppShell retained as backend diagnostic shell only.

## Production data current state

- Equipment_Master: 19 PRODUCTION + 52 MEASUREMENT.
- New measurement IDs: `CEV-ME-001` … `CEV-ME-052`.
- Calibration_Master: 52 current 2026 records, linked 1:1 to the 52 MEASUREMENT devices.
- 2024 Calibration_Master snapshot backed up separately before replacement.

---

# Phase 3 — Vercel production frontend — CURRENT PRIORITY

## 3.1 Frontend architecture reset — IMPLEMENTED ON FEATURE BRANCH

- `src/` remains the production UI.
- `AppShell` remains diagnostic-only.
- Added typed Apps Script bridge client for Vercel React.
- Browser has no direct Google API access.
- Contract version remains validated across the bridge.
- `persistenceConfig` now explicitly locks:
  - `frontendRuntime = VERCEL_REACT`
  - `persistenceBoundary = APPS_SCRIPT_BACKEND`
  - `browserTransport = POSTMESSAGE_APPS_SCRIPT_BRIDGE`
  - `diagnosticUi = APPS_SCRIPT_APPSHELL`
  - canonical production origin = `https://iatf-16949-equipment-management.vercel.app`
- Added `vercel.json` for Vite build/deploy.

## 3.2 Equipment live — IMPLEMENTED ON FEATURE BRANCH

- `Equipment_Master` read live via Apps Script backend.
- Live UI supports `ALL / PRODUCTION / MEASUREMENT` filters.
- Expected production state: **71 total = 19 PRODUCTION + 52 MEASUREMENT**.
- Preview route: `?phase3=equipment`.
- Test / Build / Lint PASS.

## 3.3 Calibration live — IMPLEMENTED ON FEATURE BRANCH

- Reads `Calibration_Master + Equipment_Master` through backend.
- Calculates canonical link state only by exact `equipmentId`:
  - LINKED
  - UNLINKED
  - ORPHAN
  - INVALID_TYPE
- No fuzzy matching by serial/model/name.
- Live UI shows control number, instrument, department, model/serial, calibration date, next due and link state.
- Expected production state: **52 records / 52 LINKED / 0 reconciliation**.
- Preview route: `?phase3=calibration`.
- Test / Build / Lint PASS.

## 3.4 Next implementation order

1. Dashboard live summary.
2. Daily Inspection live.
3. Maintenance / Work Order live including backend mutations.
4. Tooling live.
5. Audit & Configuration live.
6. QR / PWA workflow.
7. After live preview gates pass, replace remaining mock production paths inside `App.tsx`.

Each module is only DONE when:

- live backend data is shown;
- mutations use Apps Script workflow APIs;
- loading/error/empty states exist;
- mobile + tablet + desktop pass;
- tests pass;
- no mock data is used in the production path.

## 3.5 UX quality gate

Production frontend must be visibly more professional than AppShell:

- responsive layout;
- clear information hierarchy;
- cards/tables appropriate to screen size;
- usable mobile interaction;
- accessible labels/focus states;
- no debug wording such as LOCAL UI / mock / source snapshot in production;
- Vietnamese terminology consistent with business forms.

## 3.6 Vercel deployment gate

Vercel project already exists. Canonical domain:

`https://iatf-16949-equipment-management.vercel.app`

Current production deployment is still from `main` before Phase 3 live slices.

The Phase 3 branch preview is currently blocked by Vercel Hobby deployment rate limit with status **“Deployment rate limited — retry in 24 hours.”** This is an infrastructure quota issue, not a frontend build failure. The same PR builds successfully in GitHub Quality Gate and Netlify preview; Netlify remains test-only and does not change the production architecture.

Do not merge just to bypass the Vercel preview gate.

Merge gate:

- GitHub Quality Gate PASS on latest HEAD.
- Vercel preview can build after rate limit resets.
- Apps Script allowed parent origins includes canonical Vercel origin.
- `?phase3=equipment` confirms live `71 = 19 + 52`.
- `?phase3=calibration` confirms live `52 LINKED / 0 reconciliation`.
- Then replace default Equipment/Calibration mock paths with live modules and merge.

---

# Phase 4 — Production hardening

After Vercel frontend reaches feature parity:

- remove all remaining mock-data imports from production bundle;
- verify Apps Script allowed-origin policy;
- security review RBAC and endpoint exposure;
- browser never controls actor/role;
- rate/duplicate protections on writes;
- error telemetry and audit review;
- backup/recovery procedure;
- operator/admin guide.

# Phase 5 — G2 extensions

Only after G1 frontend production is stable:

- BM-10B tooling replacement program;
- advanced maintenance analytics;
- richer evidence/document workflow;
- notifications/reminders if approved;
- additional production modules only from official source requirements.

---

# Mandatory anti-drift rules

1. New user-facing UI work goes to `src/`, not `apps-script/AppShell*`.
2. AppShell changes are allowed only when backend diagnostic coverage needs them.
3. A backend feature with no Vercel UI is not considered product-complete if users need to operate it.
4. Google Sheets/Drive are persistence, never the browser's direct API target.
5. Apps Script is backend authority for actor, role, workflow validation and audit.
6. The hidden Apps Script bridge is transport only; it must never become the visible production UI.
7. No new parallel equipment master or department-specific equipment code system.
8. Every phase must have build/test/live gates before being marked complete.

## Current next action

Continue Phase 3 with **Dashboard live summary**, while waiting for Vercel Hobby preview quota to reset. Do not return UI work to AppShell.
