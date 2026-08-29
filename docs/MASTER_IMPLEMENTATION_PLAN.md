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

## 3.1 Frontend architecture reset

Goal: remove production dependence on Apps Script HTML bridge and make `src/` the only production UI.

Tasks:

1. Keep `AppShell` diagnostic-only.
2. Replace frontend mock data with an explicit Apps Script API client.
3. Replace `browserTransport: APPS_SCRIPT_HTML_BRIDGE` with production HTTP API transport.
4. Do not expose Spreadsheet/Drive credentials to browser.
5. Keep contract version validation on every backend request.
6. Add centralized loading / error / auth-state handling.
7. Add typed API result schemas using existing Zod/domain models.

## 3.2 Backend API completion for frontend

Existing backend provides `doGet`, `doPost`, `readTable` and workflow actions, but frontend coverage must be completed.

Required API surface:

- health/session/current role
- Equipment list/detail/create/update/lifecycle/delete-safe
- Daily Inspection list/submit
- Maintenance plan/list/work order/create/transitions
- Execution/result/verification/handover
- Downtime + KPI
- Tooling master/plan/modification workflow
- Calibration master/list/log/evaluation
- Evidence upload/read links
- Audit read for authorized roles

Rule: frontend must call business actions, not write Sheets directly.

## 3.3 Production UI modules

Deliver in this order:

1. Application shell / responsive navigation / user session
2. Dashboard
3. Equipment
4. Calibration
5. Daily Inspection
6. Maintenance
7. Tooling
8. Audit & Configuration
9. QR/PWA workflow

Each module is only DONE when:

- live backend data is shown;
- mutations use Apps Script workflow APIs;
- loading/error/empty states exist;
- mobile + tablet + desktop pass;
- tests pass;
- no mock data is used in production path.

## 3.4 Equipment UI

- Combined PRODUCTION + MEASUREMENT master.
- Filter by equipmentType, department, status, area.
- Detail profile with all related history.
- ADMIN CRUD/lifecycle UI.
- QR uses `equipmentId`.

## 3.5 Calibration UI

Expected production state after current data migration:

- 52 current calibration profiles.
- 52 linked MEASUREMENT roots.
- 0 reconciliation-needed rows unless future incomplete source data is added.
- Due/overdue status calculated from current dates.
- Calibration entry only for valid linked MEASUREMENT equipment.
- Post-calibration evaluation required after log entry.

## 3.6 UX quality gate

Production frontend must be visibly more professional than AppShell:

- responsive layout;
- clear information hierarchy;
- cards/tables appropriate to screen size;
- usable mobile interaction;
- accessible labels/focus states;
- no debug wording such as LOCAL UI / mock / source snapshot in production;
- Vietnamese terminology consistent with business forms.

## 3.7 Vercel deployment

Current connected Vercel team has no project discovered. Therefore:

1. create/reconnect Vercel project to this GitHub repo;
2. framework: Vite;
3. build: `npm run build`;
4. output: `dist`;
5. production env includes Apps Script backend URL and required public contract config only;
6. deploy Preview first;
7. run live read-only + mutation smoke against authorized test/fixture flow;
8. promote production after gates pass.

---

# Phase 4 — Production hardening

After Vercel frontend reaches feature parity:

- remove mock-data imports from production bundle;
- verify CORS/origin policy between Vercel and Apps Script;
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
- notifications / reminders if approved;
- additional production modules only from official source requirements.

---

# Mandatory anti-drift rules

1. New user-facing UI work goes to `src/`, not `apps-script/AppShell*`.
2. AppShell changes are allowed only when backend diagnostic coverage needs them.
3. A backend feature with no Vercel UI is not considered product-complete if users need to operate it.
4. Google Sheets/Drive are persistence, never the browser's direct API target.
5. Apps Script is backend authority for actor, role, workflow validation and audit.
6. No new parallel equipment master or department-specific equipment code system.
7. Source data may be incomplete; incomplete fields remain blank unless the system owner explicitly authorizes a new internal standard.
8. Every phase must have build/test/live gates before being marked complete.

## Current next action

Start Phase 3.1 by replacing mock frontend data with a typed Apps Script API adapter and implement live **Equipment + Calibration** read paths first, because these now have authoritative production data and provide the fastest end-to-end validation of the architecture.
